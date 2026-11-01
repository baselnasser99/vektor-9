Pre-PR check for the current Vektor-9 branch. Don't open the PR, commit, or deploy.

1. `git diff --stat main...HEAD`: confirm it's one focused change; suggest splitting if not.
2. Run tests, lint, and `cdk synth` if `infra/` changed. Report each as pass / fail / not run (why).
3. Quick cleanup pass: duplication, dead code, unclear names. Fix or suggest, then rerun tests.
4. Answer briefly for this diff:
   - What could break? (sim determinism, invariants, tick failure)
   - What could be abused? (mark validation, throttling, IAM permissions)
   - What could cost money? (new resources, log retention, data growth)
5. Confirm the rules in `CLAUDE.md` still hold.
6. Draft the PR description from `.github/pull_request_template.md` with real results only.

$ARGUMENTS
