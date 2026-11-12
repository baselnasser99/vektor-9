"""The tick protocol against the in-memory store: T1 to T16, T18, T19 (ADR-0014)."""

import gzip
import hashlib
import json
import threading
from types import SimpleNamespace

import pytest

from lambdas import tick
from lambdas.store import ConditionalConflict, StoreError
from lambdas.store_memory import Crash, MemoryStore, fault
from lambdas.tick import (
    GENESIS_KEY,
    Config,
    FailClosed,
    ResumeRefused,
    canonical,
    decode,
    head_key,
    tick_key,
)
from sim import rules as R
from tests.tick_helpers import (
    CONFIG,
    GENESIS,
    SEED,
    Budget,
    assert_clean,
    at,
    head,
    history,
    run,
)

EMF_METRICS = {
    "HeadTick",
    "TicksPublished",
    "TicksBehind",
    "DeliveryDelaySeconds",
    "PublishFailures",
    "RecoveryActions",
}


def city(ref, slots):
    """A store that ran cleanly through `slots` (one delivery per slot)."""
    store = MemoryStore()
    for s in slots:
        run(store, s)
    return store


def plant(store, key, state):
    """Overwrite an object by hand, bypassing the protocol."""
    body = gzip.compress(canonical(state), mtime=0)
    store.objects[key] = {**store.objects.get(key, {"metadata": {}, "headers": {}}), "body": body}
    store.objects[key]["etag"] = '"planted"'


def test_t1_bootstrap_on_empty_store_then_noop(ref):
    store, lines = MemoryStore(), []
    assert run(store, 0, lines=lines)["outcome"] == "bootstrapped"
    assert set(store.objects) == {GENESIS_KEY, tick_key(0), head_key()}
    assert json.loads(store.objects[GENESIS_KEY]["body"]) == {
        "seed": SEED,
        "genesis": tick.iso(GENESIS),
        "first_schema": R.SCHEMA,
    }
    assert history(store) == {0: ref(0)}
    assert head(store)["tick"] == 0

    t0 = store.objects[tick_key(0)]
    assert t0["headers"] == {
        "ContentType": "application/json",
        "ContentEncoding": "gzip",
        "CacheControl": "public, max-age=31536000, immutable",
    }
    assert t0["metadata"] == {
        "sim-version": str(R.SIM_VERSION),
        "artifact-sha256": hashlib.sha256(gzip.decompress(t0["body"])).hexdigest(),
    }
    assert store.objects[head_key()]["headers"]["CacheControl"] == "public, max-age=30"

    writes = dict(store.writes)
    assert run(store, 0)["outcome"] == "noop"
    assert store.writes == writes


def test_emf_and_summary_lines(ref):
    store, lines = city(ref, [0]), []
    run(store, 2, lines=lines, now=at(2) + 7)
    emf, summary = lines
    meta = emf["_aws"]["CloudWatchMetrics"][0]
    assert meta["Namespace"] == "Vektor9" and meta["Dimensions"] == [["Stage"]]
    assert {m["Name"] for m in meta["Metrics"]} == EMF_METRICS
    assert emf["Stage"] == "test"
    assert emf["_aws"]["Timestamp"] == (at(2) + 7) * 1000
    assert (emf["HeadTick"], emf["TicksPublished"], emf["TicksBehind"]) == (2, 2, 0)
    assert (emf["DeliveryDelaySeconds"], emf["PublishFailures"]) == (7, 0)
    assert emf["RecoveryActions"] == 1 and emf["recovery"] == ["catch_up"]
    assert summary["summary"] == "tick"
    assert {k: summary[k] for k in ("due", "head_before", "head_after", "ticks_published")} == {
        "due": 2,
        "head_before": 0,
        "head_after": 2,
        "ticks_published": 2,
    }
    assert summary["outcome"] == "advanced" and isinstance(summary["duration_ms"], int)


def test_t2_racing_bootstraps_make_one_city(ref):
    store, outcomes = MemoryStore(), []

    def other_bootstrap(op, key, phase):
        if op == "put" and key == GENESIS_KEY and phase == "before" and not outcomes:
            store.hooks.remove(other_bootstrap)
            outcomes.append(run(store, 0)["outcome"])

    store.hooks.append(other_bootstrap)
    outcomes.append(run(store, 0)["outcome"])
    assert outcomes == ["bootstrapped", "bootstrap_lost"]
    assert store.writes == {GENESIS_KEY: 1, tick_key(0): 1, head_key(): 1}
    assert history(store) == {0: ref(0)}


