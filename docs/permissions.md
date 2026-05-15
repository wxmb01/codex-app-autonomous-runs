# Permission Model

The templates use high automation:

- local engineering work is allowed
- commits, branch pushes, and PR creation are allowed when they match the user's
  requested workflow
- especially dangerous operations are blocked

The blocked set is intentionally narrow:

- package publishing
- deployment and production deployment
- infrastructure or cluster mutation
- destructive Git cleanup
- recursive force deletion
- secret/private-key writes
- direct destructive database command prefixes

This preserves automation rate while still guarding against actions that are hard
to recover from.

The autonomous learning loop follows the same boundary. It can auto-apply
validated low-risk documentation, prompt, validation, performance, and project-local
improvements, but it does not auto-relax safety rules, deploy/publish/delete
permissions, secrets handling, or reviewer requirements.

For performance, command blocking is handled by the prefix-based rules file, while
the default `PreToolUse` hook is attached only to write/patch tools for secret and
private-key write checks. The rules file is fast and intentionally narrow. It
blocks direct destructive database command prefixes such as `drop database`, but
does not parse SQL embedded inside quoted shell arguments such as `psql -c "..."`.
