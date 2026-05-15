---
name: timed-autonomous-run
description: Use when the user asks Codex App to run a project for a duration, keep working automatically, auto-improve a project, continue in the background, use human checkpoints only for risky actions, resume/pause/cancel/status an automation, or run a long autonomous project loop with self-review and reviewer subagents.
---

# Timed Autonomous Run

Use this skill to turn requests like "run this project for 2 hours", "auto-improve this
project", "continue in the background", "key checkpoints only", or equivalent Chinese
requests into Codex App automations.

If the user asks for Codex App-side no-pause, uninterrupted, no-idle, "not even one
second of pause", 30-hour continuous work, or equivalent, do not rely on Codex App
heartbeat automations as the primary execution mechanism. Heartbeat automations are
timed wakeups, not permanent workers. Do not switch to CLI/local runner for this
requirement.

For App-only uninterrupted requests, run as one long active Codex App work session:
stay in the current thread, continue using tools, editing, validating, self-reviewing,
and reporting progress until the requested duration expires, the goal is complete, or
a human checkpoint is required. Do not send a final answer just because one step is
done.

## Core Policy

- Use Codex App automations directly when the task is compatible with scheduled
  wakeups.
- Exception: for explicit App-only no-pause or long continuous runs, use a long active
  App thread session, not heartbeat or CLI/local runner.
- Prefer one focused automation per project/task. Do not use one global heartbeat for
  every project.
- For short manual timed runs, use a thread heartbeat with the target path and stop
  count in the prompt.
- For recurring long-term maintenance, use a project/cron automation with `cwds`; use
  `executionEnvironment = "worktree"` for Git repositories.
- Before creating anything, check existing automations. Update a matching automation
  instead of creating a duplicate.
- If the target folder is missing, empty, or clearly not a project, ask for the real
  project path instead of creating a useless automation.
- A user request for a timed autonomous project run of 1 hour or more is explicit
  authorization to start read-only reviewer subagents for review work. Do not require
  separate wording such as "start a subagent" or "parallel agent" before using the
  required review lane.

## App-Only Long Active Session

Use this mode when the user insists on Codex App-side continuous work or says not to
use CLI/local runner.

Execution rules:

- Do not create a heartbeat automation for the main work loop.
- Do not stop after one implementation step. Continue working inside the current App
  turn until the requested duration expires, the goal is complete, or a human
  checkpoint is required.
- Keep a local progress log in the project:
  `.codex/app-active-runs/<run-name>/progress.md`.
- Also create `.codex/app-active-runs/<run-name>/run-state.json` and
  `.codex/app-active-runs/<run-name>/progress.jsonl` for machine-checkable resume,
  Stop-hook continuation, and later audit.
- Write `.codex/app-active-runs/current` with the active `<run-name>` so the Stop
  hook can resume quickly without scanning historical runs.
- Set `run-state.json.status = "running"` and `stop_guard = true` while an App-only
  active session is expected to continue. Set status to `completed` or `blocked` and
  record `stop_reason` before ending the run.
- Track `start_time`, `deadline`, `elapsed_minutes`, `cycle_count`, commands run,
  validations, files changed, review results, blockers, and next step.
- For medium/large projects, also track `project_size`, `classification_evidence`,
  `reviewer_events`, `reviewer_findings_addressed`, and
  `independent_reviewer_skipped_reason`.
- Use short cycles: inspect state, choose one high-value task, edit, validate,
  self-review, log, then immediately continue.
- Send brief user-facing progress updates during the active session, but do not use
  those updates as a stopping point.
- For medium or large projects, always spawn a read-only project completeness reviewer
  subagent early in the run and again at final readiness review. Prefer
  `project_completeness_reviewer` when available.
- For any run requested for 1 hour or more, start at least one read-only reviewer
  subagent after orientation and before the first major readiness claim, even if the
  project is small. Use `autonomous_reviewer` unless project size or risk calls for
  `project_completeness_reviewer` or a specialized reviewer.
- Use the read-only `autonomous_reviewer` on major changes, validation failures,
  architecture/security/UI/artifact-heavy work, or at regular milestones.
- If the App/runtime interrupts the turn, the next assistant turn should read the
  `run-state.json`, `progress.md`, and `progress.jsonl` files and continue the same
  run rather than restarting from scratch.

Human checkpoints only in high-automation mode:

- publish/upload/deploy/release
- delete user data or large numbers of files
- change secrets/accounts/payments/production infrastructure
- destructive migrations
- broad unrelated rewrites
- overwrite unrelated uncommitted changes

