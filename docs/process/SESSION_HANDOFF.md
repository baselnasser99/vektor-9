# Session handoff | Vektor-9

A handoff lets a fresh Claude Code session (or you, weeks later) pick up without guessing. It complements Claude Code's built-in compaction: compaction keeps one session going; a handoff survives a new session or machine.

## When

- At a natural checkpoint (feature done, before a big change).
- When context runs low or the session is ending with work in progress.
- When you run `/handoff`.

## What

Overwrite **`docs/handoffs/CURRENT.md`** (keep it under ~50 lines). PR descriptions, ADRs, and git history are the long-term record, so don't duplicate them here.

```md
# Current handoff | Vektor-9

Updated: YYYY-MM-DD HH:MM (TZ)
Milestone: M_ — short title
Branch: `name` @ `short-sha` (verified)
Working tree: clean | dirty (list paths)

## Done this session (verified)
- ...

## In progress / not done
- ...

## Checks
- Tests: `command` → pass / fail / not run (why)
- CDK synth: pass / fail / not run
- Deployed: yes (what) / no

## Decisions
- Decision and reason (link ADR if written)

## Next
1. Smallest next step.
```

## Rules

- Inspect real state (`git status`, `git log`) before writing; never rely on memory.
- If the tree is dirty, list every changed path and ask whether to make a WIP commit. Don't commit on your own.
- Handoff updates are docs-only commits on `main`, pushed only with the owner's approval. Local `main` tracks `origin/main` exactly: no local-only commits.
- No secrets, AWS account IDs, or personal data in handoff notes.
- If files can't be written, print the handoff in chat and say clearly it was not saved.
