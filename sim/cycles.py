"""Time-based patterns derived from the seed and tick alone, so they need no stored state."""

import random

from sim import rules as R


def blackout_starts(seed, day):
    """Slots (ticks into the day) where the day's blackouts begin.

    Windows stay BLACKOUT_GAP // 2 away from the day's edges, so the gap also holds across midnight.
    """
    rng = random.Random(f"{seed}:blackouts:{day}")
    edge = R.BLACKOUT_GAP // 2
    n = R.BLACKOUTS_PER_DAY
    slack = R.TICKS_PER_DAY - 2 * edge - n * R.BLACKOUT_TICKS - (n - 1) * R.BLACKOUT_GAP
    cuts = sorted(rng.randint(0, slack) for _ in range(n))
    return [edge + cut + k * (R.BLACKOUT_TICKS + R.BLACKOUT_GAP) for k, cut in enumerate(cuts)]


def blackout_window(seed, tick):
    """(in_window, is_first_tick) for a tick."""
    day, slot = divmod(tick, R.TICKS_PER_DAY)
    for start in blackout_starts(seed, day):
        if start <= slot < start + R.BLACKOUT_TICKS:
            return True, slot == start
    return False, False


def wave(seed, sector, tick):
    """A sector's boom-and-decline level in [-100, 100], a slow triangle wave.

    Integer math only, so it is identical on every machine.
    """
    rng = random.Random(f"{seed}:wave:{sector}")
    period = R.WAVE_PERIOD + rng.randint(-R.WAVE_JITTER, R.WAVE_JITTER)
    pos = (tick + rng.randrange(period)) % period
    half = period // 2
    up = pos if pos < half else period - pos
    return 200 * up // half - 100
