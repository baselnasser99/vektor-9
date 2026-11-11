"""Random draws built only on random.Random.random() (ADR-0013).

Python promises to keep two things the same across versions: seeding (string and integer seeds)
and the sequence random() returns. randint, randrange, choice and sample are built on top and may
change how they turn the generator's bits into results, so the simulation uses these instead. Each
takes the random.Random as its first argument and raises what the standard library raises for bad
arguments.
"""

from collections.abc import Sequence


def _below(r, n):
    """An int in [0, n) for a positive int n, from one call to r.random()."""
    return min(int(r.random() * n), n - 1)  # the guard: r.random() * n may round up to n


def randrange(r, start, stop=None, step=1):
    """Like random.randrange: an int from range(start, stop, step), or range(start) alone."""
    if stop is None:
        if step != 1:
            raise TypeError("Missing a non-None stop argument")
        span = range(start)  # TypeError for anything but an int
    else:
        span = range(start, stop, step)  # TypeError for non-ints, ValueError for a zero step
    if not span:
        raise ValueError(f"empty range in randrange({start}, {stop}, {step})")
    return span[_below(r, len(span))]


def randint(r, a, b):
    """Like random.randint: an int in [a, b], both ends included."""
    return randrange(r, a, b + 1)


def choice(r, seq):
    """Like random.choice: one element of a non-empty sequence."""
    if not len(seq):
        raise IndexError("Cannot choose from an empty sequence")
    return seq[_below(r, len(seq))]


def sample(r, population, k):
    """Like random.sample: k distinct elements of a sequence, in selection order (a partial
    Fisher-Yates shuffle of a copy)."""
    if not isinstance(population, Sequence):
        raise TypeError("Population must be a sequence. For dicts or sets, use sorted(d).")
    pool, n = list(population), len(population)
    if not isinstance(k, int):
        raise TypeError(f"k must be an int, not {type(k).__name__}")
    if not 0 <= k <= n:
        raise ValueError("Sample larger than population or is negative")
    for i in range(k):
        j = i + _below(r, n - i)
        pool[i], pool[j] = pool[j], pool[i]
    return pool[:k]
