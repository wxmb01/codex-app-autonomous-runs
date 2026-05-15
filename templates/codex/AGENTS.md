# Global Codex Operating Rules

## Timed Autonomous Project Runs

When the user asks Codex to run a project for a duration, keep working automatically,
auto-improve a project, continue in the background, avoid asking at every step, ask
only at key checkpoints, resume/pause/cancel/status an automation, or equivalent
Chinese requests, use the `timed-autonomous-run` skill.
If the skill is not listed in the current session, read and follow
`$CODEX_HOME/skills/timed-autonomous-run/SKILL.md` directly.

If the user explicitly asks for Codex App-side uninterrupted/no-pause/no-idle work,
"not even one second of pause", or 30-hour continuous execution, do not use Codex App
heartbeat as the primary execution mechanism and do not use CLI/local runner. Keep
the current Codex App thread in one long active work session: continue using tools,
editing, validating, self-reviewing, and reporting progress until the requested
duration expires, the goal is complete, or a human checkpoint is required.

Do not answer with instructions only when the Codex App automation tool is available.
Create or update the appropriate automation directly.

Default behavior:

- Use one focused automation per project/task.
- For bounded manual runs such as "run this project for 2 hours", prefer a thread
  heartbeat with RRULE `COUNT`.
- For recurring long-term maintenance, prefer project/cron automation with worktree
  isolation for Git repositories.
- Before creating a new automation, check existing automations and update a matching
  one instead of duplicating it.
- Preflight the target path before scheduling: folder exists, project markers, Git
  status, likely validation commands, and obvious risk areas.
- Use the read-only `autonomous_reviewer` subagent for eligible timed runs according
  to the skill's review lane.
- Treat any explicit timed autonomous project run of 1 hour or more as explicit user
  authorization to start read-only reviewer subagents for review work. Do not wait
  for separate wording such as "start a subagent" or "parallel agent".
- For medium or large projects, always use a read-only `project_completeness_reviewer`
  subagent to review completeness, validation gaps, architecture risks, docs drift,
  and unresolved blockers. Main-agent self-review alone is not enough.
- For App-only active sessions, maintain project-local `run-state.json`,
  `progress.md`, and `progress.jsonl` under `.codex/app-active-runs/<run-name>/`.
  Also write `.codex/app-active-runs/current` with the active run name. Keep
  `run-state.json.status = "running"` and `stop_guard = true` while work must
  continue; close it with `completed` or `blocked` plus `stop_reason` before ending.
- Before editing a real project in a timed run, record a preflight covering absolute
  target path, Git status, stack, validation commands, risk areas, project size, and
  reviewer plan.
- Use phase budgeting for long runs: orientation, implementation, hardening, and
  final review. Do not claim readiness before final self-review and required
  independent reviewer events.
- Use specialized read-only reviewers only when risk warrants it:
  `security_reviewer`, `test_coverage_reviewer`, `architecture_reviewer`, and
  `ui_artifact_reviewer`.
- Keep only especially dangerous actions as hard human checkpoints:
  publish/upload/release, production deploy, delete user data, change secrets/accounts/
  payments/production infrastructure, destructive migrations, broad unrelated rewrites,
  destructive repository cleanup, or overwrite unrelated uncommitted changes.
- In high-automation mode, normal local engineering work, commits, branch pushes, and
  PR creation are allowed when they fit the user's requested workflow and are recorded
  in the progress log.

Global guardrails:

- `$CODEX_HOME/rules/autonomous-safety.rules` and hooks under
  `$CODEX_HOME/hooks/` block only especially dangerous irreversible or
  secret/production-risk actions. They must not block normal implementation, commits,
  branch pushes, PR creation, tests, builds, previews, or local validation.
