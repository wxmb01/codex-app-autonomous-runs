# Codex App Autonomous Runs

![Codex App Autonomous Runs promotional banner](docs/assets/promo-en.webp)

<details>
<summary>中文宣传图</summary>

![Codex App Autonomous Runs 中文宣传图](docs/assets/promo-zh.webp)

</details>

## Introduction

<details open>
<summary>English</summary>

Codex App Autonomous Runs is a production-oriented configuration kit for people
who want Codex App to keep driving real projects for long active sessions instead
of stopping after every small step.

It installs global Codex rules, a timed autonomous-run skill, narrow safety hooks,
machine-checkable progress logs, read-only reviewer agents, deterministic learning
promotion tools, and an autonomous learning loop. The operating model is simple:
normal engineering work keeps moving, reviewers audit completeness, reusable
lessons are promoted after validation, and only especially dangerous actions are
held for a human checkpoint.

This project is intentionally Codex App first. It does not require a CLI/local
runner to simulate continuous work.

</details>

<details>
<summary>中文</summary>

Codex App Autonomous Runs 是一套面向 Codex App 的全局自动化配置模板，用来让
Codex 在中大型项目里持续推进，而不是每完成一步就停下来等待用户说“继续”。

它会安装全局 `AGENTS.md` 规则、`timed-autonomous-run` 技能、窄范围安全
hooks、机器可校验的进度日志、只读审查子代理、确定性的学习晋升脚本，以及自我
学习迭代闭环。整体策略是：常规工程工作持续自动执行，审查代理负责完整性和风险
检查，可复用经验在验证后自动晋升，只有发布、部署、基础设施变更、递归强删、密钥
写入等特别危险动作才保留人工确认。

这个项目坚持 Codex App 优先，不依赖 CLI/local runner 来模拟持续运行。

</details>

## What This Adds

This repository turns a normal Codex App setup into a higher-autonomy project
execution environment:

- Global `AGENTS.md` rules that route timed/no-pause requests into the autonomous
  run workflow.
- A `timed-autonomous-run` skill for App-only long active sessions, heartbeat
  automations, status checks, pause/resume behavior, and project preflight.
- Machine-checkable active-run state:
  - `run-state.json`
  - `progress.md`
  - `progress.jsonl`
  - `.codex/app-active-runs/current`
- Autonomous learning artifacts:
  - `lessons-learned.md`
  - `improvement-candidates.jsonl`
  - `promotion-report.md`
  - `promotion-report.json`
  - `$CODEX_HOME/learning/improvement-backlog.jsonl`
- Deterministic promotion scripts for validation, global install, manifest checks,
  commit, push, tag, GitHub Release, and promotion reports.
- Cross-project learning summarization across `$CODEX_HOME` backlog files and
  project-local run artifacts.
- Read-only reviewer agents for completeness, security, tests, architecture, and
  UI/artifact review.
- Narrow safety rules and hooks that block high-impact irreversible actions while
  keeping normal coding, tests, builds, branch pushes, and PR creation unblocked.

## Autonomous Execution Stack

```text
User duration request
  -> Codex App active session
  -> project preflight
  -> short implementation cycles
  -> validation and self-review
  -> read-only reviewer lane
  -> learning candidate capture
  -> promotion or shadow backlog
  -> global install and GitHub sync for promoted learning
```

For medium and large projects, the intended pattern is one main agent doing the
work plus at least one read-only completeness reviewer. Specialized reviewers are
used when the project risk warrants them.

For runs of 1 hour or more, the duration request itself authorizes at least one
read-only reviewer subagent from the start of the run. Codex may do only minimal
preflight/orientation first, then it must start the reviewer before the first implementation edit.
Specialized reviewers are launched with self-contained prompts rather than full-context forks, which matches Codex App's reviewer-agent constraints and avoids the delayed retry pattern.

## Autonomous Learning Loop

Long runs do not just finish a task; they also collect reusable operating lessons.
When Codex sees repeated friction, missed validation, user corrections, reviewer
findings, weak preflight, or slow/fragile rules, it records an improvement
candidate.

Promotion policy:

- Low-risk project, documentation, prompt, validation, and performance improvements
  may be auto-applied after evidence and validation.
