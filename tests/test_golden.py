"""Golden outputs: the simulation's results at fixed seeds and ticks, recorded per SIM_VERSION.

If a change to sim/ makes these tests fail, either it changed the city by accident (fix it), or on
purpose: bump SIM_VERSION in sim/rules.py and record the new outputs (ADR-0013) with

    uv run python -m tests.test_golden --write
"""

import hashlib
import json
import random
import sys
from functools import cache
from pathlib import Path

import pytest

from sim import rules as R
from sim.rng import choice, randint, randrange
from sim.state import apply_power, new_city, new_tile
from sim.step import step, tick_rng

GOLDEN = Path(__file__).parent / "golden" / f"sim-v{R.SIM_VERSION}.json"
# What is compared: the city itself. "schema" and "sim" are labels, so a format change that keeps
# the city the same does not touch these files, and a rules change cannot hide behind one.
FIELDS = ("seed", "tick", "size", "plan", "tiles", "power", "events", "mark_ids")
DAY = R.TICKS_PER_DAY


def chaotic_city(seed):
    """Any mix of tiles in any valid state, dense enough for decline, redevelopment, overcrowding
    and new plants on the first day. Frozen: changing it changes the golden file."""
    rng = random.Random(seed)
    tiles = []
    for _ in range(R.SIZE * R.SIZE):
        kind = choice(rng, R.KINDS)
        target = randint(rng, 1, R.FLOORS_MAX) if kind in ("build", "house") else 0
        floors = randrange(rng, target) if kind == "build" else target
        people = randint(rng, 0, floors * R.PEOPLE_PER_FLOOR * 2) if kind == "house" else 0
        tiles.append(new_tile(kind, rng, floors, target, people))
    return {**new_city(seed), "tiles": tiles, "power": apply_power(tiles)}


def lone_market(seed):
    """A new city with an extra market on the first open lot of the top row, far from any house,
    so it closes. Frozen like chaotic_city."""
    city = new_city(seed)
    tiles = [dict(t) for t in city["tiles"]]
    i = next(i for i in range(R.SIZE) if tiles[i]["k"] == "lot")
    tiles[i] = new_tile("market", random.Random(seed))
    return {**city, "tiles": tiles, "power": apply_power(tiles)}


def visitor_marks(state):
    """Marks for the next tick: commissions on the first two lots, one repeated, one malformed."""
    lots = [i for i, t in enumerate(state["tiles"]) if t["k"] == "lot"][:2]
    t = state["tick"]
    marks = [
        {"id": f"m{t}-{i}", "kind": "commission", "x": i % R.SIZE, "y": i // R.SIZE} for i in lots
    ]
    return [*marks, *marks[:1], {"id": "bad", "kind": "nuke", "x": 0, "y": 0}]


# name: (start, ticks to run, checkpoints, whether visitors leave marks)
CASES = {
    "seed7-day": (lambda: new_city(7), DAY, (0, 1, 12, 96, DAY), False),
    "seed3-day": (lambda: new_city(3), DAY, (0, 1, 12, 96, DAY), False),
    "seed11-day": (lambda: new_city(11), DAY, (0, 1, 12, 96, DAY), False),
    "seed7-3days": (lambda: new_city(7), 3 * DAY, (DAY - 1, DAY, DAY + 1, 2 * DAY, 3 * DAY), False),
    "seed5-marks": (lambda: new_city(5), 24, (1, 2, 12, 24), True),
    "chaotic-seed2": (lambda: chaotic_city(2), 48, (0, 1, 12, 48), False),
    "seed9-lone-market": (lambda: lone_market(9), 48, (0, 48), False),
}


def digest(state):
    """SHA-256 of each compared field, as canonical JSON."""
    canon = lambda v: json.dumps(v, sort_keys=True, separators=(",", ":")).encode()  # noqa: E731
    return {f: hashlib.sha256(canon(state[f])).hexdigest() for f in FIELDS}


def run(case):
    start, ticks, checkpoints, marked = CASES[case]
    state, out, kinds = start(), {}, set()
    for _ in range(ticks + 1):
        if state["tick"] in checkpoints:
            out[str(state["tick"])] = digest(state)
        if state["tick"] == ticks:
            break
        state, events = step(state, visitor_marks(state) if marked else [], tick_rng(state))
        kinds.update(e["kind"] for e in events)
    return out, sorted(kinds)


@cache
def current():
    return {case: run(case) for case in CASES}


def recorded():
    if not GOLDEN.exists():
        pytest.fail(f"no golden outputs for SIM_VERSION {R.SIM_VERSION}: record them with "
                    "`uv run python -m tests.test_golden --write` (ADR-0013)")  # fmt: skip
    return json.loads(GOLDEN.read_text())


def python_version():
    return f"{sys.version_info.major}.{sys.version_info.minor}"


@pytest.mark.parametrize("case", CASES)
def test_simulation_matches_its_golden_outputs(case):
    golden = recorded()
    assert golden["sim"] == R.SIM_VERSION
    outputs, _ = current()[case]
    wrong = [
        f"tick {tick} {field}"
        for tick, fields in golden["cases"][case].items()
        for field, sha in fields.items()
        if outputs[tick][field] != sha
    ]
    assert not wrong, (
        f"{case}: {', '.join(wrong)} differ from SIM_VERSION {R.SIM_VERSION} "
        f"(recorded on Python {golden['python']}, running {python_version()}). If the change is "
        "intended, bump SIM_VERSION and record new outputs (ADR-0013)."
    )


def test_golden_cases_cover_every_event_kind():
    kinds = set().union(*(kinds for _, kinds in current().values()))
    assert kinds == set(R.EVENT_KINDS)


@pytest.mark.parametrize(
    "name, value, case, tick",
    [
        ("START_HOUSE_CHANCE", 0.5, "seed7-day", "0"),  # the starting city
        ("GROWTH", R.GROWTH + 1, "seed7-day", "12"),  # a per-tick rule
        ("BUILD_CHANCE", R.BUILD_CHANCE * 2, "seed3-day", "96"),
        ("REDEVELOP_CHANCE", R.REDEVELOP_CHANCE * 3, "chaotic-seed2", "48"),
    ],
)
def test_golden_outputs_catch_a_rule_change(monkeypatch, name, value, case, tick):
    golden = recorded()["cases"][case][tick]
    monkeypatch.setattr(R, name, value)
    outputs, _ = run(case)
    assert outputs[tick] != golden


def write(force=False):
    if GOLDEN.exists() and not force:
        sys.exit(f"{GOLDEN} exists: a released version's outputs never change. Bump SIM_VERSION.")
    data = {
        "sim": R.SIM_VERSION,
        "python": python_version(),
        "fields": list(FIELDS),
        "cases": {case: outputs for case, (outputs, _) in current().items()},
    }
    GOLDEN.parent.mkdir(exist_ok=True)
    GOLDEN.write_text(json.dumps(data, indent=1) + "\n")
    print(f"wrote {GOLDEN}")


if __name__ == "__main__":
    if "--write" not in sys.argv:
        sys.exit("usage: uv run python -m tests.test_golden --write")
    write(force="--force" in sys.argv)
