import gzip
import json
import random
from pathlib import Path

import pytest
from hypothesis import example, given, settings
from hypothesis import strategies as st

from sim import rules as R
from sim.__main__ import main
from sim.cycles import blackout_starts, wave
from sim.rng import choice, randint, randrange
from sim.state import (
    apply_power,
    chebyshev,
    counter,
    hub_plaza,
    interchange,
    load,
    new_city,
    new_tile,
    power_grid,
    validate,
    xy,
)
from sim.step import mark_error, resume_error, step, tick_rng

seeds = st.integers(0, 2**32)
coords = st.integers(0, R.SIZE - 1)
marks = st.lists(
    st.fixed_dictionaries(
        {
            "id": st.sampled_from(["a", "b", "c", "d"]),
            "kind": st.just("commission"),
            "x": coords,
            "y": coords,
        }  # fmt: skip
    ),
    max_size=5,
)
junk = st.recursive(
    st.none() | st.booleans() | st.integers() | st.text(max_size=5),
    lambda inner: st.lists(inner, max_size=3) | st.dictionaries(st.text(max_size=4), inner),
    max_leaves=8,
)


def random_city(seed):
    """Any mix of tiles in any valid state, to push the rules past what new_city() makes."""
    rng = random.Random(seed)
    tiles = []
    for _ in range(R.SIZE * R.SIZE):
        kind = choice(rng, R.KINDS)
        target = randint(rng, 1, R.FLOORS_MAX) if kind in ("build", "house") else 0
        floors = randrange(rng, target) if kind == "build" else target
        people = randint(rng, 0, floors * R.PEOPLE_PER_FLOOR * 2) if kind == "house" else 0
        tiles.append(new_tile(kind, rng, floors, target, people))
    city = new_city(seed)
    return {**city, "tiles": tiles, "power": apply_power(tiles)}


def roundtrip(state):
    return json.loads(json.dumps(state))


def test_new_city_is_valid_and_small():
    city = new_city(7)
    assert validate(city) == []
    assert len(gzip.compress(json.dumps(city, separators=(",", ":")).encode())) < 100_000


@settings(max_examples=25, deadline=None)
@given(seeds, st.lists(marks, max_size=8), st.booleans())
def test_invariants_hold_every_tick(seed, mark_batches, chaotic):
    state = random_city(seed) if chaotic else new_city(seed)
    assert validate(state) == []
    for batch in mark_batches:
        state, events = step(state, batch, tick_rng(state))
        assert validate(state) == []
        assert state["events"] == events


@settings(max_examples=15, deadline=None)
@given(seeds, marks, st.integers(0, 5))
def test_replay_from_snapshot_is_deterministic(seed, batch, warmup):
    state = new_city(seed)
    for _ in range(warmup):
        state, _ = step(state, [], tick_rng(state))
    snapshot = roundtrip(state)
    first, _ = step(snapshot, batch, tick_rng(snapshot))
    again, _ = step(roundtrip(state), batch, tick_rng(snapshot))
    assert first == again
    assert roundtrip(first) == first


def test_step_does_not_mutate_input():
    state = new_city(3)
    before = roundtrip(state)
    step(state, [{"id": "m", "kind": "commission", "x": 0, "y": 0}], tick_rng(state))
    assert state == before


