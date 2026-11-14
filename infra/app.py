"""The CDK app (ADR-0017). Env-agnostic: no account, region or context lookup, so it synthesizes
in CI without credentials. Each stage is synthesized when its context is passed, for example
    cdk synth -c dev.seed=7 -c dev.genesis=2026-12-01T00:00:00Z -c dev.alert_email=...
plus `-c dev.reserved_concurrency=true` when the account quota allows it."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # cdk runs this from infra/

from aws_cdk import App  # noqa: E402

from infra.stack import KEYS, STAGES, CoreStack, stage_config  # noqa: E402


def build(app):
    """A Vektor9-<stage> stack for every stage with context. ValueError if there is none."""
    stages = [s for s in STAGES if any(app.node.try_get_context(f"{s}.{k}") for k in KEYS)]
    if not stages:
        raise ValueError(f"no stage context: pass {STAGES[0]}.seed, .genesis and .alert_email")
    for stage in stages:
        CoreStack(app, f"Vektor9-{stage}", config=stage_config(stage, app.node.try_get_context))
    return app


if __name__ == "__main__":
    build(App()).synth()
