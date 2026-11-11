"""T22: the due tick, the configuration, and importing the handler without boto3."""

import subprocess
import sys

import pytest

from lambdas.store_memory import MemoryStore
from lambdas.tick import ConfigError, FailClosed, due_tick, iso, load_config
from tests.tick_helpers import GENESIS, at, run

G = GENESIS


@pytest.mark.parametrize(
    "now, scheduled, due",
    [
        (G, G, 0),  # genesis exactly
        (G + 299, G, 0),  # one second before the next boundary
        (G + 300, G + 300, 1),  # on the boundary
        (G + 301, G + 300, 1),  # one second after
        (G + 300, G + 299, 0),  # a slot one second early belongs to the slot before
        (G + 299.9, None, 0),  # the clock alone, fractional
        (G + 600, None, 2),
        (G - 1, None, -1),  # before genesis
        (G - 1, G - 1, -1),
        (G - 300, G, -1),  # scheduled at genesis, clock still before it
        (G + 900, G + 3000, 3),  # scheduled time in the future: clamped to the clock
        (G + 3000, G + 900, 3),  # late delivery: the slot it belongs to
    ],
)
def test_t22_due_tick(now, scheduled, due):
    assert due_tick(G, now, scheduled) == due


@pytest.mark.parametrize(
    "scheduled",
    [
        "yesterday",
        "2027-01-15T08:00:00",  # no offset
        "2027-01-15T10:00:00+02:00",  # not UTC
        "",
        12345,
        ["2027-01-15T08:00:00Z"],
    ],
)
def test_t22_malformed_scheduled_time_fails_closed_without_writes(scheduled):
    store, lines = MemoryStore(), []
    with pytest.raises(FailClosed) as e:
        run(store, 1, scheduled=scheduled, lines=lines)
    assert e.value.reason == "bad_scheduled_time"
    assert not store.objects and lines[0]["PublishFailures"] == 1


def test_t22_missing_scheduled_time_uses_the_clock():
    store = MemoryStore()
    assert run(store, 0, scheduled=None)["due"] == 0
    assert run(store, 0, scheduled=None, now=at(3) + 1)["due"] == 3


def test_t22_scheduled_time_formats():
    store = MemoryStore()
    run(store, 0)
    assert run(store, 0, scheduled=iso(at(1)).replace("Z", "+00:00"), now=at(1))["due"] == 1


ENV = {"VEKTOR9_SEED": "7", "VEKTOR9_GENESIS": "2027-01-15T08:00:00Z", "VEKTOR9_STAGE": "dev"}


def test_config_parses():
    config = load_config(ENV)
    assert (config.seed, config.genesis, config.stage) == (7, G, "dev")
    assert load_config({**ENV, "VEKTOR9_GENESIS": "2027-01-15T08:00:00+00:00"}) == config


@pytest.mark.parametrize(
    "key, value",
    [
        ("VEKTOR9_GENESIS", "2027-01-15T08:00:01Z"),  # one second off the boundary
        ("VEKTOR9_GENESIS", "2027-01-15T08:01:00Z"),
        ("VEKTOR9_GENESIS", "2027-01-15T08:00:00.5Z"),
        ("VEKTOR9_GENESIS", "2027-01-15T08:00:00"),  # no offset
        ("VEKTOR9_GENESIS", "2027-01-15T09:00:00+01:00"),  # the same instant, not written in UTC
        ("VEKTOR9_GENESIS", None),
        ("VEKTOR9_SEED", "-1"),
        ("VEKTOR9_SEED", "seven"),
        ("VEKTOR9_SEED", " 7"),
        ("VEKTOR9_SEED", None),
        ("VEKTOR9_STAGE", ""),
    ],
)
def test_config_rejects(key, value):
    env = {k: v for k, v in {**ENV, key: value}.items() if v is not None}
    with pytest.raises(ConfigError):
        load_config(env)


def test_handler_imports_without_boto3():
    """`python -c "import lambdas.tick"` with boto3 blocked, and nothing imports it."""
    code = (
        "import sys; sys.modules['boto3'] = None; sys.modules['botocore'] = None\n"
        "import lambdas.tick, lambdas.store_memory, lambdas.store_s3\n"
        "assert sys.modules['boto3'] is None and sys.modules['botocore'] is None\n"
    )
    subprocess.run([sys.executable, "-c", code], check=True)
