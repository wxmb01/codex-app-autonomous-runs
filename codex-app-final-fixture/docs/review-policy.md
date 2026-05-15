# Review Policy

Default policy for medium and large projects:

1. Main agent owns implementation and final judgment.
2. Project completeness reviewer audits requirements coverage, validation gaps,
   architecture risks, documentation drift, and unresolved blockers.
3. Autonomous reviewer is used for risky change-level review events.
4. Multiple writing agents are only used when the user explicitly asks and write
   scopes are disjoint.
5. Reviewer findings must be logged as accepted, fixed, deferred, or rejected with
   a reason.
