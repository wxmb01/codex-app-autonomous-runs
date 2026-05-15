# Permission Model

The templates use high automation:

- local engineering work is allowed
- commits, branch pushes, and PR creation are allowed when they match the user's
  requested workflow
- especially dangerous operations are blocked

The blocked set is intentionally narrow:

- package publishing
- production deployment
- infrastructure or cluster mutation
- destructive Git cleanup
- recursive force deletion
- secret/private-key writes
- destructive database operations

This preserves automation rate while still guarding against actions that are hard
to recover from.

For performance, command blocking is handled by the rules file, while the default
`PreToolUse` hook is attached only to write/patch tools for secret and private-key
write checks.
