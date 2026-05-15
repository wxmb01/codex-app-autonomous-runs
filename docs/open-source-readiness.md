# Open Source Readiness

Before publishing:

- Run `npm run test:all`.
- Confirm there are no personal paths in templates or docs.
- Confirm no secrets, tokens, private keys, or private repository content are
  present.
- Confirm old CLI/local runner files are not included.
- Confirm `LICENSE`, `SECURITY.md`, and `CONTRIBUTING.md` are present.
- Confirm GitHub workflow and issue templates are present.
- Confirm install, uninstall, and cross-platform Node scripts are present.
- Confirm uninstall preserves modified or user-owned `hooks.json`.
- Confirm timed runs of 1 hour or more include reviewer-subagent authorization in
  the skill prompt template.
- Confirm the 1h+ reviewer lane is required in the first cycle before the first
  implementation edit, not deferred until a readiness claim.
- Confirm specialized reviewers are launched without full-context fork and receive
  self-contained prompts with target, goal, validation, risk, and artifact context.
- Confirm autonomous learning artifacts, schemas, and promotion gates are included.
- Confirm `promotion-report.schema.json` requires install, commit, push, release,
  and reviewer evidence.
- Confirm `scripts/promote-learning.mjs`, `scripts/summarize-learning.mjs`, and
  `scripts/github-release.mjs` are included and covered by dry-run tests.
- Confirm the long-run simulation fixture represents at least 30 minutes of
  project work with reviewer events, learning candidates, and promotion evidence.
- Confirm high-risk global learning candidates are shadowed rather than
  auto-applied.
- Confirm promoted learning iterations sync to installed global files and GitHub
  after validation.
- Confirm examples are under `examples/` and old local-runner fixtures are not
  tracked.
- Review hooks in Codex App before trusting them.

Recommended GitHub repository description:

> Codex App templates for long active autonomous project runs with progress logs,
> read-only reviewer agents, and narrow safety hooks.
