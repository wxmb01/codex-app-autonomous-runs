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
record run-state.json, progress.md, progress.jsonl, lessons-learned.md,
improvement-candidates.jsonl, promotion-report.md, and promotion-report.json, and
use a read-only project completeness reviewer before final readiness.
```

For runs of 1 hour or more, the duration request itself authorizes a read-only
reviewer subagent from the start of the run. After only minimal preflight, Codex
must start that reviewer before the first implementation edit.

## 4. Expected Run Files

```text
.codex/app-active-runs/<run-name>/run-state.json
.codex/app-active-runs/<run-name>/progress.md
.codex/app-active-runs/<run-name>/progress.jsonl
.codex/app-active-runs/<run-name>/lessons-learned.md
.codex/app-active-runs/<run-name>/improvement-candidates.jsonl
.codex/app-active-runs/<run-name>/promotion-report.md
.codex/app-active-runs/<run-name>/promotion-report.json
.codex/app-active-runs/current
```

High-risk global learning candidates are not auto-applied. They are written to
`$CODEX_HOME/learning/improvement-backlog.jsonl` with evidence and required
validation.

## 5. Deterministic Promotion

For this repository, promote validated learning with:

```powershell
node scripts/promote-learning.mjs --reviewer-result="<read-only reviewer verdict>"
```

To summarize repeated lessons across projects:

```powershell
node scripts/summarize-learning.mjs
```

## 6. Example Progress Event

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
