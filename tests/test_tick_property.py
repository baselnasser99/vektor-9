"""T17: random crash points, a second writer at random points, missed, duplicate and late
deliveries over many slots. The final history equals a clean run from the seed (ADR-0014)."""

from hypothesis import given, settings
from hypothesis import strategies as st

from lambdas.store_memory import Crash, MemoryStore
from tests.tick_helpers import assert_clean, at, run

SLOTS = 10
DELIVERIES = {
    "run": lambda s: [s],
    "miss": lambda s: [],
    "dup": lambda s: [s, s],
    "late": lambda s: [s, s - 1],  # the previous slot's delivery arrives after this one
}
CALL = st.none() | st.integers(0, 12)  # which store call of the run, counting before and after
SLOT_PLAN = st.tuples(st.sampled_from(sorted(DELIVERIES)), CALL, st.booleans(), CALL)


def chaos(store, slot, crash_at, crash_after, other_at):
    """A hook that crashes the run at one store call and, at another, runs a second handler for
    the same slot to completion on the same store."""
    calls, busy = [0], [False]

    def hook(op, key, phase):
        if busy[0]:
            return
        i = calls[0]
        calls[0] += 1
        if i == other_at:
            busy[0] = True
            try:
                run(store, slot)
            finally:
                busy[0] = False
        if i == crash_at and phase == ("after" if crash_after else "before"):
            raise Crash(f"crash at call {i}")

    return hook


@settings(max_examples=15, deadline=None, derandomize=True)
@given(st.lists(SLOT_PLAN, min_size=SLOTS, max_size=SLOTS))
def test_t17_any_schedule_of_faults_gives_the_clean_history(ref, plan):
    store = MemoryStore()
    for slot, (kind, crash_at, crash_after, other_at) in enumerate(plan):
        for i, delivered in enumerate(DELIVERIES[kind](slot)):
            if i == 0:
                store.hooks = [chaos(store, delivered, crash_at, crash_after, other_at)]
            try:
                run(store, delivered, now=at(slot) + 1)
            except Crash:
                pass
            store.hooks = []
    last = SLOTS - 1
    while run(store, last)["outcome"] == "budget":
        pass
    assert_clean(store, ref, last)