def test_t3_same_scheduled_time_twice(ref):
    store = city(ref, [0, 1])
    writes = dict(store.writes)
    assert run(store, 1)["outcome"] == "noop"
    assert store.writes == writes


def test_t4_late_delivery(ref):
    store = city(ref, [0, 1, 2, 3])
    writes = dict(store.writes)
    assert run(store, 2, now=at(3) + 40)["outcome"] == "noop"
    assert store.writes == writes


def test_t5_future_schedule_is_clamped_and_before_genesis_is_noop(ref):
    store = city(ref, [0])
    summary = run(store, 10, now=at(2) + 5)
    assert summary["due"] == 2 and summary["head_after"] == 2
    assert_clean(store, ref, 2)

    empty = MemoryStore()
    assert run(empty, -1)["outcome"] == "not_started"
    assert run(empty, 3, now=GENESIS - 1)["outcome"] == "not_started"
    assert empty.objects == {} and not empty.writes


def test_t6_one_missed_slot(ref):
    store = city(ref, [0, 1])
    summary = run(store, 3)
    assert summary["ticks_published"] == 2 and summary["recovery"] == ["catch_up"]
    assert_clean(store, ref, 3)


T7_GAP = 200  # far more than the cap of 24 a run (architecture 4.8 says 2,016; kept short for CI)


def test_t7_long_gap_small_budget(ref):
    store, runs = city(ref, [0]), []
    while not runs or runs[-1]["outcome"] == "budget":
        # 10 s of budget at 1 s a check: ~10 ticks a run, below the cap of 24
        runs.append(run(store, T7_GAP, budget=Budget(25_000, 1_000), max_ticks=24))
    assert len(runs) >= T7_GAP // 24
    assert all(r["ticks_published"] <= 24 for r in runs)
    assert sum(r["ticks_published"] for r in runs) == T7_GAP
    assert_clean(store, ref, T7_GAP)


def test_t7_cap_alone_limits_a_run(ref):
    store = city(ref, [0])
    assert run(store, 30, max_ticks=24)["ticks_published"] == 24
    assert run(store, 30, max_ticks=24)["ticks_published"] == 6
    assert_clean(store, ref, 30)


def test_t8_crash_after_tick_before_head(ref):
    store = city(ref, [0])
    store.hooks.append(fault("put", tick_key(1), phase="after"))
    with pytest.raises(Crash):
        run(store, 1)
    assert head(store)["tick"] == 0 and 1 in history(store)
    assert run(store, 1)["head_after"] == 1
    assert_clean(store, ref, 1)


def test_bootstrap_crash_after_tick0_before_genesis(ref):
    store = MemoryStore()
    store.hooks.append(fault("put", GENESIS_KEY))
    with pytest.raises(Crash):
        run(store, 0)
    assert set(store.objects) == {tick_key(0)}
    etag = store.objects[tick_key(0)]["etag"]
    assert run(store, 0)["outcome"] == "bootstrapped"
    assert store.objects[tick_key(0)]["etag"] == etag and store.writes[tick_key(0)] == 1
    assert store.writes == {GENESIS_KEY: 1, tick_key(0): 1, head_key(): 1}
    assert_clean(store, ref, 0)


def test_bootstrap_crash_after_genesis_before_head(ref):
    store = MemoryStore()
    store.hooks.append(fault("put", head_key()))
    with pytest.raises(Crash):
        run(store, 0)
    assert set(store.objects) == {tick_key(0), GENESIS_KEY}
    summary = run(store, 0)
    assert summary["recovery"] == ["head_repaired"] and summary["head_after"] == 0
    assert store.writes == {GENESIS_KEY: 1, tick_key(0): 1, head_key(): 1}
    assert_clean(store, ref, 0)


