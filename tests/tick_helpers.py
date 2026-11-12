"""Helpers for the tick handler tests (tests/test_tick_*.py)."""

import json

from lambdas.tick import Config, canonical, decode, head_key, iso, run_tick, tick_key

GENESIS = 1_800_000_000  # a test genesis on a 5-minute boundary, not a deployed one
SEED = 7
CONFIG = Config(SEED, GENESIS, "test")
REF_TICKS = 200  # the longest history any tick test needs


def at(slot):
    return GENESIS + slot * 300


class Budget:
    """A fake get_remaining_time_in_millis: starts at `ms`, drops by `cost` on every call."""

    def __init__(self, ms=60_000, cost=0):
        self.ms, self.cost = ms, cost

    def __call__(self):
        ms, self.ms = self.ms, self.ms - self.cost
        return ms


def run(store, slot, *, lines=None, config=CONFIG, now=None, scheduled="slot", budget=None, **kw):
    """One handler run for the delivery of `slot`, a second after the slot starts. Emitted lines
    are parsed and appended to `lines`."""
    out = [] if lines is None else lines
    return run_tick(
        store,
        config,
        now=at(slot) + 1 if now is None else now,
        scheduled_time=iso(at(slot)) if scheduled == "slot" else scheduled,
        remaining_ms=budget or Budget(),
        emit=lambda line: out.append(json.loads(line)),
        **kw,
    )


def history(store):
    """{tick: canonical JSON} of every stored tick object."""
    prefix = tick_key(0)[: -len("00000000.json")]
    return {
        int(k[len(prefix) : -5]): canonical(decode(o["body"]))
        for k, o in store.objects.items()
        if k.startswith(prefix)
    }


def head(store):
    return decode(store.objects[head_key()]["body"])


def assert_clean(store, ref, last):
    """Ticks 0..last exist, each written exactly once, equal to the reference; head is `last`."""
    ticks = history(store)
    assert sorted(ticks) == list(range(last + 1))
    for n, canon in ticks.items():
        assert canon == ref(n), f"tick {n} differs from the reference"
        assert store.writes[tick_key(n)] == 1, f"tick {n} written {store.writes[tick_key(n)]} times"
    assert head(store)["tick"] == last
