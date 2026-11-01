import gzip
import json
import random

from hypothesis import given, settings
from hypothesis import strategies as st

from sim import rules as R
from sim.__main__ import main
from sim.state import apply_power, new_city, new_tile, validate
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
        target = rng.randint(1, R.FLOORS[1]) if kind in ("build", "house") else 0
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
