import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runHealthSummary } from "../src/workflow.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const runDir = join(root, "codex-app-active-runs", "medium-dashboard-hardening");
const events = readFileSync(join(runDir, "progress.jsonl"), "utf8")
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line));

const summary = runHealthSummary(events);
assert.equal(summary.cycles, 6);
assert.equal(summary.failed_cycles, 0);
assert.ok(summary.reviewer_events >= 2);
assert.equal(summary.ready, true);

console.log("long-run simulation project validation passed");
