# Current handoff | Vektor-9

Updated: 2026-11-02
Milestone: M0a, foundation (done locally, nothing committed yet)
Branch: main (no commits, no remote)
Working tree: everything untracked

## Done
- Planning: `PROJECT_PLAN.md`, `docs/STYLE_GUIDE.md`, ADR-0001, ADR-0002.
- Custom command `/resume` renamed to `/pickup` (clashed with the built-in).
- `git init -b main`, `.gitignore`.
- Python project with uv: `pyproject.toml`, `uv.lock`, `.python-version` (3.13). Dev deps: pytest, hypothesis, ruff.
- `sim/` package stub and `tests/test_smoke.py`.
- `.github/workflows/ci.yml`: uv sync, ruff check, ruff format --check, pytest.
- Commands section of `CLAUDE.md` filled in.

## Not done
- First commit, GitHub repo, push. CI has never run on GitHub.

## Checks
- Tests: `uv run pytest`, 1 passed (local, 2026-11-02)
- Lint: `ruff check` and `ruff format --check` clean (local)
- CDK synth: n/a
- Deployed: no

## Next
1. First commit, create the GitHub repo, push, confirm CI goes green.
2. Start M0b: simulation package and snapshot schema (ADR-0003).
