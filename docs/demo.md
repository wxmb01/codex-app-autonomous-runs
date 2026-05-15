# Demo

## 1. Install

```powershell
.\scripts\Install-CodexAppAutonomous.ps1 -Merge -DryRun
.\scripts\Install-CodexAppAutonomous.ps1 -Merge
```

Or with Node:

```bash
node scripts/install.mjs --merge --dry-run
node scripts/install.mjs --merge
```

## 2. Trust Hooks

Open Codex App settings, go to Hooks, and trust:

- `PreToolUse`
- `Stop`

## 3. Run A Project

```text
Use Codex App only. Run this project for 30 minutes, keep working automatically,
record run-state.json, progress.md, and progress.jsonl, and use a read-only
project completeness reviewer before final readiness.
```

## 4. Expected Run Files

```text
.codex/app-active-runs/<run-name>/run-state.json
.codex/app-active-runs/<run-name>/progress.md
.codex/app-active-runs/<run-name>/progress.jsonl
```

## 5. Example Progress Event

```json
{
  "timestamp": "2026-01-01T00:05:00Z",
  "cycle": 2,
  "phase": "implementation",
  "elapsed_minutes": 5,
  "task": "add missing validation",
  "files_changed": ["tests/validate.js"],
  "commands": ["npm test"],
  "validation": "passed",
  "self_review": "no regression found",
  "reviewer": "not needed this cycle",
  "blocker": "none",
  "next_step": "continue hardening"
}
```
