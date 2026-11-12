"""T20: the handler's history from genesis is the city `python -m sim` makes for the same seed,
tick for tick, compared by canonical decompressed JSON."""

from lambdas.store_memory import MemoryStore
from tests.tick_helpers import assert_clean, run

TICKS = 100  # one run under the default cap of 288


def test_t20_handler_history_equals_the_cli(ref):
    store = MemoryStore()
    assert run(store, 0)["outcome"] == "bootstrapped"
    assert run(store, TICKS)["outcome"] == "advanced"  # default cap and budget
    assert_clean(store, ref, TICKS)