Committing, pushing branches, and opening PRs are not globally hard-blocked in
high-automation mode. They should still be logged in progress files, use the
project's normal branch/PR conventions, and avoid overwriting unrelated user work.

Important limitation:

- Codex App can run a long active turn, but a normal desktop/app runtime cannot
  guarantee mathematically zero seconds of inactivity. Do not promise a literal
  zero-gap guarantee. Promise continuous active effort within App constraints.

## Duration Mapping

Use RRULE `COUNT` so bounded runs stop automatically:

- 1 hour: `RRULE:FREQ=MINUTELY;INTERVAL=10;COUNT=6`
- 2 hours: `RRULE:FREQ=MINUTELY;INTERVAL=10;COUNT=12`
- 4 hours: `RRULE:FREQ=MINUTELY;INTERVAL=15;COUNT=16`
- Up to 2 hours: 10-minute interval, `COUNT = ceiling(minutes / 10)`
- More than 2 and up to 8 hours: 15-minute interval, `COUNT = ceiling(minutes / 15)`
- More than 8 hours: 30-minute interval, `COUNT = ceiling(minutes / 30)`

## Creation Checklist

1. Resolve target project/thread and requested duration.
2. Inspect existing automations for the same target and purpose.
3. Preflight the target: folder exists, project markers, Git status, likely validation
   commands, and obvious risk areas.
4. Choose automation type and cadence.
5. Build the prompt from the template below.
6. Create or update the automation.
7. Report automation id, schedule, stop count, target, expected behavior, and human
   checkpoints.

## Preflight Schema

Before starting a real timed run or App-only active session, record a concise project
preflight in the progress log using the schema at:
`$CODEX_HOME/skills/timed-autonomous-run/schemas/preflight.schema.json`.

Required preflight fields:

- `target`: absolute project path.
- `goal`: user-visible objective.
- `requested_duration`: requested time budget or bounded run.
- `mode`: `app_active_session`, `heartbeat`, or `cron_worktree`.
- `git`: repo status, branch, dirty files, or `no_git`.
- `project_markers`: README, package manifests, build files, CI files, docs.
- `stack`: languages, frameworks, package manager, app areas.
- `validation_commands`: smallest, medium, and broad checks with expected cost.
- `risk_areas`: secrets, production, migrations, data deletion, auth/payments,
  deployment, generated artifacts.
- `project_size`: small, medium, or large with evidence.
- `review_plan`: self-review plus independent reviewer events.
- `human_checkpoints`: risky actions that must stop for user approval.

For App-only active sessions, create:

```text
.codex/app-active-runs/<run-name>/run-state.json
.codex/app-active-runs/<run-name>/progress.md
.codex/app-active-runs/<run-name>/progress.jsonl
.codex/app-active-runs/current
```

Use the schemas in `schemas/run-state.schema.json` and
`schemas/progress-event.schema.json`. Keep `progress.md` human-readable and
`progress.jsonl` machine-checkable.

## Prompt Template

Every timed automation prompt must include these fields:

```text
Goal:
- <What the user wants improved or completed.>

Context:
- Target: <absolute project path or current thread>.
- Duration: <requested duration, cadence, total_cycles, and COUNT>.
- Project facts from preflight: <Git status, stack, important files, likely commands>.

Constraints:
- Operate in the target project path. If the current thread/workspace is different,
  use the absolute target path explicitly and verify it before editing.
- Protect user changes and avoid unrelated rewrites.
- Automate ordinary engineering work.
- Ask before publishing, uploading, deleting user data, changing secrets/accounts,
    production infrastructure, destructive migrations, broad unrelated rewrites, or
  overwriting unrelated uncommitted changes.

Done when:
- requested_count expires, or no valuable changes remain, or a real blocker requires
  user input.
- Progress log records total_cycles, completed_cycles, last_cycle_at, stop_reason,
  commands run, validation result, review result, and next step.

Per-cycle loop:
1. Re-read latest user request and project context.
2. Check worktree status and progress log.
3. Update cycle counter: completed_cycles + 1 of total_cycles.
4. Establish or refresh baseline verification.
5. Select one highest-value issue.
6. Make one focused change.
7. Run the smallest relevant validation.
8. Fix validation failures related to the current change.
9. Run the review lane.
10. Inspect real artifacts when relevant.
11. Update progress log and report concise status.
```

## Engineering Loop