def test_bootstrap_crash_after_tick0_then_other_seed_fails_closed(ref):
    store = MemoryStore()
    store.hooks.append(fault("put", GENESIS_KEY))
    with pytest.raises(Crash):
        run(store, 0)
    with pytest.raises(FailClosed) as e:
        run(store, 0, config=Config(SEED + 1, GENESIS, "test"))
    assert e.value.reason == "divergence"
    assert set(store.objects) == {tick_key(0)} and store.writes == {tick_key(0): 1}


def test_t9_timeout_mid_catch_up(ref):
    store = city(ref, [0])
    store.hooks.append(fault("put", tick_key(4)))  # killed while committing tick 4
    with pytest.raises(Crash):
        run(store, 6)
    assert head(store)["tick"] == 3 and sorted(history(store)) == [0, 1, 2, 3]
    summary = run(store, 6)
    assert (summary["head_before"], summary["ticks_published"]) == (3, 3)
    assert_clean(store, ref, 6)


def test_t10_two_handlers_interleaved(ref):
    store, inner = city(ref, [0]), []

    def second_writer(op, key, phase):
        if op == "put" and key == head_key() and phase == "before" and head(store)["tick"] == 1:
            store.hooks.remove(second_writer)
            inner.append(run(store, 4))

    store.hooks.append(second_writer)
    outer = run(store, 4)
    assert inner[0]["outcome"] == "advanced" and inner[0]["head_after"] == 4
    assert outer["outcome"] == "yielded" and outer["recovery"] == ["catch_up", "conflict_yielded"]
    assert_clean(store, ref, 4)


def test_t10_two_handlers_in_threads(ref):
    store, results, gate = city(ref, [0]), [], threading.Barrier(2)

    def worker():
        gate.wait()
        results.append(run(store, 12))

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(results) == 2 and {r["outcome"] for r in results} <= {"advanced", "yielded", "noop"}
    assert_clean(store, ref, 12)


def test_t11_divergent_stored_tick(ref):
    store, lines = city(ref, [0]), []
    other = json.loads(ref(1))
    other["power"]["demand"] += 1
    plant(store, tick_key(1), other)
    before = store.objects[head_key()]
    with pytest.raises(FailClosed) as e:
        run(store, 1, lines=lines)
    assert e.value.reason == "divergence"
    assert store.objects[head_key()] is before
    assert lines[0]["PublishFailures"] == 1 and lines[0]["reason"] == "divergence"


@pytest.mark.parametrize(
    "body, reason",
    [(b"not json", "unreadable"), (canonical({"schema": R.SCHEMA}), "invalid_head")],
)
def test_t12_invalid_head(ref, body, reason):
    store = city(ref, [0, 1])
    store.objects[head_key()]["body"] = body
    writes = dict(store.writes)
    with pytest.raises(FailClosed) as e:
        run(store, 2)
    assert e.value.reason == reason and store.writes == writes


def test_t13_deleted_head_is_repaired_from_newest_valid_tick(ref):
    store = city(ref, [0, 3, 5])
    del store.objects[head_key()]
    store.objects[tick_key(6)] = {**store.objects[tick_key(5)], "body": b"torn"}
    summary = run(store, 5)
    assert summary["recovery"] == ["head_repaired"] and summary["head_after"] == 5
    assert head(store)["tick"] == 5 and canonical(head(store)) == ref(5)

    healthy = city(ref, [0, 5])
    del healthy.objects[head_key()]
    assert run(healthy, 7)["head_after"] == 7
    assert_clean(healthy, ref, 7)


def test_t14_everything_gone_but_genesis(ref):
    store = city(ref, [0, 2])
    for key in [k for k in store.objects if k != GENESIS_KEY]:
        del store.objects[key]
    writes = dict(store.writes)
    with pytest.raises(FailClosed) as e:
        run(store, 3)
    assert e.value.reason == "no_valid_tick"
    assert set(store.objects) == {GENESIS_KEY} and store.writes == writes


@pytest.mark.parametrize(
    "config", [Config(SEED + 1, GENESIS, "test"), Config(SEED, GENESIS + 300, "test")]
)
def test_t15_config_differs_from_genesis_json(ref, config):
    store = city(ref, [0, 1])
    writes = dict(store.writes)
    with pytest.raises(FailClosed) as e:
        run(store, 3, config=config)
    assert e.value.reason == "config_mismatch" and store.writes == writes


