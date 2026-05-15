import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const home = (process.env.USERPROFILE || process.env.HOME || "").replaceAll("\\", "/");
assert.ok(home, "USERPROFILE or HOME must be set");
const globalAgents = `${home}/.codex/AGENTS.md`;
const skillFile = `${home}/.codex/skills/timed-autonomous-run/SKILL.md`;
const autonomousReviewer = `${home}/.codex/agents/autonomous_reviewer.toml`;
const completenessReviewer = `${home}/.codex/agents/project_completeness_reviewer.toml`;
const specializedReviewers = [
  `${home}/.codex/agents/security_reviewer.toml`,
  `${home}/.codex/agents/test_coverage_reviewer.toml`,
  `${home}/.codex/agents/architecture_reviewer.toml`,
  `${home}/.codex/agents/ui_artifact_reviewer.toml`
];
const configFile = `${home}/.codex/config.toml`;
const hooksJson = `${home}/.codex/hooks.json`;
const preToolHook = `${home}/.codex/hooks/pre_tool_use_policy.py`;
const stopHook = `${home}/.codex/hooks/stop_continue_guard.py`;
const safetyRules = `${home}/.codex/rules/autonomous-safety.rules`;
const schemas = [
  `${home}/.codex/skills/timed-autonomous-run/schemas/preflight.schema.json`,
  `${home}/.codex/skills/timed-autonomous-run/schemas/progress-event.schema.json`,
  `${home}/.codex/skills/timed-autonomous-run/schemas/run-state.schema.json`
];
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const progressLog = join(root, ".codex/app-active-runs/final-readiness-test/progress.md");
const runStateFile = join(root, ".codex/app-active-runs/final-readiness-test/run-state.json");
const progressJsonl = join(root, ".codex/app-active-runs/final-readiness-test/progress.jsonl");

function read(path) {
  assert.ok(existsSync(path), `missing ${path}`);
  return readFileSync(path, "utf8");
}

function includesLoose(text, phrase) {
  const normalize = (value) => value.replace(/\s+/g, " ").trim();
  return normalize(text).includes(normalize(phrase));
}

function parseToml(path) {
  const script = [
    "import json, pathlib, sys, tomllib",
    "data = tomllib.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig'))",
    "print(json.dumps(data, ensure_ascii=False))"
  ].join("\n");
  return JSON.parse(execFileSync("python", ["-c", script, path], { encoding: "utf8" }));
}

function parseJson(path) {
  return JSON.parse(read(path));
}

function runHook(path, event) {
  return execFileSync("python", [path], {
    input: JSON.stringify(event),
    encoding: "utf8"
  }).trim();
}

const agentsText = read(globalAgents);
const skillText = read(skillFile);
const autonomousText = read(autonomousReviewer);
const completenessText = read(completenessReviewer);
const configText = read(configFile);
const progressText = read(progressLog);
const hooksText = read(hooksJson);
const safetyRulesText = read(safetyRules);
const configToml = parseToml(configFile);
const autonomousToml = parseToml(autonomousReviewer);
const completenessToml = parseToml(completenessReviewer);
const specializedTomls = specializedReviewers.map(parseToml);
const hooks = JSON.parse(hooksText);
const runState = parseJson(runStateFile);
const schemaDocs = schemas.map(parseJson);

const requiredGlobalPhrases = [
  "timed-autonomous-run",
  "Codex App thread in one long active work session",
  "do not use CLI/local runner",
  "project_completeness_reviewer",
  "Main-agent self-review alone is not enough",
  "progress.jsonl",
  "Global guardrails"
];

for (const phrase of requiredGlobalPhrases) {
  assert.ok(includesLoose(agentsText, phrase), `AGENTS.md missing phrase: ${phrase}`);
}

const requiredSkillPhrases = [
  "Heartbeat automations are timed wakeups, not permanent workers",
  "Do not switch to CLI/local runner",
  "App-only uninterrupted requests",
  "project_completeness_reviewer",
  "autonomous_reviewer",
  "cannot guarantee mathematically zero seconds of inactivity",
  "human checkpoint",
  "Preflight Schema",
  "Phase Budget",
  "Global Guardrails",
  "progress-event.schema.json",
  "stop_continue_guard.py"
];

for (const phrase of requiredSkillPhrases) {
  assert.ok(includesLoose(skillText, phrase), `skill missing phrase: ${phrase}`);
}

assert.ok(autonomousText.includes('name = "autonomous_reviewer"'));
assert.ok(autonomousText.includes('sandbox_mode = "read-only"'));
assert.ok(completenessText.includes('name = "project_completeness_reviewer"'));
assert.ok(completenessText.includes('sandbox_mode = "read-only"'));
assert.ok(completenessText.includes("Validation gaps"));

