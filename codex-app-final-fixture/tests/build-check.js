import assert from "node:assert/strict";
import { runPolicy } from "../src/core/run-policy.js";
import { humanCheckpoints } from "../src/core/checkpoints.js";
import { activeSessionCycle } from "../src/core/cycle.js";
import { automationTypes } from "../src/api/automation-types.js";
import { reviewEvents } from "../src/api/review-events.js";
import { statusLabels } from "../src/ui/status-labels.js";

assert.equal(runPolicy.appOnlyContinuousMode, true);
assert.equal(runPolicy.heartbeatPrimaryForNoPause, false);
assert.equal(runPolicy.cliLocalRunnerPrimary, false);
assert.ok(humanCheckpoints.includes("deploy"));
assert.ok(activeSessionCycle.includes("continue"));
assert.equal(automationTypes.appActiveSession, "continuous-current-thread-work");
assert.equal(reviewEvents.orientation, "project_completeness_reviewer");
assert.equal(statusLabels.blocked, "human checkpoint required");
console.log("build check passed");
