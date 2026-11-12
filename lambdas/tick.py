"""The tick Lambda: advance the city to the tick due now, one commit per tick (ADR-0014).

run_tick() holds the protocol and takes everything from outside as arguments: the store, the
config, the clock reading, the time left and where log lines go. handler() is the thin Lambda
wrapper and the only code that reads the clock.

Keys, all under the schema this code advances (sim.rules.SCHEMA):
    city/genesis.json                  {seed, genesis, first_schema}; ties the bucket to one city
    city/v{SCHEMA}/ticks/{tick:08d}.json   immutable history, written once with If-None-Match: *
    city/v{SCHEMA}/latest.json         the head, a copy of the newest tick, moved with If-Match
"""

import gzip
import hashlib
import json
import math
import os
import re
import time
import zlib
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from lambdas.store import ConditionalConflict, NotFound, PreconditionFailed, StoreError
from lambdas.store_s3 import S3Store
from sim import rules as R
from sim.state import new_city, validate
from sim.step import resume_error, step, tick_rng

SLOT = 300  # seconds per tick
GENESIS_KEY = "city/genesis.json"
TICK_CACHE = "public, max-age=31536000, immutable"
HEAD_CACHE = "public, max-age=30"
DECODE_ERRORS = (OSError, EOFError, ValueError, zlib.error)  # bad gzip, bad JSON, bad UTF-8


class FailClosed(Exception):
    """The run must not continue and writes nothing more: an invalid or foreign head, a
    divergent tick, a bad input. The head stays on the last good tick; the Errors alarm fires."""

    def __init__(self, reason, detail=""):
        super().__init__(f"{reason}: {detail}" if detail else reason)
        self.reason = reason


class ResumeRefused(FailClosed):
    """sim.step.resume_error() refuses the head: it is from another schema or from newer rules
    than this code. Terminal and not retryable: nothing is written, and every later slot refuses
    the same way until code that may advance the head is deployed. Recovery is rolling forward
    (deploy that code); history is never reset or rewritten."""


class ConfigError(ValueError):
    """The seed, genesis or stage in the environment is missing or malformed."""


class _Yield(Exception):
    """Another writer moved the head first; its ticks equal ours by construction."""


@dataclass(frozen=True)
class Config:
    seed: int
    genesis: int  # epoch seconds, on a 5-minute boundary
    stage: str  # the EMF Stage dimension


def parse_utc(text):
    """An ISO 8601 instant with a UTC offset of zero, as a datetime. ValueError otherwise."""
    if not isinstance(text, str):
        raise ValueError(f"not a string: {text!r}")
    dt = datetime.fromisoformat(text)
    if dt.utcoffset() != timedelta(0):  # None for a naive time
        raise ValueError(f"not UTC: {text!r}")
    return dt