assert.ok(configText.includes('approval_policy = "never"'));
assert.ok(configText.includes('sandbox_mode = "danger-full-access"'));
assert.equal(configToml.approval_policy, "never");
assert.equal(configToml.sandbox_mode, "danger-full-access");
assert.equal(configToml.agents.max_threads, 4);
assert.equal(configToml.agents.max_depth, 1);
assert.equal(configToml.agents.job_max_runtime_seconds, 1200);
assert.equal(autonomousToml.name, "autonomous_reviewer");
assert.equal(autonomousToml.sandbox_mode, "read-only");
assert.equal(completenessToml.name, "project_completeness_reviewer");
assert.equal(completenessToml.sandbox_mode, "read-only");
assert.ok(completenessToml.developer_instructions.includes("Do not edit files"));
assert.deepEqual(
  specializedTomls.map((item) => [item.name, item.sandbox_mode]),
  [
    ["security_reviewer", "read-only"],
    ["test_coverage_reviewer", "read-only"],
    ["architecture_reviewer", "read-only"],
    ["ui_artifact_reviewer", "read-only"]
  ]
);

assert.ok(hooks.hooks.PreToolUse.length >= 1);
assert.ok(hooks.hooks.Stop.length >= 1);
assert.ok(existsSync(preToolHook));
assert.ok(existsSync(stopHook));
assert.ok(safetyRulesText.includes('decision="forbidden"'));
assert.equal(safetyRulesText.includes('pattern=["git", "push"]'), false);
assert.equal(safetyRulesText.includes('pattern=["gh", "pr", "create"]'), false);
assert.ok(safetyRulesText.includes('pattern=["terraform", "apply"]'));

for (const doc of schemaDocs) {
  assert.ok(Array.isArray(doc.required));
  assert.ok(doc.required.length > 5);
}

const safeHookResult = runHook(preToolHook, {
  tool_name: "Bash",
  tool_input: { command: "npm test" }
});
assert.equal(safeHookResult, "");

const pushHookResult = runHook(preToolHook, {
  tool_name: "Bash",
  tool_input: { command: "git push origin main" }
});
assert.equal(pushHookResult, "");

const prHookResult = runHook(preToolHook, {
  tool_name: "Bash",
  tool_input: { command: "gh pr create --title test --body test" }
});
assert.equal(prHookResult, "");

const denyHookResult = JSON.parse(runHook(preToolHook, {
  tool_name: "Bash",
  tool_input: { command: "terraform apply" }
}));
assert.equal(denyHookResult.decision, "deny");

const completedStopResult = runHook(stopHook, {
  cwd: root,
  stop_hook_active: false
});
assert.equal(completedStopResult, "");

const blockSampleRoot = mkdtempSync(join(tmpdir(), "codex-hook-block-"));
const blockRunDir = join(blockSampleRoot, ".codex/app-active-runs/running-sample");
mkdirSync(blockRunDir, { recursive: true });
writeFileSync(join(blockRunDir, "run-state.json"), JSON.stringify({
  run_id: "running-sample",
  target: blockSampleRoot,
  goal: "prove Stop hook blocks incomplete active runs",
  mode: "app_active_session",
  status: "running",
  stop_guard: true,
  start_time: "2026-05-15T00:00:00+08:00",
  deadline: "2099-01-01T00:00:00+00:00",
  last_cycle_at: "2026-05-15T00:00:00+08:00",
  completed_cycles: 1,
  project_size: "medium",
  current_phase: "implementation",
  stop_reason: ""
}, null, 2));
const blockStopResult = JSON.parse(runHook(stopHook, {
  cwd: blockSampleRoot,
  stop_hook_active: false
}));
assert.equal(blockStopResult.decision, "block");

const progressRequired = [
  "automation_id",
  "target",
  "goal",
  "total_cycles",
  "completed_cycles",
  "last_cycle_at",
  "stop_reason",
  "progress.jsonl",
  "project_size",
  "classification_evidence",
  "cycle_count",
  "commands_run",
  "validation_result",
  "self_review",
  "reviewer_events",
  "reviewer_findings_addressed",
  "blockers",
  "next_step"
];

for (const field of progressRequired) {
  assert.ok(progressText.includes(field), `progress log missing field: ${field}`);
}

assert.ok(progressText.includes(root), "progress log should record the absolute Unicode target path");
assert.ok(existsSync(root), "fixture root should resolve from current Unicode path");
assert.equal(runState.status, "completed");
assert.equal(runState.stop_guard, true);
assert.ok(runState.stop_reason);

const progressEvents = read(progressJsonl)
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));
assert.ok(progressEvents.length >= 4);
for (const event of progressEvents) {
  for (const field of schemaDocs[1].required) {
    assert.ok(field in event, `progress event missing ${field}`);
  }
}

const sourceCount = readdirSync(join(root, "src"), { recursive: true })
  .filter((name) => String(name).endsWith(".js")).length;
assert.ok(sourceCount >= 6, `expected multi-area source files, found ${sourceCount}`);

console.log("final validation passed");
