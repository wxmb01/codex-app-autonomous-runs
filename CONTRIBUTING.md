# Contributing

Contributions should preserve the core design:

- Codex App first.
- No CLI/local runner requirement for continuous work.
- High automation for normal engineering work.
- Hard blocks only for especially dangerous actions.
- Read-only reviewers by default.
- Machine-checkable progress logs.

Before opening a PR, run:

```powershell
npm test
```

Do not include personal paths, tokens, secrets, private repository data, or local
machine-specific configuration in templates or fixtures.
