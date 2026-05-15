import assert from "node:assert/strict";
import { policy } from "../src/policy.js";

assert.equal(policy.mode, "app_active_session");
assert.equal(policy.projectSize, "medium");
assert.equal(policy.reviewer, "project_completeness_reviewer");
assert.equal(policy.highAutomation, true);
console.log("medium example validation passed");
