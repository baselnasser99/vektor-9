import gzip
import json
import random

from hypothesis import given, settings
from hypothesis import strategies as st

from sim import rules as R
from sim.__main__ import main
from sim.cycles import blackout_starts, wave
from sim.state import (
    apply_power,
    chebyshev,
    counter,
    load,
    new_city,
    new_tile,
    power_grid,
    validate,
    xy,
)
from sim.step import mark_error, step, tick_rng

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
        kind = rng.choice(R.KINDS)
        target = rng.randint(1, R.FLOORS_MAX) if kind in ("build", "house") else 0
        floors = rng.randrange(target) if kind == "build" else target
        people = rng.randint(0, floors * R.PEOPLE_PER_FLOOR * 2) if kind == "house" else 0
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
    c = R.SIZE // 2
    tiles = state["tiles"]
    edge = (c + R.PLANT_SPACING) * R.SIZE + c  # a house past the spacing, so there's a spot by it
    tiles[edge] = new_tile("house", random.Random(0), 3, 3, 0)
    new, events = step(state, [], tick_rng(state))
    opened = [e for e in events if e["kind"] == "plant_opened"]
    assert len(opened) == 1
    x, y = opened[0]["x"], opened[0]["y"]
    assert new["tiles"][y * R.SIZE + x]["k"] == "plant"
    assert R.PLANT_SPACING <= chebyshev(x, y, c, c) <= R.PLANT_REACH


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
def test_new_city_lays_out_terrain_around_the_core(seed):
    tiles = new_city(seed)["tiles"]
    c = R.SIZE // 2
    where = {k: [xy(i) for i, t in enumerate(tiles) if t["k"] == k] for k in R.TERRAIN}
    assert all(where[k] for k in R.TERRAIN)
    for k in R.TERRAIN:
        assert all(chebyshev(x, y, c, c) > R.START_RADIUS + 1 for x, y in where[k])
    # The railway runs edge to edge in one piece (each tile touches the next one by a side).
    rail = set(where["rail"])
    last = R.SIZE - 1
    sides = {s for x, y in rail for s, hit in (("W", x == 0), ("E", x == last), ("N", y == 0),
             ("S", y == last)) if hit}  # fmt: skip
    assert len(sides) >= 2
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
