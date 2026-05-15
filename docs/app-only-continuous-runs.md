# App-Only Continuous Runs

This project targets Codex App active sessions, not a standalone CLI/local runner.

For no-pause or no-idle requests, the intended behavior is:

1. Stay in the current Codex App thread.
2. Create project-local run state under `.codex/app-active-runs/<run-name>/`.
3. Write `.codex/app-active-runs/current` with the active run name for fast resume.
4. Create learning artifacts in the same run directory:
   `lessons-learned.md`, `improvement-candidates.jsonl`, and
   `promotion-report.md` plus machine-checkable `promotion-report.json`.
5. Keep working in short cycles: inspect, edit, validate, self-review, record
   learning candidates when useful, log, continue.
6. Use read-only reviewer agents for medium and large projects.
7. Treat runs of 1 hour or more as explicit authorization to start at least one
   read-only reviewer subagent after orientation.
8. Stop only when the duration expires, the goal is complete, or an especially
   dangerous human checkpoint is reached.

Heartbeat automations are useful as scheduled wakeups, but they are not permanent
workers and should not be the primary mechanism for no-idle App-only runs.

## Autonomous Learning

The learning loop is designed to improve future runs without adding manual
babysitting:

- Record friction, missed validations, user corrections, and reviewer findings in
  `improvement-candidates.jsonl`.
- Auto-apply only validated low-risk project, prompt, documentation, performance,
  and validation improvements.
- Write high-risk global safety, permission, deploy, publish, delete, secrets, and
  reviewer-policy candidates to `$CODEX_HOME/learning/improvement-backlog.jsonl`
  instead of silently applying them.
- Keep promotion decisions and validation evidence in `promotion-report.md`.
- Keep install result, commit SHA, push result, release URL, and reviewer result in
  `promotion-report.json`.
- For this repository, each promoted learning iteration must also update the
  installed Codex global files, commit the focused diff, and push the update to
  GitHub. Prefer `node scripts/promote-learning.mjs --reviewer-result="<verdict>"`
  so validation, global install, manifest checks, commit, push, tag, release, and
  promotion report generation are deterministic. Versioned public changes also
  update the matching tag and GitHub Release.
- Use `node scripts/summarize-learning.mjs` to deduplicate learning candidates
  across `$CODEX_HOME/learning/improvement-backlog.jsonl` and project-local active
  run artifacts before promotion.