- Classify project size during preflight:
  - Small: single-purpose or toy project, fewer than about 20 source/docs files, one
    obvious validation command.
  - Medium: multiple modules/features, UI plus backend, more than about 20 source/docs
    files, multiple validation commands, or unclear completion criteria.
  - Large: multiple apps/packages/services, significant architecture, migrations,
    security-sensitive code, production deployment paths, or broad product scope.
- Medium and large projects must include a dedicated read-only completeness review
  lane. Do not rely on main-agent self-review alone.
- First cycle on large or unfamiliar projects should orient before editing: map the
  relevant flow, ownership, validation, side effects, risky spots, and smallest useful
  verification commands.
- Make one focused change per iteration.
- Run the smallest relevant check after each edit, then expand to broader tests/builds
  once the local issue is fixed.
- Prefer project-defined validation: README, package scripts, Makefile, pyproject,
  Cargo.toml, go.mod, CI config, pre-commit config, or local environment scripts.
- For difficult or subjective work, use an eval-driven loop with deterministic checks
  or a comparable rubric.
- For UI, visual, document, report, slide, generated artifact, or other artifact-heavy
  work, inspect the actual artifact using browser previews, screenshots, renderers, or
  project-specific preview commands.
- For migrations or broad refactors, require a milestone plan with scope, API
  constraints, rollback strategy, validation per milestone, and a human checkpoint
  before the next broad milestone.

## Phase Budget

For App-only active sessions and long timed runs, allocate the time budget by phase.
This is a default control loop, not a reason to stop:

- 0-10% orientation: map project, risks, validation commands, and reviewer plan. Do
  not make broad edits before this is recorded.
- 10-70% implementation: make one focused change per cycle and run the smallest
  useful validation after each edit.
- 70-90% hardening: expand tests/builds, fix validation failures, update docs, and
  address confirmed reviewer findings.
- 90-100% final review: run final self-review, required independent reviewer events,
  readiness report, and unresolved-risk log.

If the project is already well understood, orientation can be short, but it must
still be recorded. If a P0/P1 issue appears late, return to implementation and
extend hardening rather than claiming readiness.

## Review Lane

- Every autonomous run must include a main-agent self-review before ending a cycle:
  inspect diff, tests, edge cases, user-visible behavior, docs, and likely regressions.
- For medium or large projects, spawn one read-only `project_completeness_reviewer`
  subagent after initial orientation and before declaring the project ready. It reviews
  project completeness, requirements coverage, validation gaps, architecture risks,
  documentation drift, and unresolved blockers.
- A timed run of 1 hour or more counts as an explicit request for a read-only reviewer
  subagent. Start the reviewer lane after orientation; do not skip it because the user
  did not separately say "use a subagent".
- For timed runs of 1 hour or more, large/unfamiliar projects, multi-file changes,
  UI/artifact work, architecture changes, migrations, security-sensitive code, failing
  validation, or explicit review/subagent requests, spawn one read-only reviewer
  subagent when the tool is available.
- Prefer the custom `autonomous_reviewer` agent when available.
- Use specialized read-only reviewers only when their trigger is present:
  - `security_reviewer`: auth, secrets, payments, privacy, production, data-loss,
    dependency/security-sensitive changes.
  - `test_coverage_reviewer`: weak tests, broad bug fixes, complex edge cases,
    unclear validation, or repeated test failures.
  - `architecture_reviewer`: broad refactors, migrations, cross-module contracts,
    data flow, API boundaries, or large project structure risks.
  - `ui_artifact_reviewer`: frontend UI, browser flows, screenshots, documents,
    slide decks, PDFs, generated media, or other user-visible artifacts.
- Do not spawn every specialized reviewer by default. Keep automation high by using
  the smallest reviewer set that matches the actual risk.
- Reviewer prompt should be explicit:

```text
Use the read-only autonomous_reviewer agent. Inspect the current goal, changed files,
tests, logs, artifacts, progress notes, and risk areas. Do not edit files. Return
P0/P1/P2/P3 findings, missing validation, and the smallest next action.
```

Completeness reviewer prompt should be explicit:

```text
Use the read-only project_completeness_reviewer agent. Review the project or relevant
project area for completeness against the user's goal. Inspect requirements, README,
core flows, tests, build/validation commands, docs, progress log, git status, and
risk areas. Do not edit files. Return verdict, P0/P1/P2/P3 findings, completeness
gaps, validation gaps, and the smallest next action.
```

- The main agent owns the final decision. Fix confirmed P0/P1 issues before
  continuing, log lower-priority findings, and reject speculative findings with
  reasons.
