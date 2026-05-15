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
- Confirm examples are under `examples/` and old local-runner fixtures are not
  tracked.
- Review hooks in Codex App before trusting them.

Recommended GitHub repository description:

> Codex App templates for long active autonomous project runs with progress logs,
> read-only reviewer agents, and narrow safety hooks.
