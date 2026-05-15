import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(root);
const codexHome = mkdtempSync(join(tmpdir(), "codex-final-fixture-home-"));

execFileSync("node", [
  join(repoRoot, "scripts/install.mjs"),
  "--merge",
  `--codex-home=${codexHome}`
], { encoding: "utf8" });

writeFileSync(join(codexHome, "config.toml"), [
  'approval_policy = "never"',
  'sandbox_mode = "danger-full-access"',
  "",
  "[agents]",
  "max_threads = 4",
  "max_depth = 1",
  "job_max_runtime_seconds = 1200",
  ""
].join("\n"));

const globalAgents = join(codexHome, "AGENTS.md");
const skillFile = join(codexHome, "skills/timed-autonomous-run/SKILL.md");
const autonomousReviewer = join(codexHome, "agents/autonomous_reviewer.toml");
const completenessReviewer = join(codexHome, "agents/project_completeness_reviewer.toml");
const specializedReviewers = [
  join(codexHome, "agents/security_reviewer.toml"),
  join(codexHome, "agents/test_coverage_reviewer.toml"),
  join(codexHome, "agents/architecture_reviewer.toml"),
  join(codexHome, "agents/ui_artifact_reviewer.toml")
];
const configFile = join(codexHome, "config.toml");
const hooksJson = join(codexHome, "hooks.json");
const preToolHook = join(codexHome, "hooks/pre_tool_use_policy.py");
const stopHook = join(codexHome, "hooks/stop_continue_guard.py");
const safetyRules = join(codexHome, "rules/autonomous-safety.rules");
const schemas = [
  join(codexHome, "skills/timed-autonomous-run/schemas/preflight.schema.json"),
  join(codexHome, "skills/timed-autonomous-run/schemas/progress-event.schema.json"),
  join(codexHome, "skills/timed-autonomous-run/schemas/run-state.schema.json"),
  join(codexHome, "skills/timed-autonomous-run/schemas/improvement-candidate.schema.json"),
  join(codexHome, "skills/timed-autonomous-run/schemas/run-retrospective.schema.json")
];
const fixtureRunDir = join(mkdtempSync(join(tmpdir(), "codex-final-fixture-run-")), ".codex/app-active-runs/final-readiness-test");
mkdirSync(fixtureRunDir, { recursive: true });
const progressLog = join(fixtureRunDir, "progress.md");
const runStateFile = join(fixtureRunDir, "run-state.json");
const progressJsonl = join(fixtureRunDir, "progress.jsonl");
const lessonsLearned = join(fixtureRunDir, "lessons-learned.md");
const improvementCandidates = join(fixtureRunDir, "improvement-candidates.jsonl");
const promotionReport = join(fixtureRunDir, "promotion-report.md");

writeFileSync(progressLog, `# Final Readiness Test Progress

- automation_id: app-active-final-readiness-test
- target: <fixture-root>
- goal: Validate the Codex App autonomous run setup before real use.
- mode: Codex App active session, not heartbeat, not CLI/local runner.
- machine_logs: run-state.json and progress.jsonl are present for resume, hook checks, and audit.
- start_time: 2026-05-15T18:55:00+08:00
- deadline: bounded by current final readiness test turn
- total_cycles: 4
- completed_cycles: 4
- last_cycle_at: 2026-05-15T19:05:41+08:00
- elapsed_minutes: 10
- cycle_count: 4
- stop_reason: final readiness validation completed with reviewer caveats addressed or recorded
- project_size: medium
- classification_evidence: multiple source areas, docs, tests, multiple validation commands, dedicated review policy, and explicit completeness-review requirement.
- commands_run: npm run lint; npm run build; npm test; TOML parse; automation scan; policy grep; fixture file inventory; hook script samples; independent autonomous_reviewer review.
- validation_result: lint passed; build passed; final validation passed after structured TOML assertions, Windows/Unicode path handling, progress-log required fields, hooks/rules checks, and active-run machine logs.
- self_review: global rules and skill enforce App-only long active sessions for no-pause requests, prohibit CLI/local runner for that mode, require progress logs, require reviewer events for medium/large projects, and keep high-risk actions as human checkpoints.
- reviewer_events: autonomous_reviewer final readiness review returned "ready with caveats"; P0 none; P1 none; P2 progress log closure, structured TOML validation, Windows/Unicode path evidence; P3 policy-only safety under danger-full-access.
- reviewer_findings_addressed: fixed progress log required fields and final status; added structured TOML parse/asserts to final validation; added portable fixture target evidence; recorded danger-full-access safety as residual risk.
- learning_artifacts: lessons-learned.md; improvement-candidates.jsonl; promotion-report.md; run-retrospective.schema.json; improvement-candidate.schema.json.
- learning_candidates: 1 documentation candidate generated from the final-readiness fixture evidence.
- auto_applied: 1 low-risk documentation/validation candidate recorded in fixture artifacts.
- shadowed: 0 in this fixture; high-risk global safety changes would go to improvement-backlog.jsonl.
- rejected: 0.
- promotion_validation: final validation reads learning artifacts, validates the latest improvement candidate shape, and confirms high-risk candidates are shadow-only.
- independent_reviewer_skipped_reason: none
- changed_files_or_areas: final fixture tests and progress log; autonomous learning artifacts; global config restored [agents] limits; global safety rules, hooks, schemas, and specialized reviewer agents.
- blockers: none
- residual_risk: literal zero idle time cannot be guaranteed by a desktop App runtime; danger-full-access plus approval_policy=never means safety relies on narrow rules and hook guardrails for high-impact actions.
- next_step: ready for first real medium/large project run with main agent plus read-only project_completeness_reviewer.
`);

