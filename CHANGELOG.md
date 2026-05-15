# Changelog

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
