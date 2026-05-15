# Codex App Final Fixture

This fixture validates the Codex App autonomous project-run setup before using it
on real medium and large projects.

It is intentionally shaped like a medium project: multiple source areas, docs,
multiple validation commands, unclear completion risk, and a required independent
project-completeness review lane.

## Done When

- Global `AGENTS.md` routes timed and no-pause requests to `timed-autonomous-run`.
- The timed-autonomous-run skill distinguishes heartbeat wakeups from App-only long
  active sessions.
- Medium and large projects require a read-only project completeness reviewer.
- Progress logs record timing, commands, validation, self-review, reviewer events,
  blockers, and next actions.
- Risky actions remain human checkpoints.
