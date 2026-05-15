# App-Only Continuous Runs

This project targets Codex App active sessions, not a standalone CLI/local runner.

For no-pause or no-idle requests, the intended behavior is:

1. Stay in the current Codex App thread.
2. Create project-local run state under `.codex/app-active-runs/<run-name>/`.
3. Keep working in short cycles: inspect, edit, validate, self-review, log, continue.
4. Use read-only reviewer agents for medium and large projects.
5. Stop only when the duration expires, the goal is complete, or an especially
   dangerous human checkpoint is reached.

Heartbeat automations are useful as scheduled wakeups, but they are not permanent
workers and should not be the primary mechanism for no-idle App-only runs.
