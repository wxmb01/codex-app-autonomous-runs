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

## Why does uninstall keep some files?

Install writes a manifest with SHA-256 hashes for managed files. Uninstall removes
matching managed files and the managed `AGENTS.md` block, but it preserves modified
or user-owned files such as a customized `hooks.json`.
