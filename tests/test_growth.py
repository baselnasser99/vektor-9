"""Growth weighted by frontage and distance from the centre (ADR-0015, SIM_VERSION 4)."""

import gzip
import json
from pathlib import Path

import pytest

from sim import rules as R
from sim.state import new_city, validate, xy
from sim.step import RINGS, built_percent, height_cap, resume_error, step, tick_rng, weights
from tests.test_golden import NEUTRAL

FIXTURES = Path(__file__).parent / "fixtures"


def fixture(seed):
    return json.loads(gzip.decompress((FIXTURES / f"sim-v3-seed{seed}-t288.json.gz").read_bytes()))


def houses(floors):
    """Every tile a house of `floors` floors, so height_cap sees that neighbors' average."""
    return [{"k": "house", "f": floors}] * R.SIZE**2


@pytest.mark.parametrize("seed", [7, 3])
def test_version_3_fixtures_continue_under_version_4(seed):
    """ADR-0013's cross-version continuation: a snapshot from older rules validates, this code may
    continue it, and every tick after it records the new version. The plan never changes."""
    state = fixture(seed)
    assert (state["schema"], state["sim"], state["tick"]) == (R.SCHEMA, 3, 288)
    assert validate(state) == [] and resume_error(state) is None
    plan = state["plan"]
    for _ in range(12):
        state, _ = step(state, [], tick_rng(state))
        assert validate(state) == [] and state["sim"] == R.SIM_VERSION == 4
        assert state["plan"] == plan


class Counting:
    """A stand-in rng that always returns one value and counts its draws (sim/rng.py builds every
    draw on random() alone)."""

    def __init__(self, value):
        self.value, self.draws = value, 0

    def random(self):
        self.draws += 1
        return self.value


@pytest.mark.parametrize(
    "state, value", [(new_city(7), 0.0), (fixture(7), 0.999), (fixture(3), 0.999)]
)
def test_weights_add_no_draws(monkeypatch, state, value):
    """The weights change thresholds and ranges, never the number of draws. With every draw fixed
    at 0.0 (every chance taken) or 0.999 (none taken), both settings take the same branches, so a
    tick must make the same number of draws under the real and the neutral weights. (With 0.0 on a
    grown city, the envelope may decide a redevelopment differently, and that changes the draws
    legitimately, so new_city stands in: no sector there is busy enough to redevelop.)"""
    if value == 0.0:
        assert max(built_percent(state["tiles"]).values()) < R.REDEVELOP_BUILT
    real = Counting(value)
    step(state, [], real)
    for name, v in NEUTRAL.items():
        monkeypatch.setattr(R, name, v)
    neutral = Counting(value)
    step(state, [], neutral)
    assert real.draws == neutral.draws > 0


def test_frontage_weights_point_to_the_backbone():
    """A tile on the boulevard builds sooner and taller than one on an arterial, which beats one off
    the backbone, at the same distance from the centre."""
    w = weights(new_city(7)["plan"])
    # Ring 18, in column 5: row 23 faces the boulevard, row 39 the arterial at 40, row 30 neither.
    rows = (23, 39, 30)
    assert {RINGS[y * R.SIZE + 5] for y in rows} == {18}
    boulevard, arterial, minor = (w[y * R.SIZE + 5] for y in rows)
    assert (boulevard[0], arterial[0], minor[0]) == (1, R.ARTERIAL_SHARE, R.MINOR_SHARE)
    assert boulevard[2] > arterial[2] > minor[2]
    for avg in (0, 10, 30, 60):
        tiles = houses(avg)
        caps = [height_cap(5, y, tiles, w[y * R.SIZE + 5]) for y in rows]
        assert caps == sorted(caps, reverse=True)


@pytest.mark.parametrize("avg", [0, 4, 12, 30, 60])
def test_the_envelope_bounds_every_cap(avg):
    """Every cap lies between FLOORS_MIN + 2 and FLOORS_MAX, under the envelope, and the envelope
    falls toward the edge: at the edge ring, EDGE_FLOORS plus the frontage floors, about."""
    plan, tiles = new_city(7)["plan"], houses(avg)
    w = weights(plan)
    for i, (f, c, _) in enumerate(w):
        x, y = xy(i)
        cap = height_cap(x, y, tiles, w[i])
        envelope = R.EDGE_FLOORS + int((R.FLOORS_MAX - R.EDGE_FLOORS) * c) + int(R.FRONT_FLOORS * f)
        assert R.FLOORS_MIN + 2 <= cap <= min(R.FLOORS_MAX, envelope)
        if RINGS[i] == 23:
            assert cap <= R.EDGE_FLOORS + R.FRONT_FLOORS + 1
    # Off the backbone, the envelope never rises from one ring to the next going out.
    off = {RINGS[i]: R.EDGE_FLOORS + int((R.FLOORS_MAX - R.EDGE_FLOORS) * c)
           for i, (f, c, _) in enumerate(w) if f == R.MINOR_SHARE}  # fmt: skip
    assert [off[r] for r in sorted(off)] == sorted(off.values(), reverse=True)


def test_the_centre_grows_taller_than_the_edge():
    """ADR-0015's short-horizon property: seed 7 after three days, the median floors of houses in
    bands 0-7 exceed those of bands 16-23."""
    state = new_city(7)
    for _ in range(3 * R.TICKS_PER_DAY):
        state, _ = step(state, [], tick_rng(state))
    floors = lambda lo, hi: sorted(  # noqa: E731
        t["f"] for i, t in enumerate(state["tiles"]) if t["k"] == "house" and lo <= RINGS[i] <= hi
    )
    inner, outer = floors(0, 7), floors(16, 23)
    assert inner and outer
    assert inner[len(inner) // 2] > outer[len(outer) // 2]