writeFileSync(runStateFile, JSON.stringify({
  run_id: "app-active-final-readiness-test",
  target: "<fixture-root>",
  goal: "Validate the Codex App autonomous run setup before real use.",
  mode: "app_active_session",
  status: "completed",
  stop_guard: true,
  start_time: "2026-05-15T18:55:00+08:00",
  deadline: "2026-05-15T19:05:41+08:00",
  last_cycle_at: "2026-05-15T19:05:41+08:00",
  completed_cycles: 4,
  project_size: "medium",
  current_phase: "final_review",
  stop_reason: "final readiness validation completed with reviewer caveats addressed or recorded"
}, null, 2));

writeFileSync(progressJsonl, [
  {
    timestamp: "2026-05-15T18:56:00+08:00",
    cycle: 1,
    phase: "orientation",
    elapsed_minutes: 1,
    task: "Create medium final-readiness fixture and inspect global setup.",
    files_changed: ["codex-app-final-fixture"],
    commands: ["TOML parse", "automation scan"],
    validation: "initial validation exposed fixture path handling issue",
    self_review: "failure was in fixture path handling, not policy",
    reviewer: "pending",
    blocker: "none",
    next_step: "fix Windows/Unicode path handling and rerun"
  },
  {
    timestamp: "2026-05-15T18:58:00+08:00",
    cycle: 2,
    phase: "implementation",
    elapsed_minutes: 3,
    task: "Fix fixture validation for Windows/Unicode paths and Markdown wrapping.",
    files_changed: ["tests/final-validate.js", "tests/lint-rules.js"],
    commands: ["npm run lint", "npm run build", "npm test"],
    validation: "lint/build passed; test false positive fixed",
    self_review: "normalized whitespace and fileURLToPath are required",
    reviewer: "pending",
    blocker: "none",
    next_step: "rerun full validation and spawn independent reviewer"
  },
  {
    timestamp: "2026-05-15T19:03:00+08:00",
    cycle: 3,
    phase: "hardening",
    elapsed_minutes: 8,
    task: "Run independent reviewer and address P2 findings.",
    files_changed: ["tests/final-validate.js", "progress.md", "config.toml"],
    commands: ["npm run lint", "npm run build", "npm test", "TOML parse"],
    validation: "all checks passed after structured TOML and path assertions",
    self_review: "reviewer P2 findings were valid and fixed",
    reviewer: "autonomous_reviewer returned ready with caveats; no P0/P1",
    blocker: "none",
    next_step: "add final run-state and prepare readiness report"
  },
  {
    timestamp: "2026-05-15T19:05:41+08:00",
    cycle: 4,
    phase: "final_review",
    elapsed_minutes: 10,
    task: "Close final readiness run.",
    files_changed: ["run-state.json", "progress.jsonl", "progress.md"],
    commands: ["npm run lint", "npm run build", "npm test", "final TOML parse"],
    validation: "passed",
    self_review: "ready for real medium/large App active-session runs with residual risks recorded",
    reviewer: "findings addressed or recorded",
    blocker: "none",
    next_step: "ready for first real medium/large project run"
  }
].map((event) => JSON.stringify(event)).join("\n") + "\n");

