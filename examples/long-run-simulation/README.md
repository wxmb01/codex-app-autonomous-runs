# Long-Run Simulation Fixture

This fixture records a realistic 45-minute medium-project App-only run without
requiring the test suite to wait in real time.

It covers the full autonomous loop:

- project preflight and phase progression
- implementation cycles with validation
- independent read-only reviewer events
- learning candidates
- deterministic promotion evidence
- global install, GitHub push, tag, and release reporting

The active-run artifacts live under `codex-app-active-runs/` instead of `.codex/`
so the fixture remains visible in the repository.
