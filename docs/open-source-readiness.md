# Open Source Readiness

Before publishing:

- Run `npm test`.
- Confirm there are no personal paths in templates or docs.
- Confirm no secrets, tokens, private keys, or private repository content are
  present.
- Confirm old CLI/local runner files are not included.
- Confirm `LICENSE`, `SECURITY.md`, and `CONTRIBUTING.md` are present.
- Confirm GitHub workflow and issue templates are present.
- Confirm install, uninstall, and cross-platform Node scripts are present.
- Confirm examples are under `examples/` and old local-runner fixtures are not
  tracked.
- Review hooks in Codex App before trusting them.

Recommended GitHub repository description:

> Codex App templates for long active autonomous project runs with progress logs,
> read-only reviewer agents, and narrow safety hooks.