writeFileSync(lessonsLearned, `# Lessons Learned

- Final readiness checks should validate learning artifacts, not just progress logs.
- High-risk global safety changes remain shadow-only even when automation should stay high.
`);

writeFileSync(improvementCandidates, `${JSON.stringify({
  timestamp: "2026-05-15T19:05:41+08:00",
  run_id: "app-active-final-readiness-test",
  source: "self_review",
  category: "documentation",
  risk: "low",
  scope: "repo-template",
  problem: "final fixture did not previously prove that autonomous learning artifacts were installed and readable",
  evidence: "final validation fixture exercises installed templates and active-run logs",
  proposal: "add fixture-level learning artifact assertions",
  target_files: ["codex-app-final-fixture/tests/final-validate.js"],
  validation: "npm --prefix codex-app-final-fixture test",
  promotion_decision: "auto-apply",
  status: "applied",
  notes: "low-risk validation and documentation coverage"
})}\n`);

writeFileSync(promotionReport, `# Promotion Report

- auto_applied: 1
- shadowed: 0
- rejected: 0
- validation: final validation reads learning artifacts and schema metadata.
`);

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
  "autonomous learning artifacts",
  "improvement-backlog.jsonl",
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
  "improvement-candidate.schema.json",
  "run-retrospective.schema.json",
  "Autonomous Learning Loop",
  "High-risk candidates are never auto-applied",
  "documentation",
  "performance",
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
assert.ok(safetyRulesText.includes('pattern=["vercel", "deploy"]'));
assert.ok(safetyRulesText.includes('pattern=["drop", "database"]'));

for (const doc of schemaDocs) {
  assert.ok(Array.isArray(doc.required));
  assert.ok(doc.required.length > 5);
}
assert.ok(schemaDocs[3].required.includes("promotion_decision"));
assert.ok(schemaDocs[3].properties.category.includes("documentation"));
assert.ok(schemaDocs[3].properties.category.includes("performance"));
assert.ok(schemaDocs[4].required.includes("learning_candidates"));

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

writeFileSync(join(blockSampleRoot, ".codex/app-active-runs/current"), "partial-sample");
const partialRunDir = join(blockSampleRoot, ".codex/app-active-runs/partial-sample");
mkdirSync(partialRunDir, { recursive: true });
writeFileSync(join(partialRunDir, "run-state.json"), JSON.stringify({
  run_id: "partial-sample",
  target: blockSampleRoot,
  goal: "prove Stop hook enforces progress schema",
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
writeFileSync(join(partialRunDir, "progress.md"), "# Progress\n");
writeFileSync(join(partialRunDir, "progress.jsonl"), `${JSON.stringify({
  timestamp: "2026-05-15T00:00:00+08:00",
  cycle: 1,
  task: "partial event",
  commands: [],
  validation: "partial",
  reviewer: "pending",
  blocker: "none",
  next_step: "continue"
})}\n`);
const partialStopResult = JSON.parse(runHook(stopHook, {
  cwd: blockSampleRoot,
  stop_hook_active: false
}));
assert.equal(partialStopResult.decision, "block");
assert.ok(partialStopResult.reason.includes("phase"));

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
  "learning_artifacts",
  "learning_candidates",
  "auto_applied",
  "shadowed",
  "rejected",
  "promotion_validation",
  "blockers",
  "next_step"
];

for (const field of progressRequired) {
  assert.ok(progressText.includes(field), `progress log missing field: ${field}`);
}

assert.ok(progressText.includes("<fixture-root>"), "progress log should use the portable fixture target placeholder");
assert.ok(existsSync(root), "fixture root should resolve from current Unicode path");
assert.equal(runState.status, "completed");
assert.equal(runState.stop_guard, true);
assert.ok(runState.stop_reason);
assert.ok(read(lessonsLearned).includes("Lessons Learned"));
assert.ok(read(promotionReport).includes("auto_applied"));
const latestCandidate = JSON.parse(read(improvementCandidates).trim().split(/\r?\n/).at(-1));
for (const field of schemaDocs[3].required) {
  assert.ok(field in latestCandidate, `improvement candidate missing ${field}`);
}
assert.equal(latestCandidate.promotion_decision, "auto-apply");
assert.equal(latestCandidate.status, "applied");

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