- Medium-risk improvements may be auto-applied only when focused, reversible, and
  fully validated.
- High-risk safety, permission, release, deploy, publish, delete, secrets, or
  reviewer-policy changes are never auto-applied. They go to the shadow backlog.

For this repository, every promoted learning iteration also syncs into the installed
Codex global files and is pushed to GitHub. Versioned public changes update the
matching tag and GitHub Release.

## Deterministic Promotion

Learning promotion is no longer only a prose rule. The repository includes
deterministic scripts for the full release-grade path:

```powershell
node scripts/summarize-learning.mjs --dry-run
node scripts/promote-learning.mjs --reviewer-result="<read-only reviewer verdict>"
node scripts/github-release.mjs --dry-run --tag=v0.1.8 --target=<commit-sha>
```

`promote-learning.mjs` runs validation, the 30-iteration hook benchmark, package
dry-run, global install, manifest verification, commit, push, tag, release, and
promotion report generation. Promotions that touch global prompt, validation, or
performance behavior must include an independent read-only reviewer result in
`promotion-report.json`.

## Safety Boundary

Allowed by default:

- reading and editing project files
- tests, lint, typecheck, and builds
- local dev servers and previews
- commits, branch pushes, and PR creation when requested
- read-only reviewer subagents
- validated low-risk learning promotion

Blocked by default:

- package publishing
- deploys and production deploys
- infrastructure changes
- Kubernetes/Helm mutations
- destructive Git cleanup
- recursive force deletion
- secrets/private-key writes
- direct destructive database command prefixes

This keeps the automation rate high without silently weakening the safety boundary.

## Install

Review the templates first:

```powershell
Get-ChildItem .\templates\codex -Recurse
```

Preview installation:

```powershell
.\scripts\Install-CodexAppAutonomous.ps1 -Merge -DryRun
```

Install into your Codex home:

```powershell
.\scripts\Install-CodexAppAutonomous.ps1 -Merge
```

macOS/Linux or cross-platform Node install:

```bash
node scripts/install.mjs --merge --dry-run
node scripts/install.mjs --merge
```

Then open Codex App settings and trust the installed hooks.

![Codex App hooks trust screen](docs/assets/hooks-trust.svg)

## Usage

In Codex App, ask for an App-side active run:

```text
Use Codex App only. Run this project for 2 hours, keep working automatically,
use human checkpoints only for especially dangerous actions, and use a read-only
project completeness reviewer.
```

For a release or repository-improvement run:

```text
Use Codex App only. Improve this repository for 90 minutes. Keep progress logs,
use a reviewer subagent, auto-apply validated low-risk learning improvements,
sync promoted learning into global Codex files, and update GitHub after validation.
```

## Validate

```powershell
npm run test:all
```

The full validation checks template completeness, safety-rule semantics, example
projects, long-run simulation evidence, final fixture behavior, hook performance,
package hygiene, and obvious secret or personal-path leaks.

The long-run fixture can be checked directly:

```powershell
npm run test:long-run
```

## Uninstall

Preview:

```powershell
.\scripts\Uninstall-CodexAppAutonomous.ps1 -DryRun
node scripts/uninstall.mjs --dry-run
```

Remove installed files:

```powershell
.\scripts\Uninstall-CodexAppAutonomous.ps1
node scripts/uninstall.mjs
```

Installers write `codex-app-autonomous-manifest.json` into your Codex home. With
`-Merge` or `--merge`, existing `hooks.json` entries are preserved and this
project's managed hooks are appended or replaced. Uninstall removes only matching
managed files and managed hook entries.

## Documentation

- [App-only continuous runs](docs/app-only-continuous-runs.md)
- [Demo workflow](docs/demo.md)
- [FAQ](docs/faq.md)
- [Permission model](docs/permissions.md)
- [Installation guide](docs/installation.md)
- [Open-source readiness checklist](docs/open-source-readiness.md)
- [Medium project example](examples/medium-project)
- [Long-run simulation fixture](examples/long-run-simulation)

## Important Limitations

A desktop app cannot guarantee mathematically zero seconds of inactivity. This
setup maximizes continuous active work within Codex App constraints and records
state so interrupted runs can resume.

Hooks can run outside the sandbox. Review them before trusting.
