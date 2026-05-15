# Changelog

## 0.1.10

- Added Codex App-compatible reviewer launch rules so specialized reviewer agents
  are started with self-contained prompts instead of full-context forks.
- Required immediate retry with a compatible no-fork reviewer invocation when the
  App rejects a reviewer launch because of tool argument combinations.
- Added validation coverage that first-cycle 1h+ reviewer events record the launch
  mode and avoid the incompatible specialized-reviewer plus full-context fork path.

## 0.1.9

- Tightened 1h+ timed-run reviewer behavior: Codex must start a read-only reviewer
  lane after minimal orientation and before the first implementation edit.
- Required the first progress update for 1h+ runs to state whether the reviewer was
  started, which reviewer type was used, or why an independent reviewer was
  unavailable.
- Updated long-run fixture validation so reviewer launch is visible in the first
  cycle instead of being deferred until later implementation work.

## 0.1.8

- Added deterministic learning promotion tooling with validation, global install,
  manifest verification, commit, push, tag, GitHub Release, and promotion reports.
- Added machine-checkable promotion-report and learning-summary schemas.
- Added a cross-project learning summarizer for global backlog and project run
  artifacts.
- Required independent reviewer evidence for global prompt, validation, and
  performance learning promotions.
- Productized the GitHub Release API fallback as a reusable script.
- Added a 45-minute long-run simulation fixture that covers reviewer events,
  learning candidates, promotion evidence, and final retrospective validation.
- Fixed the README Chinese introduction and documented the deterministic promotion
  path.

## 0.1.7

- Reworked the GitHub README into a richer project introduction covering the
  execution stack, learning loop, safety boundary, usage, validation, and docs.
- Refreshed bilingual promotional images with a darker, more technical visual
  system and exact locally rendered text.
- Added validation coverage for README positioning and promo image dimensions.

## 0.1.6

- Added post-promotion sync rules so every validated learning iteration updates
  the installed Codex global files and pushes the repository state to GitHub.
- Clarified that high-risk shadowed learning candidates do not trigger automatic
  global install, GitHub push, tag, or release.

## 0.1.5

- Added an autonomous learning loop for timed and App-only active runs.
- Added learning artifacts: `lessons-learned.md`,
  `improvement-candidates.jsonl`, and `promotion-report.md`.
- Added schemas for improvement candidates and run retrospectives.
- Defined automatic promotion gates for low-risk project-local, prompt, docs,
  performance, and validation improvements.
- Required high-risk global safety, permissions, deploy, publish, delete, secrets,
  and reviewer-policy changes to enter shadow backlog instead of auto-applying.
- Enforced learning artifact presence, high-risk shadow policy, long JSONL events,
  and package hygiene in validation.

## 0.1.4

- Changed `--merge` installers to merge managed Codex hooks into existing
  `hooks.json` instead of overwriting user hooks.
- Changed uninstall to remove only managed hook entries from merged `hooks.json`.
- Fixed Node uninstall dry-run directory cleanup reporting so dry-run does not
  claim empty-directory removals for non-empty directories.
- Added package metadata and an explicit npm package file allowlist.
- Expanded CI validation to Windows and Ubuntu.

## 0.1.3

- Added explicit reviewer-subagent authorization to the timed automation prompt
  template for runs of 1 hour or more.
- Added semantic validation for `autonomous-safety.rules`.
- Added `npm run test:all` and moved GitHub Actions validation to the full suite.
- Made the final fixture self-contained by installing templates into a temporary
  Codex home during validation.
- Expanded fast prefix rules for deployment variants and direct destructive database
  command forms without attaching the Python hook to every shell command.
- Tightened the Stop hook so active-run progress events must satisfy the published
  progress-event required fields.
- Added installer manifests with SHA-256 hashes and safer uninstall behavior that
  preserves modified or user-owned `hooks.json`.
- Replaced hard-coded release validation with package-vs-changelog version checks.
- Fixed the bilingual README text and documented safe uninstall behavior.

## 0.1.2

- Clarified that timed autonomous project runs of 1 hour or more explicitly authorize
  read-only reviewer subagents.
- Required at least one read-only reviewer subagent after orientation for 1h+ runs.
- Documented the 1h+ reviewer trigger in README and App-only run docs.

## 0.1.1

- Reduced default PreToolUse hook overhead by attaching it only to write/patch tools.
- Kept dangerous shell-command blocking in the installed high-automation rules file.
- Optimized the Stop hook with an active-run `current` pointer and tail-only progress reads.
- Added a hook benchmark script and validation coverage for the faster hook path.
- Clarified commit, branch push, and PR automation policy.
- Added compressed WebP README promotional images while keeping PNG assets for previews.

## 0.1.0

- Initial Codex App autonomous run templates.
- Added App-only active-session skill.
- Added run-state and progress JSONL schemas.
- Added read-only reviewer agents.
- Added high-automation safety rules and hooks.
- Added Windows PowerShell and cross-platform Node installers.
