# Medium Project Example

This example shows the kind of project that should trigger the default medium-run
policy: one main agent plus a read-only project completeness reviewer.

Use it as a prompt fixture, not as a production application.

## Example Prompt

```text
Use Codex App only. Run this project for 30 minutes, keep working automatically,
record run-state.json, progress.md, and progress.jsonl, and use a read-only
project completeness reviewer before final readiness.
```