def iso(epoch):
    return datetime.fromtimestamp(epoch, UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_config(env):
    """Config from VEKTOR9_SEED, VEKTOR9_GENESIS (ISO 8601 UTC, on a 5-minute boundary) and
    VEKTOR9_STAGE."""
    seed = env.get("VEKTOR9_SEED", "")
    if not (seed.isascii() and seed.isdigit()):
        raise ConfigError(f"VEKTOR9_SEED must be a non-negative integer, got {seed!r}")
    try:
        dt = parse_utc(env.get("VEKTOR9_GENESIS"))
    except ValueError as e:
        raise ConfigError(f"VEKTOR9_GENESIS: {e}") from None
    genesis = math.floor(dt.timestamp())
    if dt.microsecond or genesis % SLOT:
        raise ConfigError(f"VEKTOR9_GENESIS must be on a 5-minute boundary, got {iso(genesis)}")
    stage = env.get("VEKTOR9_STAGE", "")
    if not stage:
        raise ConfigError("VEKTOR9_STAGE must be set")
    return Config(int(seed), genesis, stage)


def due_tick(genesis, now, scheduled=None):
    """The tick due: the scheduled slot, never ahead of the clock. Negative before genesis."""
    due = (math.floor(now) - genesis) // SLOT
    if scheduled is not None:
        due = min(due, (scheduled - genesis) // SLOT)
    return due


def prefix():
    return f"city/v{R.SCHEMA}"


def tick_key(n):
    return f"{prefix()}/ticks/{n:08d}.json"


def head_key():
    return f"{prefix()}/latest.json"


def canonical(state):
    """The form contents are compared in, and the bytes that are stored (gzipped)."""
    return json.dumps(state, sort_keys=True, separators=(",", ":")).encode()


def decode(body):
    """A stored object's JSON. Compressed or not: compare contents, never gzip bytes."""
    if body[:2] == b"\x1f\x8b":
        body = gzip.decompress(body)
    return json.loads(body)


def _encoded(state):
    canon = canonical(state)
    meta = {"sim-version": str(state["sim"]), "artifact-sha256": hashlib.sha256(canon).hexdigest()}
    return canon, gzip.compress(canon, mtime=0), meta


def _put_snapshot(store, key, body, meta, cache, **condition):
    return store.put(
        key,
        body,
        content_type="application/json",
        content_encoding="gzip",
        cache_control=cache,
        metadata=meta,
        **condition,
    )


def _write_tick(store, n, canon, body, meta):
    """Create tick n. If it exists, it must hold the same city (an earlier run wrote it and died
    before moving the head); anything else is divergence. A 409 is retried once."""
    for attempt in (1, 2):
        try:
            _put_snapshot(store, tick_key(n), body, meta, TICK_CACHE, if_none_match=True)
            return
        except ConditionalConflict:
            if attempt == 2:
                raise
        except PreconditionFailed:
            existing = store.get(tick_key(n))[0]
            try:
                same = canonical(decode(existing)) == canon
            except DECODE_ERRORS:
                same = False
            if not same:
                raise FailClosed("divergence", f"stored tick {n} differs") from None
            return


def _write_head(store, body, meta, etag, prev_canon):
    """Move the head from the object with `etag` (whose contents are prev_canon) to `body`. A 412
    means another writer moved it: Yield. A 409 re-reads; if the head is unchanged it retries once
    with the ETag it now has, otherwise Yield."""
    for attempt in (1, 2):
        try:
            return _put_snapshot(store, head_key(), body, meta, HEAD_CACHE, if_match=etag)
        except PreconditionFailed:
            raise _Yield() from None
        except ConditionalConflict:
            if attempt == 2:
                raise
            current, etag, _ = store.get(head_key())
            try:
                unchanged = canonical(decode(current)) == prev_canon
            except DECODE_ERRORS:
                unchanged = False
            if not unchanged:
                raise _Yield() from None


def _read_json(store, key):
    """(json, etag), or None if the key is missing. FailClosed if it does not parse."""
    try:
        body, etag, _ = store.get(key)
    except NotFound:
        return None
    try:
        return decode(body), etag
    except DECODE_ERRORS:
        raise FailClosed("unreadable", key) from None


def _check_genesis(doc, config):
    if not isinstance(doc, dict) or not isinstance(doc.get("seed"), int):
        raise FailClosed("bad_genesis", "genesis.json is malformed")
    try:
        genesis = math.floor(parse_utc(doc.get("genesis")).timestamp())
    except ValueError:
        raise FailClosed("bad_genesis", "genesis.json is malformed") from None
    if (doc["seed"], genesis) != (config.seed, config.genesis):
        raise FailClosed(
            "config_mismatch",
            f"config seed {config.seed} genesis {iso(config.genesis)}; "
            f"bucket seed {doc['seed']} genesis {doc['genesis']}",
        )


def _check_head(state, genesis_doc):
    if errors := validate(state):
        raise FailClosed("invalid_head", "; ".join(errors[:3]))
    if state["seed"] != genesis_doc["seed"]:
        raise FailClosed("seed_mismatch", f"head seed {state['seed']}")
    if why := resume_error(state):
        raise ResumeRefused("resume_refused", why)


def _bootstrap(store, config, run):
    """A new city: tick 0, then genesis.json, then the head, each If-None-Match: *. In this order
    every crash point leaves a state the next run finishes (ADR-0014)."""
    state = new_city(config.seed)
    if errors := validate(state):
        raise FailClosed("invalid_step", "; ".join(errors[:3]))
    canon, body, meta = _encoded(state)
    _write_tick(store, 0, canon, body, meta)
    doc = {"seed": config.seed, "genesis": iso(config.genesis), "first_schema": R.SCHEMA}
    for attempt in (1, 2):
        try:
            store.put(
                GENESIS_KEY,
                json.dumps(doc, sort_keys=True).encode(),
                if_none_match=True,
                content_type="application/json",
                content_encoding=None,
                cache_control="no-store",
                metadata={},
            )
            break
        except ConditionalConflict:
            if attempt == 2:
                raise
        except PreconditionFailed:
            run["outcome"] = "bootstrap_lost"  # another bootstrap got there first
            return
    try:
        _put_snapshot(store, head_key(), body, meta, HEAD_CACHE, if_none_match=True)
    except (PreconditionFailed, ConditionalConflict):
        run["outcome"] = "bootstrap_lost"  # another run already repaired the head to tick 0
        return
    run.update(outcome="bootstrapped", head_after=0, published=1)


def _repair_head(store, genesis_doc, run):
    """The head is missing but a city exists: the newest tick object that validates and belongs to
    this city becomes the head. Never a new city."""
    pattern = re.compile(rf"{re.escape(prefix())}/ticks/(\d{{8}})\.json")
    ticks = sorted(
        (
            (int(m.group(1)), k)
            for k in store.list(f"{prefix()}/ticks/")
            if (m := pattern.fullmatch(k))
        ),
        reverse=True,
    )
    for n, key in ticks:
        try:
            state = decode(store.get(key)[0])
        except (NotFound, *DECODE_ERRORS):
            continue
        if validate(state) or state["seed"] != genesis_doc["seed"] or state["tick"] != n:
            continue
        _, body, meta = _encoded(state)
        try:
            etag = _put_snapshot(store, head_key(), body, meta, HEAD_CACHE, if_none_match=True)
        except (PreconditionFailed, ConditionalConflict):
            raise _Yield() from None
        run["recovery"].append("head_repaired")
        return state, etag
    raise FailClosed("no_valid_tick", "head missing and no tick object to repair it from")


def _advance(store, config, run, *, now, scheduled_time, remaining_ms, max_ticks, reserve_ms):
    try:
        scheduled = None
        if scheduled_time is not None:
            scheduled = math.floor(parse_utc(scheduled_time).timestamp())
    except ValueError:
        raise FailClosed("bad_scheduled_time", repr(scheduled_time)) from None
    if scheduled is not None:
        run["delay"] = now - scheduled
    due = run["due"] = due_tick(config.genesis, now, scheduled)
    if due < 0:
        run["outcome"] = "not_started"
        return

    head = _read_json(store, head_key())
    genesis_doc = _read_json(store, GENESIS_KEY)
    if head is None and genesis_doc is None:
        return _bootstrap(store, config, run)
    if genesis_doc is None:
        raise FailClosed("missing_genesis", "a head exists but genesis.json does not")
    _check_genesis(genesis_doc[0], config)
    genesis_doc = genesis_doc[0]
    if head is None:
        head = _repair_head(store, genesis_doc, run)
    else:
        run["head_before"] = head[0].get("tick") if isinstance(head[0], dict) else None
    state, etag = head
    _check_head(state, genesis_doc)
    run["head_after"] = state["tick"]
    if due - state["tick"] > 1:
        run["recovery"].append("catch_up")

    prev = canonical(state)
    while state["tick"] < due:
        if run["published"] >= max_ticks or remaining_ms() < reserve_ms:
            run["outcome"] = "budget"
            return
        new, _events = step(state, [], tick_rng(state))
        if errors := validate(new):
            raise FailClosed("invalid_step", "; ".join(errors[:3]))
        canon, body, meta = _encoded(new)
        _write_tick(store, new["tick"], canon, body, meta)
        etag = _write_head(store, body, meta, etag, prev)
        state, prev = new, canon
        run["published"] += 1
        run["head_after"] = new["tick"]
    run["outcome"] = "advanced" if run["published"] else "noop"


def _emit_run(emit, config, run, now, duration_ms):
    behind = None
    if run["due"] is not None and run["head_after"] is not None:
        behind = max(0, run["due"] - run["head_after"])
    metrics = {
        "HeadTick": run["head_after"],
        "TicksPublished": run["published"],
        "TicksBehind": behind,
        "DeliveryDelaySeconds": run["delay"],
        "PublishFailures": int(run["outcome"] in ("failed", "error")),
        "RecoveryActions": len(run["recovery"]),
    }
    metrics = {k: v for k, v in metrics.items() if v is not None}
    units = {"DeliveryDelaySeconds": "Seconds", "HeadTick": "None", "TicksBehind": "Count"}
    emf = {
        "CloudWatchMetrics": [
            {
                "Namespace": "Vektor9",
                "Dimensions": [["Stage"]],
                "Metrics": [{"Name": k, "Unit": units.get(k, "Count")} for k in metrics],
            }
        ],
        "Timestamp": math.floor(now * 1000),
    }
    detail = {"outcome": run["outcome"], "reason": run["reason"], "recovery": run["recovery"]}
    summary = {
        "summary": "tick",
        "due": run["due"],
        "head_before": run["head_before"],
        "head_after": run["head_after"],
        "ticks_published": run["published"],
        "duration_ms": duration_ms,
        **detail,
    }
    emit(json.dumps({"_aws": emf, "Stage": config.stage, **metrics, **detail}))
    emit(json.dumps(summary))
    return summary


def run_tick(
    store,
    config,
    *,
    now,
    scheduled_time,
    remaining_ms,
    emit,
    max_ticks=R.TICKS_PER_DAY,
    reserve_ms=15000,
):
    """Advance the city in `store` to the tick due at `now` (epoch seconds) for the slot
    `scheduled_time` (ISO 8601 UTC, or None for the clock alone): one commit per tick, stopping
    when caught up, after max_ticks, or when remaining_ms() drops below reserve_ms. Emits one EMF
    line and one summary line through emit(str). Returns the summary; raises FailClosed (or
    ResumeRefused) and storage errors after emitting them."""
    start = remaining_ms()
    run = {
        "due": None,
        "head_before": None,
        "head_after": None,
        "published": 0,
        "delay": None,
        "outcome": None,
        "reason": None,
        "recovery": [],
    }
    try:
        _advance(
            store,
            config,
            run,
            now=now,
            scheduled_time=scheduled_time,
            remaining_ms=remaining_ms,
            max_ticks=max_ticks,
            reserve_ms=reserve_ms,
        )
    except _Yield:
        try:
            current = _read_json(store, head_key())
            run["head_after"] = current[0].get("tick") if current else None
        except (FailClosed, StoreError, AttributeError):
            run["head_after"] = None  # only the summary needs it; the next run reads it again
        run["recovery"].append("conflict_yielded")
        run["outcome"] = "yielded"
    except FailClosed as e:
        run.update(outcome="failed", reason=e.reason)
        _emit_run(emit, config, run, now, start - remaining_ms())
        raise
    except Exception as e:
        run.update(outcome="error", reason="store_error" if isinstance(e, StoreError) else "error")
        _emit_run(emit, config, run, now, start - remaining_ms())
        raise
    return _emit_run(emit, config, run, now, start - remaining_ms())


_runtime = None  # (config, store), built on the first invocation of this container


def handler(event, context):
    """Lambda entry point. The event is the Scheduler input {"scheduled_time", ...}; a manual
    invoke with no scheduled_time uses the clock alone."""
    global _runtime
    if _runtime is None:
        _runtime = (load_config(os.environ), S3Store(os.environ["VEKTOR9_BUCKET"]))
    config, store = _runtime
    # anything but an object is passed on as the scheduled time, where it fails closed
    scheduled = event.get("scheduled_time") if isinstance(event, dict) else event
    return run_tick(
        store,
        config,
        now=time.time(),
        scheduled_time=scheduled,
        remaining_ms=context.get_remaining_time_in_millis,
        emit=lambda line: print(line, flush=True),
    )