def test_mark_applied_at_most_once():
    state = new_city(1)
    i = next(i for i, t in enumerate(state["tiles"]) if t["k"] == "lot")
    mark = {"id": "visitor-1", "kind": "commission", "x": i % R.SIZE, "y": i // R.SIZE}
    state, events = step(state, [mark, dict(mark)], tick_rng(state))
    assert [e["kind"] for e in events].count("commissioned") == 1
    assert state["tiles"][i]["k"] in ("build", "house")
    state["tiles"][i] = new_tile("lot", random.Random(0))  # lot is free again
    state, events = step(state, [mark], tick_rng(state))
    assert "commissioned" not in [e["kind"] for e in events]


def test_mark_on_occupied_tile_is_ignored():
    state = new_city(1)
    i = next(i for i, t in enumerate(state["tiles"]) if t["k"] == "plant")
    mark = {"id": "m", "kind": "commission", "x": i % R.SIZE, "y": i // R.SIZE}
    state, events = step(state, [mark], tick_rng(state))
    assert state["tiles"][i]["k"] == "plant"
    assert "commissioned" not in [e["kind"] for e in events]


@given(junk)
def test_malformed_marks_are_rejected_not_crashing(mark):
    if mark_error(mark) is None:
        return
    state = new_city(2)
    new_state, _ = step(state, [mark], tick_rng(state))
    assert new_state["mark_ids"] == []


def test_mark_error_cases():
    ok = {"id": "m", "kind": "commission", "x": 0, "y": 47}
    assert mark_error(ok) is None
    for bad in ({**ok, "id": ""}, {**ok, "id": "x" * 65}, {**ok, "kind": "nuke"},
                {**ok, "x": 48}, {**ok, "y": -1}, {**ok, "x": True}, {**ok, "x": 1.0}):  # fmt: skip
        assert mark_error(bad), bad


def test_validate_catches_broken_snapshots():
    city = new_city(5)
    assert validate({**city, "size": 47})
    assert validate({**city, "tiles": city["tiles"][:-1]})
    assert validate({**city, "power": {"capacity": 1, "demand": 9, "supplied": 2}})
    tiles = [dict(t) for t in city["tiles"]]
    tiles[0].update(k="build", f=5, t=3)
    assert validate({**city, "tiles": tiles})
    tiles[0].update(k="castle", f=0, t=0)
    assert validate({**city, "tiles": tiles})


def test_snapshots_record_schema_and_simulation_version():
    city = new_city(4)
    after, _ = step(city, [], tick_rng(city))
    for state in (city, after, roundtrip(after)):
        assert (state["schema"], state["sim"]) == (R.SCHEMA, R.SIM_VERSION)
        assert validate(state) == []


def test_validate_checks_the_simulation_version():
    city = new_city(6)
    without = {k: v for k, v in city.items() if k != "sim"}
    for bad in (without, {**city, "sim": 0}, {**city, "sim": True}, {**city, "sim": "1"},
                {**city, "schema": 4}):  # fmt: skip
        assert validate(bad), bad
    assert validate({**city, "sim": R.SIM_VERSION + 1}) == []  # well formed, just not ours to run


def test_step_refuses_snapshots_it_must_not_advance():
    city = new_city(6)
    schema4 = {k: v for k, v in city.items() if k != "sim"} | {"schema": 4}  # like snapshots/
    for state in (schema4, {**city, "sim": R.SIM_VERSION + 1}, {**city, "sim": 0}):
        assert resume_error(state)
        with pytest.raises(ValueError, match="cannot advance"):
            step(state, [], tick_rng(state))
    assert resume_error(city) is None


def test_newer_rules_continue_an_older_version_and_say_so(monkeypatch):
    older = new_city(6)
    monkeypatch.setattr(R, "SIM_VERSION", R.SIM_VERSION + 1)
    assert resume_error(older) is None
    after, _ = step(older, [], tick_rng(older))
    assert (older["sim"], after["sim"]) == (R.SIM_VERSION - 1, R.SIM_VERSION)


def test_this_version_continues_a_version_1_snapshot():
    """A snapshot made by version 1 (tests/fixtures, seed 7 at tick 288) is valid, may be
    continued, and every tick after it is labelled with this version."""
    path = Path(__file__).parent / "fixtures" / "sim-v1-seed7-t288.json.gz"
    state = json.loads(gzip.decompress(path.read_bytes()))
    assert (state["schema"], state["sim"], state["tick"]) == (5, 1, 288)
    assert validate(state) == [] and resume_error(state) is None
    for _ in range(10):
        state, _ = step(state, [], tick_rng(state))
        assert state["sim"] == R.SIM_VERSION and validate(state) == []
    assert state["tick"] == 298


def test_rules_version_is_independent_of_the_schema(monkeypatch):
    older = new_city(8)
    expected, _ = step(older, [], tick_rng(older))
    monkeypatch.setattr(R, "SIM_VERSION", R.SIM_VERSION + 1)
    newer, _ = step(older, [], tick_rng(older))
    assert validate(older) == [] and validate(newer) == []  # an older version stays valid
    assert (newer["schema"], newer["sim"]) == (R.SCHEMA, R.SIM_VERSION)  # schema unchanged
    assert {**newer, "sim": expected["sim"]} == expected  # the label never changes the city


def test_cli_writes_valid_snapshots(tmp_path, capsys):
    main(["--ticks", "3", "--seed", "4", "--out", str(tmp_path)])
    files = sorted(tmp_path.glob("*.json"))
    assert [f.name for f in files] == [f"{n:06d}.json" for n in range(4)]
    assert all(validate(json.loads(f.read_text())) == [] for f in files)
    assert "tick 3" in capsys.readouterr().out


@given(seeds, st.integers(0, 10_000))
def test_blackout_schedule_keeps_its_spacing(seed, day):
    today = blackout_starts(seed, day)
    assert len(today) == R.BLACKOUTS_PER_DAY
    assert all(0 <= s and s + R.BLACKOUT_TICKS <= R.TICKS_PER_DAY for s in today)
    starts = [s + day * R.TICKS_PER_DAY for s in today]
    starts += [s + (day + 1) * R.TICKS_PER_DAY for s in blackout_starts(seed, day + 1)]
    for a, b in zip(starts, starts[1:], strict=False):
        assert b - (a + R.BLACKOUT_TICKS) >= R.BLACKOUT_GAP


def test_a_day_has_three_half_hour_blackouts():
    state = new_city(7)
    blackouts, runs, run = 0, [], 0
    for _ in range(R.TICKS_PER_DAY):
        state, events = step(state, [], tick_rng(state))
        blackouts += [e["kind"] for e in events].count("blackout")
        if any(t["k"] == "plant" and not t["on"] for t in state["tiles"]):
            run += 1
        elif run:
            runs, run = runs + [run], 0
    assert blackouts == R.BLACKOUTS_PER_DAY
    assert runs == [R.BLACKOUT_TICKS] * R.BLACKOUTS_PER_DAY


def test_replay_mid_blackout_keeps_the_same_plant_dark():
    state = new_city(7)
    start = blackout_starts(7, 0)[0]
    for _ in range(start + 1):
        state, _ = step(state, [], tick_rng(state))
    dark = [i for i, t in enumerate(state["tiles"]) if t["k"] == "plant" and not t["on"]]
    assert dark
    snapshot = roundtrip(state)
    first, _ = step(snapshot, [], tick_rng(snapshot))
    again, _ = step(roundtrip(state), [], tick_rng(snapshot))
    assert first == again
    assert not first["tiles"][dark[0]]["on"]


def overloaded_city():
    """New city (next tick is never in a blackout window), one house drawing full capacity."""
    state = new_city(7)
    tiles = [dict(t) for t in state["tiles"]]
    house = next(i for i, t in enumerate(tiles) if t["k"] == "house")
    tiles[house]["p"] = R.PLANT_CAPACITY
    return {**state, "tiles": tiles, "power": apply_power(tiles)}, house


def test_overloaded_plant_keeps_power_but_stops_growth(monkeypatch):
    monkeypatch.setattr(R, "PLANT_BUILD_CHANCE", 0)
    state, house = overloaded_city()
    new, events = step(state, [], tick_rng(state))
    assert "blackout" not in [e["kind"] for e in events]
    for old_t, new_t in zip(state["tiles"], new["tiles"], strict=True):
        assert new_t["on"] == old_t["on"]
        if old_t["k"] == "lot":
            assert new_t["k"] in ("lot", "market")
        if old_t["k"] == "house" and new_t["k"] == "house":
            assert new_t["p"] <= old_t["p"]


def test_strained_plant_gets_a_new_plant_at_the_edge(monkeypatch):
    monkeypatch.setattr(R, "PLANT_BUILD_CHANCE", 1.0)
    state, _ = overloaded_city()
    tiles = state["tiles"]
    px, py = xy(next(i for i, t in enumerate(tiles) if t["k"] == "plant"))
    edge = (py + R.PLANT_SPACING) * R.SIZE + px  # a house past the spacing, so there's a spot by it
    tiles[edge] = new_tile("house", random.Random(0), 3, 3, 0)
    new, events = step(state, [], tick_rng(state))
    opened = [e for e in events if e["kind"] == "plant_opened"]
    assert len(opened) == 1
    x, y = opened[0]["x"], opened[0]["y"]
    assert new["tiles"][y * R.SIZE + x]["k"] == "plant"
    assert R.PLANT_SPACING <= chebyshev(x, y, px, py) <= R.PLANT_REACH


def test_new_city_starts_small_in_the_center():
    city = new_city(7)
    c = R.SIZE // 2
    built = [xy(i) for i, t in enumerate(city["tiles"]) if t["k"] not in ("lot", *R.TERRAIN)]
    assert [t["k"] for t in city["tiles"]].count("plant") == 1
    assert all(chebyshev(x, y, c, c) <= R.START_RADIUS for x, y in built)


@given(seeds, st.integers(1, (R.SIZE // R.BLOCK) ** 2), st.integers(0, 10**6))
def test_district_wave_is_bounded_and_slow(seed, sector, tick):
    a, b = wave(seed, sector, tick), wave(seed, sector, tick + 1)
    assert -100 <= a <= 100
    assert abs(a - b) <= 1


@settings(max_examples=10, deadline=None)
@given(seeds, st.integers(0, 6))
def test_grid_lookups_match_a_full_scan(seed, radius):
    tiles = random_city(seed)["tiles"]
    houses = [xy(i) for i, t in enumerate(tiles) if t["k"] == "house"]
    plants = [i for i, t in enumerate(tiles) if t["k"] == "plant"]
    count = counter(tiles, "house")
    _, serving, loads = power_grid(tiles)
    for i in range(0, R.SIZE * R.SIZE, 7):
        x, y = xy(i)
        assert count(x, y, radius) == sum(chebyshev(x, y, *h) <= radius for h in houses)
        d = [chebyshev(x, y, *xy(p)) for p in plants]
        best = min(d, default=R.PLANT_RADIUS + 1)
        assert serving[i] == (d.index(best) if best <= R.PLANT_RADIUS else None)
    assert sum(loads) == sum(load(t) for i, t in enumerate(tiles) if serving[i] is not None)


@settings(max_examples=20, deadline=None)
@given(seeds)
@example(110)  # the rail once dipped into the core here and broke in two
def test_new_city_lays_out_terrain_around_the_core(seed):
    tiles = new_city(seed)["tiles"]
    c = R.SIZE // 2
    plaza = set(hub_plaza())
    where = {
        k: [xy(i) for i, t in enumerate(tiles) if t["k"] == k and i not in plaza] for k in R.TERRAIN
    }
    assert all(where[k] for k in R.TERRAIN)
    for k in R.TERRAIN:
        assert all(chebyshev(x, y, c, c) > R.START_RADIUS + 1 for x, y in where[k])
    # The railway is a straight band two tiles wide, parallel to the streets, in one piece (each
    # tile touches the next one by a side) from one edge to a terminus in the outer ring, so the
    # station never stands in the city's middle.
    rail = set(where["rail"])
    assert len(rail) == 2 * R.RAIL_LENGTH
    assert len({x for x, _ in rail}) == 2 or len({y for _, y in rail}) == 2
    last = R.SIZE - 1
    exits = [(x, y) for x, y in rail if x in (0, last) or y in (0, last)]
    assert len(exits) == 2  # one way out, not two
    assert min(chebyshev(x, y, c, c) for x, y in rail) >= c - R.RAIL_LENGTH
    start = next(iter(rail))
    seen, todo = {start}, [start]
    while todo:
        x, y = todo.pop()
        for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if n in rail and n not in seen:
                seen.add(n)
                todo.append(n)
    assert seen == rail


@settings(max_examples=5, deadline=None)
@given(seeds)
def test_terrain_never_changes_and_age_tracks_change(seed):
    state = new_city(seed)
    terrain = {i: dict(t) for i, t in enumerate(state["tiles"]) if t["k"] in R.TERRAIN}
    for n in range(150):
        x, y = xy(next(iter(terrain)) if n % 2 else n * 37 % (R.SIZE * R.SIZE))
        mark = {"id": f"m{n}", "kind": "commission", "x": x, "y": y}
        old = state["tiles"]
        state, _ = step(state, [mark], tick_rng(state))
        for i, t in terrain.items():
            assert {**state["tiles"][i], "on": t["on"]} == t
        for a, b in zip(old, state["tiles"], strict=True):
            changed = (a["k"], a["s"]) != (b["k"], b["s"])  # a new building, or one topped out
            assert b["b"] == (state["tick"] if changed else a["b"])


@settings(max_examples=10, deadline=None)
@given(seeds)
def test_hub_plaza_stays_open_round_the_central_crossing(seed):
    # The tower stands here (renderer); the plaza is park terrain, so nothing is ever built on it.
    state = new_city(seed)
    c, h = R.SIZE // 2, R.HUB_PLAZA
    plaza = hub_plaza()
    assert len(plaza) == (2 * h) ** 2
    assert all(c - h <= x < c + h and c - h <= y < c + h for x, y in map(xy, plaza))
    assert all(state["tiles"][i]["k"] == "park" for i in plaza)
    plants = [xy(i) for i, t in enumerate(state["tiles"]) if t["k"] == "plant"]
    assert plants == [(c + h, c + h)]
    for _ in range(100):
        state, _ = step(state, [], tick_rng(state))
    assert all(state["tiles"][i]["k"] == "park" for i in plaza)


@settings(max_examples=20, deadline=None)
@given(seeds)
def test_interchange_land_is_four_whole_blocks_kept_for_the_highway(seed):
    # The renderer loops the highway's ramps down to the streets here (ADR-0011): four whole blocks
    # of its street grid round one crossing, all of it road, for every seed (so the rail never takes
    # any), and road nowhere else. Nothing is ever built on it.
    state = new_city(seed)
    c, e, b = R.SIZE // 2, R.SIZE - R.BLOCK, R.INTERCHANGE_BLOCK
    land = set(interchange())
    assert len(land) == (2 * b) ** 2
    assert {xy(i) for i in land} == {
        (x, y) for x in range(e - b, e + b) for y in range(c - b, c + b)
    }
    assert R.BLOCK % b == 0 and e % b == 0 and c % b == 0  # its edges are street lines
    road = {i for i, t in enumerate(state["tiles"]) if t["k"] == "road"}
    assert road == land
    for _ in range(50):
        state, _ = step(state, [], tick_rng(state))
    assert {i for i, t in enumerate(state["tiles"]) if t["k"] == "road"} == land
