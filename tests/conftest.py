"""Session fixtures shared by the tick handler tests."""

import json
from functools import cache

import pytest

from lambdas.tick import canonical
from sim.__main__ import main as sim_cli
from tests.tick_helpers import REF_TICKS, SEED


@pytest.fixture(scope="session")
def ref(tmp_path_factory):
    """ref(n): tick n of `python -m sim --seed SEED` as canonical JSON, from one CLI run per
    session."""
    out = tmp_path_factory.mktemp("cli")
    sim_cli(["--ticks", str(REF_TICKS), "--seed", str(SEED), "--out", str(out)])

    @cache
    def tick(n):
        return canonical(json.loads((out / f"{n:06d}.json").read_text()))

    return tick
