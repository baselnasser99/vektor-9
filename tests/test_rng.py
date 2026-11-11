import random
import re
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from sim import rng
from sim.rng import _below, choice, randint, randrange, sample

seeds = st.integers(0, 2**32)


class Fixed:
    """A generator whose random() always returns `value`."""

    def __init__(self, value):
        self.value = value

    def random(self):
        return self.value


def test_below_stays_under_n_even_if_random_reaches_one():
    assert _below(Fixed(0.0), 5) == 0
    assert _below(Fixed(0.999999), 5) == 4
    assert _below(Fixed(1.0), 5) == 4  # the n - 1 guard
    assert _below(Fixed(1.0), 1) == 0


@given(seeds, st.integers(-50, 50), st.integers(0, 50))
def test_randint_includes_both_ends_and_nothing_else(seed, a, width):
    r = random.Random(seed)
    values = {randint(r, a, a + width) for _ in range(200)}
    assert min(values) >= a and max(values) <= a + width
    assert randint(Fixed(0.0), a, a + width) == a
    assert randint(Fixed(1.0), a, a + width) == a + width


@given(seeds, st.integers(-30, 30), st.integers(-30, 30), st.integers(-5, 5).filter(bool))
def test_randrange_draws_from_the_range(seed, start, stop, step):
    span = range(start, stop, step)
    if not span:
        with pytest.raises(ValueError):
            randrange(random.Random(seed), start, stop, step)
        return
    r = random.Random(seed)
    assert all(randrange(r, start, stop, step) in span for _ in range(50))
    assert randrange(Fixed(0.0), start, stop, step) == span[0]
    assert randrange(Fixed(1.0), start, stop, step) == span[-1]


@given(seeds, st.integers(0, 30), st.integers(0, 30))
def test_sample_has_no_repeats(seed, n, k):
    population = list(range(n))
    if k > n:
        with pytest.raises(ValueError):
            sample(random.Random(seed), population, k)
        return
    got = sample(random.Random(seed), population, k)
    assert len(got) == k == len(set(got)) and set(got) <= set(population)
    assert population == list(range(n))  # the input is not shuffled


@pytest.mark.parametrize(
    "name, args, kwargs, error",
    [
        ("randrange", (0,), {}, ValueError),
        ("randrange", (-3,), {}, ValueError),
        ("randrange", (5, 5), {}, ValueError),
        ("randrange", (0, 10, 0), {}, ValueError),
        ("randrange", (2.5,), {}, TypeError),
        ("randrange", (0, 2.5), {}, TypeError),
        ("randrange", (10,), {"step": 2}, TypeError),
        ("randint", (3, 2), {}, ValueError),
        ("randint", (1.5, 3), {}, TypeError),
        ("choice", ([],), {}, IndexError),
        ("sample", ({1, 2, 3}, 2), {}, TypeError),
        ("sample", ([1, 2, 3], 4), {}, ValueError),
        ("sample", ([1, 2, 3], -1), {}, ValueError),
        ("sample", ([1, 2, 3], 1.0), {}, TypeError),
    ],
)
def test_bad_arguments_raise_what_the_standard_library_raises(name, args, kwargs, error):
    with pytest.raises(error):
        getattr(rng, name)(random.Random(0), *args, **kwargs)
    with pytest.raises(error):
        getattr(random.Random(0), name)(*args, **kwargs)


def test_outputs_are_frozen_for_a_fixed_seed():
    """The exact draws for one seed. If this changes, every city changes: bump SIM_VERSION."""
    r = random.Random("vektor-9:rng")
    assert [randint(r, 1, 6) for _ in range(8)] == [4, 3, 6, 6, 6, 2, 4, 1]
    assert [randrange(r, 10, 100, 7) for _ in range(5)] == [10, 31, 87, 31, 87]
    assert [choice(r, "abcdef") for _ in range(5)] == ["d", "b", "a", "a", "d"]
    assert sample(r, range(20), 6) == [14, 7, 3, 8, 11, 18]


def test_the_simulation_draws_only_through_random():
    """In sim/, a generator is only seeded and asked for random(); everything else goes through
    sim/rng.py (ADR-0013)."""
    calls = re.compile(r"\b(?:rng|r)\.(\w+)\(")
    bad = [
        f"{path}: rng.{method}()"
        for path in sorted(Path("sim").glob("*.py"))
        for method in calls.findall(path.read_text(encoding="utf-8"))
        if method not in ("random", "seed")
    ]
    assert not bad
