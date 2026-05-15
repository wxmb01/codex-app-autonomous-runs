# Requirements

- Use Codex App-side execution for no-pause or no-idle requests.
- Do not use CLI/local runner for the App-only continuous execution requirement.
- Do not use heartbeat automations as the primary no-pause worker.
- Use short cycles: inspect, choose, edit, validate, self-review, log, continue.
- For medium and large projects, use an independent read-only completeness reviewer
  after orientation and before final readiness.
- Do not claim zero mathematical idle time; state App runtime limits honestly.
- Keep only especially dangerous actions as hard human checkpoints: package
  publishing, production deploys, infrastructure or cluster changes, destructive
  migrations, secrets, payments, production data, broad unrelated rewrites, and
  destructive cleanup.
