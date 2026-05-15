# FAQ

## Why not use a CLI/local runner?

This repository targets Codex App workflows. CLI/local runners can be useful for
other setups, but this project keeps the primary loop inside the App.

## Why not use heartbeat automations as the no-idle worker?

Heartbeat automations are scheduled wakeups. They are useful for reminders and
follow-up checks, but they are not a permanent worker for no-idle execution.

## Why allow branch pushes and PR creation?

They are auditable and reversible enough for high-automation workflows when the
user requested that delivery path. The guardrails still block package publishing,
production deploys, infrastructure changes, destructive cleanup, and secrets.

## Do hooks slow Codex down?

The default `PreToolUse` hook is attached only to write/patch tools so normal
shell commands do not pay per-command Python startup cost. Dangerous shell
commands are covered by the installed rules file. The Stop hook runs only when
Codex is about to stop, prefers `.codex/app-active-runs/current`, and reads only
the latest progress event.

## How do I pause or stop a run?

Set the active run's `run-state.json` to `status: "blocked"` or `status:
"completed"` and record `stop_reason`. The Stop hook only continues runs with
`status: "running"` and `stop_guard: true`.

## Will it self-learn without my intervention?

Yes for low-risk improvements. Runs record lessons, improvement candidates, and
promotion decisions automatically. Validated low-risk project, documentation,
prompt, validation, and performance improvements can be applied without asking.
High-risk global safety, permission, deploy, publish, delete, secrets, and
reviewer-policy changes are shadowed in the backlog instead of being silently
applied.

## Will learning updates reach my global Codex files and GitHub?

Yes. In this repository, every promoted learning iteration must reinstall the
managed global Codex files, verify the installed result, commit the focused update,
and push it to GitHub. Versioned public changes also update the matching tag and
GitHub Release. `promotion-report.json` records install result, commit SHA, push
result, release URL, and reviewer result so the sync is machine-checkable.
Shadowed high-risk candidates are recorded but not pushed as an automatic behavior
change.

## How are learning promotions made deterministic?

Use `node scripts/promote-learning.mjs --reviewer-result="<verdict>"`. The script
runs validation, hook benchmark, package dry-run, global install, manifest check,
commit, push, tag, GitHub Release, and promotion report generation in one ordered
pipeline. Global prompt, validation, and performance promotions require an
independent read-only reviewer result.

## Can it summarize lessons across projects?

Yes. `node scripts/summarize-learning.mjs` scans `$CODEX_HOME/learning` and
project run artifacts, deduplicates similar candidates, and writes a JSON plus
Markdown summary for future promotion decisions.

## Why does uninstall keep some files?

Install writes a manifest with SHA-256 hashes for managed files. Uninstall removes
matching managed files, the managed `AGENTS.md` block, and this project's managed
hook entries. It preserves user-owned files and custom `hooks.json` entries.