def test_t15_head_from_another_city(ref):
    store = city(ref, [0])
    foreign = decode(store.objects[head_key()]["body"])
    foreign["seed"] = SEED + 1
    plant(store, head_key(), foreign)
    with pytest.raises(FailClosed) as e:
        run(store, 1)
    assert e.value.reason == "seed_mismatch"


@pytest.mark.parametrize("key", [tick_key(1), head_key(), GENESIS_KEY])
def test_t16_one_conflict_is_retried(ref, key):
    store = MemoryStore()
    if key != GENESIS_KEY:
        run(store, 0)
    store.hooks.append(fault("put", key, error=ConditionalConflict))
    if key == GENESIS_KEY:
        assert run(store, 0)["outcome"] == "bootstrapped"
    assert run(store, 1)["outcome"] == "advanced"
    assert_clean(store, ref, 1)


def test_t16_two_conflicts_raise_without_damage(ref):
    store, lines = city(ref, [0]), []
    store.hooks.append(fault("put", head_key(), error=ConditionalConflict, times=2))
    with pytest.raises(ConditionalConflict):
        run(store, 1, lines=lines)
    assert lines[0]["reason"] == "store_error" and lines[0]["PublishFailures"] == 1
    assert run(store, 1)["outcome"] == "advanced"
    assert_clean(store, ref, 1)


def test_store_failure_is_reported_and_retried_next_slot(ref):
    store, lines = city(ref, [0]), []
    store.hooks.append(fault("get", head_key(), error=StoreError))
    with pytest.raises(StoreError):
        run(store, 1, lines=lines)
    assert lines[1]["outcome"] == "error" and not store.writes[tick_key(1)]
    run(store, 1)
    assert_clean(store, ref, 1)


def test_t18_rules_version_change_mid_history(ref, monkeypatch):
    store = city(ref, [0, 3])
    old = {n: store.objects[tick_key(n)]["body"] for n in range(4)}
    monkeypatch.setattr(R, "SIM_VERSION", R.SIM_VERSION + 1)
    run(store, 6)
    for n in range(4):
        assert store.objects[tick_key(n)]["body"] == old[n]
        assert decode(old[n])["sim"] == R.SIM_VERSION - 1
    for n in (4, 5, 6):
        assert decode(store.objects[tick_key(n)]["body"])["sim"] == R.SIM_VERSION
        assert store.objects[tick_key(n)]["metadata"]["sim-version"] == str(R.SIM_VERSION)
    assert head(store)["sim"] == R.SIM_VERSION


@pytest.mark.parametrize("slot", [2, 3])  # a no-op slot refuses too
def test_t19_resume_refused_is_terminal(ref, slot):
    store = city(ref, [0, 2])
    newer = head(store)
    newer["sim"] = R.SIM_VERSION + 1
    plant(store, head_key(), newer)
    writes = dict(store.writes)
    for _ in range(2):
        lines = []
        with pytest.raises(ResumeRefused) as e:
            run(store, slot, lines=lines)
        assert isinstance(e.value, FailClosed) and e.value.reason == "resume_refused"
        assert lines[0]["PublishFailures"] == 1 and lines[0]["reason"] == "resume_refused"
        assert store.writes == writes


def test_missing_genesis_with_head_fails_closed(ref):
    store = city(ref, [0])
    del store.objects[GENESIS_KEY]
    with pytest.raises(FailClosed) as e:
        run(store, 1)
    assert e.value.reason == "missing_genesis"


def test_handler_wrapper(ref, monkeypatch, capsys):
    store = MemoryStore()
    monkeypatch.setattr(tick, "_runtime", (CONFIG, store))
    monkeypatch.setattr(tick.time, "time", lambda: at(1) + 3)
    context = SimpleNamespace(get_remaining_time_in_millis=lambda: 50_000)
    assert tick.handler({"scheduled_time": tick.iso(at(1))}, context)["outcome"] == "bootstrapped"
    assert tick.handler(None, context)["head_after"] == 1  # manual invoke: the clock alone
    emf, summary = (json.loads(line) for line in capsys.readouterr().out.splitlines()[-2:])
    assert emf["TicksPublished"] == 1 and "DeliveryDelaySeconds" not in emf
    assert summary["outcome"] == "advanced"
    with pytest.raises(FailClosed):
        tick.handler("garbage", context)