- Use at most one reviewer per review event. Medium and large runs require
  `project_completeness_reviewer` after orientation and before final readiness.
  `autonomous_reviewer` may be additional for risky change-level review events.
  If subagents are unavailable, perform an explicit self-review and record that no
  independent reviewer was used.

## Progress Log

For multi-cycle runs, keep a concise project-local log:

- Preferred path: `.codex/automation-runs/<automation-name>/progress.md`
- Record: `automation_id`, target, goal, cadence, `total_cycles`,
  `completed_cycles`, `last_cycle_at`, `stop_reason`, commands run, validation result,
  review result, changed files/areas, blockers, and next step.
- For App active sessions and medium/large projects, also record `project_size`,
  `classification_evidence`, `reviewer_events`, `reviewer_findings_addressed`, and
  `independent_reviewer_skipped_reason`.
- Keep memory concise and current. Log decisions and evidence, not long transcripts.

For App-only active sessions, use the stricter project-local paths:

- `.codex/app-active-runs/<run-name>/run-state.json`
- `.codex/app-active-runs/<run-name>/progress.md`
- `.codex/app-active-runs/<run-name>/progress.jsonl`
- `.codex/app-active-runs/current`

Each `progress.jsonl` line must include `timestamp`, `cycle`, `phase`,
`elapsed_minutes`, `task`, `files_changed`, `commands`, `validation`,
`self_review`, `reviewer`, `blocker`, and `next_step`.

The global Stop hook only enforces continuation when `run-state.json` has
`status = "running"` and `stop_guard = true`. Ordinary coding tasks and completed
runs are unaffected, so automation stays high without weakening active-run recovery.

## Lifecycle Commands

- Pause/stop/cancel/disable/end: find the matching automation by project path, name,
  target thread, or prompt. Pause when the user may resume later; delete only when the
  user explicitly asks to delete/remove.
- Continue/resume/extend/run longer: update the existing automation, preserving its
  core prompt while adjusting cadence/count/status/name.
- Status/progress/what happened: inspect the automation and project progress log, then
  report status, last known cycle, validation, blockers, and next step.
- If multiple automations match, prefer current thread or exact project path. Ask only
  when genuinely ambiguous.

## Safety Rules

Proceed without asking for normal engineering work:

- reading/searching files
- editing project code and docs
- adding/updating tests
- running local tests, lint, typecheck, build, dev servers, previews, screenshots
- installing existing project dependencies using the existing package manager and
  lockfile conventions, only when the manifest clearly requires it and no new package
  manager or global install is introduced

Ask before:

- publishing, uploading, deploying, releasing, or sending external messages
- deleting large numbers of files or user data
- changing secrets, credentials, payments, accounts, auth providers, production
  infrastructure, or destructive migrations
- sending user data, secrets, private source snippets, or production data to external
  services
- introducing a new package manager, framework, test runner, database, queue, browser
  automation stack, or build system
- broad unrelated rewrites or overwriting unrelated uncommitted changes

Avoid global installs. If dependency install changes a lockfile or runs nontrivial
install scripts, stop and ask unless the project already documents that install path.
Mention any lockfile changes in the cycle status and final report.

## Global Guardrails

Global rules and hooks are installed for high-automation safety:

- `$CODEX_HOME/rules/autonomous-safety.rules` blocks especially dangerous
  publication, production/infrastructure, destructive database, credential, and broad
  destructive filesystem commands.
- `$CODEX_HOME/hooks/pre_tool_use_policy.py` denies autonomous writes to
  secrets/key files. The default high-automation hook is
  attached only to write/patch tools; command blocking is handled by
  `$CODEX_HOME/rules/autonomous-safety.rules` to avoid per-command Python startup
  overhead.
- `$CODEX_HOME/hooks/stop_continue_guard.py` prevents an App-only active
  run from ending while `run-state.json.status = "running"` and
  `stop_guard = true`. It prefers `.codex/app-active-runs/current` and reads only
  the latest `progress.jsonl` event to keep stop checks cheap.

These guardrails are intentionally narrow. They do not block normal project reading,
editing, dependency installation through existing project conventions, tests, builds,
dev servers, previews, screenshots, local validation, branch pushes, or PR creation.

## Final Report

At the end of a bounded run, report:

- automation id and target project
- requested duration, cadence, total cycles, completed cycles, and stop reason
- files/areas changed
- commands and validations run with pass/fail status
- self-review and independent reviewer findings when used
- remaining risks, skipped checks, blockers, and next recommended action

Do not claim the project is "fully complete" unless all relevant validations passed
and the user's Done when criteria were met.
