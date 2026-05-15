import assert from "node:assert/strict";
import { execFileSync, execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const templateRoot = join(repoRoot, "templates/codex");

function read(path) {
  assert.ok(existsSync(path), `missing ${path}`);
  return readFileSync(path, "utf8");
}

function readPngSize(path) {
  const data = readFileSync(path);
  assert.equal(data.toString("ascii", 1, 4), "PNG", `${path} is not a PNG`);
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20)
  };
}

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if ([".git", ".codex", "node_modules"].includes(name)) continue;
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function parseToml(path) {
  const script = [
    "import json, pathlib, sys, tomllib",
    "data = tomllib.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8-sig'))",
    "print(json.dumps(data, ensure_ascii=False))"
  ].join("\n");
  return JSON.parse(execFileSync("python", ["-c", script, path], { encoding: "utf8" }));
}

function runPython(path, event) {
  return execFileSync("python", [path], {
    input: JSON.stringify(event),
    encoding: "utf8"
  }).trim();
}

const requiredFiles = [
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "package.json",
  ".gitignore",
  ".github/workflows/validate.yml",
  ".github/ISSUE_TEMPLATE/bug_report.md",
  ".github/ISSUE_TEMPLATE/feature_request.md",
  ".github/pull_request_template.md",
  "docs/app-only-continuous-runs.md",
  "docs/assets/hooks-trust.svg",
  "docs/assets/promo-background-image2.png",
  "docs/assets/promo-en.png",
  "docs/assets/promo-en.webp",
  "docs/assets/promo-zh.png",
  "docs/assets/promo-zh.webp",
  "docs/demo.md",
  "docs/faq.md",
  "docs/permissions.md",
  "docs/installation.md",
  "docs/open-source-readiness.md",
  "scripts/Install-CodexAppAutonomous.ps1",
  "scripts/Uninstall-CodexAppAutonomous.ps1",
  "scripts/bench-hooks.mjs",
  "scripts/github-release.mjs",
  "scripts/install.mjs",
  "scripts/promote-learning.mjs",
  "scripts/summarize-learning.mjs",
  "scripts/uninstall.mjs",
  "tests/validate-long-run-simulation.js",
  "tests/validate-rules.js",
  "examples/long-run-simulation/README.md",
  "examples/long-run-simulation/package.json",
  "examples/long-run-simulation/src/workflow.js",
  "examples/long-run-simulation/tests/validate.js",
  "examples/long-run-simulation/codex-app-active-runs/current",
  "examples/long-run-simulation/codex-app-active-runs/medium-dashboard-hardening/run-state.json",
  "examples/long-run-simulation/codex-app-active-runs/medium-dashboard-hardening/progress.jsonl",
  "examples/long-run-simulation/codex-app-active-runs/medium-dashboard-hardening/improvement-candidates.jsonl",
  "examples/long-run-simulation/codex-app-active-runs/medium-dashboard-hardening/promotion-report.json",
  "examples/long-run-simulation/codex-app-active-runs/medium-dashboard-hardening/promotion-report.md",
  "examples/long-run-simulation/codex-app-active-runs/medium-dashboard-hardening/run-retrospective.json",
  "examples/medium-project/README.md",
  "examples/medium-project/package.json",
  "examples/medium-project/src/policy.js",
  "examples/medium-project/tests/validate.js",
  "templates/codex/AGENTS.md",
  "templates/codex/hooks.json.template",
  "templates/codex/hooks/pre_tool_use_policy.py",
  "templates/codex/hooks/stop_continue_guard.py",
  "templates/codex/rules/autonomous-safety.rules",
  "templates/codex/skills/timed-autonomous-run/SKILL.md",
  "templates/codex/skills/timed-autonomous-run/schemas/preflight.schema.json",
  "templates/codex/skills/timed-autonomous-run/schemas/progress-event.schema.json",
  "templates/codex/skills/timed-autonomous-run/schemas/run-state.schema.json",
  "templates/codex/skills/timed-autonomous-run/schemas/improvement-candidate.schema.json",
  "templates/codex/skills/timed-autonomous-run/schemas/learning-summary.schema.json",
  "templates/codex/skills/timed-autonomous-run/schemas/promotion-report.schema.json",
  "templates/codex/skills/timed-autonomous-run/schemas/run-retrospective.schema.json"
];

for (const file of requiredFiles) {
  assert.ok(existsSync(join(repoRoot, file)), `required file missing: ${file}`);
}

const legacyStart = ["Start", "CodexContinuousRun.ps1"].join("-");
const legacyStop = ["Stop", "CodexContinuousRun.ps1"].join("-");
const legacyRunnerDoc = ["continuous", "runner.md"].join("-");
assert.equal(existsSync(join(repoRoot, "tools", legacyStart)), false);
assert.equal(existsSync(join(repoRoot, "tools", legacyStop)), false);
assert.equal(existsSync(join(repoRoot, "docs", legacyRunnerDoc)), false);
assert.equal(existsSync(join(repoRoot, "automation-smoke-project", "package.json")), false);
assert.equal(existsSync(join(repoRoot, "medium-fixture-project", "package.json")), false);

const textFiles = walk(repoRoot).filter((file) => {
  const name = file.toLowerCase();
  return /\.(md|json|js|toml|rules|py|ps1|template|gitignore|license)$/.test(name)
    || ["README.md", "LICENSE", "SECURITY.md", "CONTRIBUTING.md"].includes(name.split(/[\\/]/).pop());
});

const bannedPatterns = [
  new RegExp(["C:", "Users", ["12", "939"].join("")].join("\\\\"), "i"),
  new RegExp(["codex", "local", "access"].join("_"), "i"),
  new RegExp(["-----BEGIN", "PRIVATE", "KEY-----"].join(" ")),
  /api[_-]?key\s*[:=]/i,
  /password\s*[:=]/i,
  /token\s*[:=]/i,
  new RegExp(legacyStart.replace(".", "\\."), "i"),
  new RegExp(legacyStop.replace(".", "\\."), "i")
];

for (const file of textFiles) {
  const rel = relative(repoRoot, file);
  const text = read(file);
  for (const pattern of bannedPatterns) {
    assert.equal(pattern.test(text), false, `banned pattern ${pattern} in ${rel}`);
  }
}

const hooksTemplate = read(join(templateRoot, "hooks.json.template"));
assert.ok(hooksTemplate.includes("{{CODEX_HOME_WINDOWS_ESCAPED}}"));
const renderedHooks = JSON.parse(hooksTemplate.replaceAll("{{CODEX_HOME_WINDOWS_ESCAPED}}", "C:\\\\Users\\\\example\\\\.codex"));
const preToolMatcher = renderedHooks.hooks.PreToolUse.map((entry) => entry.matcher).join("|");
assert.ok(preToolMatcher.includes("apply_patch"));
assert.equal(/Bash|shell_command/.test(preToolMatcher), false);

const packageJson = JSON.parse(read(join(repoRoot, "package.json")));
const changelog = read(join(repoRoot, "CHANGELOG.md"));
const topChangelogVersion = changelog.match(/^##\s+([0-9]+\.[0-9]+\.[0-9]+)/m)?.[1];
assert.equal(packageJson.private, false);
assert.equal(packageJson.version, topChangelogVersion);
assert.equal(packageJson.repository.url, "git+https://github.com/wxmb01/codex-app-autonomous-runs.git");
assert.ok(packageJson.bugs.url.includes("/issues"));
assert.ok(packageJson.homepage.includes("codex-app-autonomous-runs#readme"));
assert.ok(packageJson.files.includes("templates/"));
assert.ok(packageJson.files.includes("scripts/"));
assert.ok(packageJson.scripts["install:dry-run"]);
assert.ok(packageJson.scripts["uninstall:dry-run"]);
assert.ok(packageJson.scripts["test:example"]);
assert.ok(packageJson.scripts["test:long-run"]);
assert.ok(packageJson.scripts["test:rules"]);
assert.ok(packageJson.scripts["test:all"]);
assert.ok(packageJson.scripts["bench:hooks"]);
assert.ok(packageJson.scripts["learning:summary"]);
assert.ok(packageJson.scripts["github:release"]);
assert.ok(packageJson.scripts["promote:learning"]);

const agentsMd = read(join(templateRoot, "AGENTS.md"));
const skillMd = read(join(templateRoot, "skills/timed-autonomous-run/SKILL.md"));
const compactAgentsMd = agentsMd.replace(/\s+/g, " ");
const compactSkillMd = skillMd.replace(/\s+/g, " ");
assert.ok(compactAgentsMd.includes("1 hour or more"));
assert.ok(compactAgentsMd.includes("explicit user authorization"));
assert.ok(compactSkillMd.includes("1 hour or more is explicit"));
assert.ok(compactSkillMd.includes("start at least one read-only reviewer"));
assert.ok(skillMd.includes("Reviewer authorization:"));
assert.ok(compactSkillMd.includes("user explicitly authorizes read-only reviewer subagents"));
assert.ok(compactAgentsMd.includes("autonomous learning artifacts"));
assert.ok(compactAgentsMd.includes("improvement-candidates.jsonl"));
assert.ok(compactAgentsMd.includes("improvement-backlog.jsonl"));
assert.ok(compactAgentsMd.includes("Do not lower automation rate"));
assert.ok(compactAgentsMd.includes("sync it into Codex global files"));
assert.ok(compactAgentsMd.includes("commit and push the repository update to GitHub"));
assert.ok(compactAgentsMd.includes("promotion-report.json"));
assert.ok(compactAgentsMd.includes("promote-learning.mjs"));
assert.ok(compactAgentsMd.includes("summarize-learning.mjs"));
assert.ok(compactAgentsMd.includes("Main-agent self-review alone is not enough"));
assert.ok(compactSkillMd.includes("Autonomous Learning Loop"));
assert.ok(compactSkillMd.includes("lessons-learned.md"));
assert.ok(compactSkillMd.includes("improvement-candidates.jsonl"));
assert.ok(compactSkillMd.includes("promotion-report.md"));
assert.ok(compactSkillMd.includes("promotion-report.json"));
assert.ok(compactSkillMd.includes("promotion-report.schema.json"));
assert.ok(compactSkillMd.includes("promote-learning.mjs"));
assert.ok(compactSkillMd.includes("summarize-learning.mjs"));
assert.ok(compactSkillMd.includes("improvement-backlog.jsonl"));
assert.ok(compactSkillMd.includes("High-risk candidates are never auto-applied"));
assert.ok(compactSkillMd.includes("Post-promotion sync"));
assert.ok(compactSkillMd.includes("node scripts/install.mjs --merge"));
assert.ok(compactSkillMd.includes("push `main` to GitHub"));
assert.ok(compactSkillMd.includes("GitHub API fallback"));
assert.ok(compactSkillMd.includes("documentation"));
assert.ok(compactSkillMd.includes("performance"));

const readme = read(join(repoRoot, "README.md"));
const faq = read(join(repoRoot, "docs/faq.md"));
assert.ok(readme.includes("Autonomous Execution Stack"));
assert.ok(readme.includes("Autonomous Learning Loop"));
assert.ok(readme.includes("What This Adds"));
assert.ok(readme.includes("CLI/local runner"));
assert.ok(readme.includes("every promoted learning iteration also syncs"));
assert.ok(readme.includes("Deterministic Promotion"));
assert.ok(readme.includes("中文"));
assert.equal(readme.includes("涓"), false);
assert.equal(readme.includes("鏄"), false);
assert.equal(readme.includes("瀹"), false);
assert.ok(faq.includes("every promoted learning iteration must reinstall"));
assert.ok(faq.includes("promotion-report.json"));

assert.deepEqual(readPngSize(join(repoRoot, "docs/assets/promo-en.png")), { width: 1280, height: 640 });
assert.deepEqual(readPngSize(join(repoRoot, "docs/assets/promo-zh.png")), { width: 1280, height: 640 });
assert.deepEqual(readPngSize(join(repoRoot, "docs/assets/promo-background-image2.png")), { width: 1672, height: 941 });
for (const asset of ["promo-en.webp", "promo-zh.webp"]) {
  const data = readFileSync(join(repoRoot, "docs/assets", asset));
  assert.equal(data.toString("ascii", 0, 4), "RIFF", `${asset} should be a WebP RIFF container`);
  assert.equal(data.toString("ascii", 8, 12), "WEBP", `${asset} should be a WebP asset`);
}

const agentFiles = [
  "autonomous_reviewer.toml",
  "project_completeness_reviewer.toml",
  "security_reviewer.toml",
  "test_coverage_reviewer.toml",
  "architecture_reviewer.toml",
  "ui_artifact_reviewer.toml"
];

for (const file of agentFiles) {
  const data = parseToml(join(templateRoot, "agents", file));
  assert.equal(data.sandbox_mode, "read-only", `${file} must be read-only`);
  assert.ok(data.developer_instructions.includes("Do not edit files"));
}

for (const schema of [
  "preflight.schema.json",
  "progress-event.schema.json",
  "run-state.schema.json",
  "improvement-candidate.schema.json",
  "learning-summary.schema.json",
  "promotion-report.schema.json",
  "run-retrospective.schema.json"
]) {
  const data = JSON.parse(read(join(templateRoot, "skills/timed-autonomous-run/schemas", schema)));
  assert.ok(Array.isArray(data.required));
  assert.ok(data.required.length > 5);
}
const improvementSchema = JSON.parse(read(join(
  templateRoot,
  "skills/timed-autonomous-run/schemas/improvement-candidate.schema.json"
)));
for (const field of ["category", "risk", "promotion_decision", "status"]) {
  assert.ok(improvementSchema.required.includes(field), `improvement schema missing ${field}`);
}
assert.ok(improvementSchema.properties.category.includes("documentation"));
assert.ok(improvementSchema.properties.category.includes("performance"));
const promotionSchema = JSON.parse(read(join(
  templateRoot,
  "skills/timed-autonomous-run/schemas/promotion-report.schema.json"
)));
for (const field of ["install_result", "git", "github", "reviewer", "steps"]) {
  assert.ok(promotionSchema.required.includes(field), `promotion schema missing ${field}`);
}
assert.ok(promotionSchema.reviewer_required_for_categories.includes("global-prompt"));
assert.ok(promotionSchema.reviewer_required_for_categories.includes("global-validation"));
assert.ok(promotionSchema.reviewer_required_for_categories.includes("performance"));

const rules = read(join(templateRoot, "rules/autonomous-safety.rules"));
assert.ok(rules.includes('pattern=["npm", "publish"]'));
assert.ok(rules.includes('pattern=["terraform", "apply"]'));
assert.ok(rules.includes('pattern=["vercel", "deploy"]'));
assert.ok(rules.includes('pattern=["drop", "database"]'));
assert.equal(rules.includes('pattern=["git", "push"]'), false);
assert.equal(rules.includes('pattern=["gh", "pr", "create"]'), false);

const preToolHook = join(templateRoot, "hooks/pre_tool_use_policy.py");
for (const command of ["npm test", "git push origin main", "gh pr create --title test --body test"]) {
  const out = runPython(preToolHook, { tool_name: "Bash", tool_input: { command } });
  assert.equal(out, "", `${command} should be allowed`);
}

for (const command of ["npm publish", "terraform apply", "kubectl delete pod x", "Remove-Item -Recurse -Force C:\\tmp\\x"]) {
  const out = JSON.parse(runPython(preToolHook, { tool_name: "Bash", tool_input: { command } }));
  assert.equal(out.decision, "deny", `${command} should be denied`);
}

assert.equal(runPython(preToolHook, {
  tool_name: "apply_patch",
  tool_input: {
    patch: "*** Begin Patch\n*** Update File: docs/example.md\n@@\n+Mention npm publish in documentation.\n*** End Patch\n"
  }
}), "");
assert.equal(JSON.parse(runPython(preToolHook, {
  tool_name: "apply_patch",
  tool_input: {
    patch: "*** Begin Patch\n*** Add File: .env\n+EXAMPLE=value\n*** End Patch\n"
  }
})).decision, "deny");

const stopHook = join(templateRoot, "hooks/stop_continue_guard.py");

function makeProgressEvent(overrides = {}) {
  return {
    timestamp: "2026-01-01T00:00:00+00:00",
    cycle: 1,
    phase: "hardening",
    elapsed_minutes: 1,
    task: "validate active run state",
    files_changed: [],
    commands: [],
    validation: "passed",
    self_review: "no issue found",
    reviewer: "not needed this cycle",
    blocker: "none",
    next_step: "continue",
    ...overrides
  };
}

function makeLearningCandidate(overrides = {}) {
  return {
    timestamp: "2026-01-01T00:00:00+00:00",
    run_id: "learning",
    source: "self_review",
    category: "documentation",
    risk: "low",
    scope: "repo-template",
    problem: "learning artifacts need validation coverage",
    evidence: "stop hook validation test",
    proposal: "keep learning artifacts machine-checkable",
    target_files: ["templates/codex/skills/timed-autonomous-run/SKILL.md"],
    validation: "npm test",
    promotion_decision: "auto-apply",
    status: "applied",
    ...overrides
  };
}

function makePromotionReport(overrides = {}) {
  return {
    generated_at: "2026-01-01T00:00:00+00:00",
    repository: "stop-hook-test",
    version: "0.0.0",
    status: "pending",
    promotion: {
      categories: ["documentation"],
      changed_files: [],
      candidate_files: [],
      validation_policy: "stop hook validation fixture"
    },
    validation: [],
    install_result: {
      status: "skipped",
      codex_home: "stop-hook-test",
      manifest_version: "0.0.0"
    },
    git: {
      branch: "main",
      commit_sha: "pending",
      tag: null
    },
    github: {
      push_result: {
        status: "skipped"
      },
      release: {
        status: "skipped"
      }
    },
    reviewer: {
      required: false,
      used: false,
      agent_type: "none",
      result: "",
      findings: "not required for fixture"
    },
    steps: [],
    ...overrides
  };
}

function createRunningActiveRun(prefix, runName, options = {}) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const activeRoot = join(root, ".codex/app-active-runs");
  const runDir = join(activeRoot, runName);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(join(activeRoot, "current"), runName);
  writeFileSync(join(runDir, "run-state.json"), JSON.stringify({
    run_id: runName,
    target: root,
    goal: "validate running active run",
    mode: "app_active_session",
    status: "running",
    stop_guard: true,
    start_time: "2026-01-01T00:00:00+00:00",
    deadline: "2099-01-01T00:00:00+00:00",
    last_cycle_at: "2026-01-01T00:00:00+00:00",
    completed_cycles: 1,
    project_size: "medium",
    current_phase: "hardening",
    stop_reason: ""
  }));
  writeFileSync(join(runDir, "progress.md"), "# Progress\n");
  writeFileSync(join(runDir, "progress.jsonl"), `${JSON.stringify(makeProgressEvent(options.progressEvent))}\n`);
  writeFileSync(join(runDir, "lessons-learned.md"), "# Lessons Learned\n\n- Keep working.\n");
  writeFileSync(join(runDir, "improvement-candidates.jsonl"), `${JSON.stringify(options.candidate ?? makeLearningCandidate({
    run_id: runName
  }))}\n`);
  writeFileSync(join(runDir, "promotion-report.md"), "# Promotion Report\n\n- auto_applied: 1\n");
  if (options.writePromotionJson !== false) {
    writeFileSync(join(runDir, "promotion-report.json"), `${JSON.stringify(options.promotionReport ?? makePromotionReport())}\n`);
  }
  return { root, runDir };
}

const completedRoot = mkdtempSync(join(tmpdir(), "codex-completed-"));
const completedRun = join(completedRoot, ".codex/app-active-runs/done");
mkdirSync(completedRun, { recursive: true });
writeFileSync(join(completedRun, "run-state.json"), JSON.stringify({
  run_id: "done",
  target: completedRoot,
  goal: "completed run should not block",
  mode: "app_active_session",
  status: "completed",
  stop_guard: true,
  start_time: "2026-01-01T00:00:00+00:00",
  deadline: "2026-01-01T00:01:00+00:00",
  last_cycle_at: "2026-01-01T00:01:00+00:00",
  completed_cycles: 1,
  project_size: "small",
  current_phase: "final_review",
  stop_reason: "completed"
}));
assert.equal(runPython(stopHook, { cwd: completedRoot, stop_hook_active: false }), "");

const runningRoot = mkdtempSync(join(tmpdir(), "codex-running-"));
const runningRun = join(runningRoot, ".codex/app-active-runs/running");
mkdirSync(runningRun, { recursive: true });
writeFileSync(join(runningRoot, ".codex/app-active-runs/current"), "running");
writeFileSync(join(runningRun, "run-state.json"), JSON.stringify({
  run_id: "running",
  target: runningRoot,
  goal: "running run should block if logs are incomplete",
  mode: "app_active_session",
  status: "running",
  stop_guard: true,
  start_time: "2026-01-01T00:00:00+00:00",
  deadline: "2099-01-01T00:00:00+00:00",
  last_cycle_at: "2026-01-01T00:00:00+00:00",
  completed_cycles: 1,
  project_size: "medium",
  current_phase: "implementation",
  stop_reason: ""
}));
const block = JSON.parse(runPython(stopHook, { cwd: runningRoot, stop_hook_active: false }));
assert.equal(block.decision, "block");

const partialRun = join(runningRoot, ".codex/app-active-runs/partial");
mkdirSync(partialRun, { recursive: true });
writeFileSync(join(runningRoot, ".codex/app-active-runs/current"), "partial");
writeFileSync(join(partialRun, "run-state.json"), JSON.stringify({
  run_id: "partial",
  target: runningRoot,
  goal: "running run should block if progress event violates schema",
  mode: "app_active_session",
  status: "running",
  stop_guard: true,
  start_time: "2026-01-01T00:00:00+00:00",
  deadline: "2099-01-01T00:00:00+00:00",
  last_cycle_at: "2026-01-01T00:00:00+00:00",
  completed_cycles: 1,
  project_size: "medium",
  current_phase: "implementation",
  stop_reason: ""
}));
writeFileSync(join(partialRun, "progress.md"), "# Progress\n");
writeFileSync(join(partialRun, "progress.jsonl"), `${JSON.stringify({
  timestamp: "2026-01-01T00:00:00+00:00",
  cycle: 1,
  task: "partial schema event",
  commands: [],
  validation: "partial",
  reviewer: "pending",
  blocker: "none",
  next_step: "continue"
})}\n`);
const partialBlock = JSON.parse(runPython(stopHook, { cwd: runningRoot, stop_hook_active: false }));
assert.equal(partialBlock.decision, "block");
assert.ok(partialBlock.reason.includes("phase"));

const learningRoot = mkdtempSync(join(tmpdir(), "codex-learning-"));
const learningRun = join(learningRoot, ".codex/app-active-runs/learning");
mkdirSync(learningRun, { recursive: true });
writeFileSync(join(learningRoot, ".codex/app-active-runs/current"), "learning");
writeFileSync(join(learningRun, "run-state.json"), JSON.stringify({
  run_id: "learning",
  target: learningRoot,
  goal: "running run should block if learning artifacts are missing",
  mode: "app_active_session",
  status: "running",
  stop_guard: true,
  start_time: "2026-01-01T00:00:00+00:00",
  deadline: "2099-01-01T00:00:00+00:00",
  last_cycle_at: "2026-01-01T00:00:00+00:00",
  completed_cycles: 1,
  project_size: "medium",
  current_phase: "hardening",
  stop_reason: ""
}));
writeFileSync(join(learningRun, "progress.md"), "# Progress\n");
writeFileSync(join(learningRun, "progress.jsonl"), `${JSON.stringify({
  timestamp: "2026-01-01T00:00:00+00:00",
  cycle: 1,
  phase: "hardening",
  elapsed_minutes: 1,
  task: "check learning artifacts",
  files_changed: [],
  commands: [],
  validation: "passed",
  self_review: "learning artifacts still need to be recorded",
  reviewer: "not needed this cycle",
  blocker: "none",
  next_step: "write learning artifacts"
})}\n`);
const learningBlock = JSON.parse(runPython(stopHook, { cwd: learningRoot, stop_hook_active: false }));
assert.equal(learningBlock.decision, "block");
assert.ok(learningBlock.reason.includes("learning artifacts"));

const validLearning = createRunningActiveRun("codex-valid-learning-", "valid-learning");
const validLearningBlock = JSON.parse(runPython(stopHook, { cwd: validLearning.root, stop_hook_active: false }));
assert.equal(validLearningBlock.decision, "block");
assert.ok(validLearningBlock.reason.includes("Continue the next cycle"));

const missingPromotionJson = createRunningActiveRun("codex-missing-promotion-json-", "missing-promotion-json", {
  writePromotionJson: false
});
const missingPromotionJsonBlock = JSON.parse(runPython(stopHook, { cwd: missingPromotionJson.root, stop_hook_active: false }));
assert.equal(missingPromotionJsonBlock.decision, "block");
assert.ok(missingPromotionJsonBlock.reason.includes("promotion-report.json"));

const missingReviewerPromotion = createRunningActiveRun("codex-missing-reviewer-promotion-", "missing-reviewer-promotion", {
  promotionReport: makePromotionReport({
    status: "passed",
    promotion: {
      categories: ["global-validation"],
      changed_files: ["templates/codex/AGENTS.md"],
      candidate_files: [],
      validation_policy: "full validation"
    },
    reviewer: {
      required: true,
      used: false,
      agent_type: "autonomous_reviewer",
      result: "",
      findings: "missing reviewer"
    }
  })
});
const missingReviewerPromotionBlock = JSON.parse(runPython(stopHook, { cwd: missingReviewerPromotion.root, stop_hook_active: false }));
assert.equal(missingReviewerPromotionBlock.decision, "block");
assert.ok(missingReviewerPromotionBlock.reason.includes("require reviewer result"));

const highRiskLearning = createRunningActiveRun("codex-high-risk-learning-", "high-risk-learning", {
  candidate: makeLearningCandidate({
    run_id: "high-risk-learning",
    category: "global-safety",
    risk: "high",
    scope: "codex-global",
    promotion_decision: "auto-apply",
    status: "applied"
  })
});
const highRiskLearningBlock = JSON.parse(runPython(stopHook, { cwd: highRiskLearning.root, stop_hook_active: false }));
assert.equal(highRiskLearningBlock.decision, "block");
assert.ok(highRiskLearningBlock.reason.includes("must be shadowed"));

const malformedCandidate = createRunningActiveRun("codex-malformed-learning-", "malformed-learning", {
  candidate: makeLearningCandidate({
    run_id: "malformed-learning",
    target_files: "templates/codex/AGENTS.md"
  })
});
const malformedCandidateBlock = JSON.parse(runPython(stopHook, { cwd: malformedCandidate.root, stop_hook_active: false }));
assert.equal(malformedCandidateBlock.decision, "block");
assert.ok(malformedCandidateBlock.reason.includes("target_files"));

const longJsonl = createRunningActiveRun("codex-long-jsonl-", "long-jsonl", {
  progressEvent: {
    self_review: "x".repeat(5000)
  },
  candidate: makeLearningCandidate({
    run_id: "long-jsonl",
    evidence: "x".repeat(5000)
  })
});
const longJsonlBlock = JSON.parse(runPython(stopHook, { cwd: longJsonl.root, stop_hook_active: false }));
assert.equal(longJsonlBlock.decision, "block");
assert.ok(longJsonlBlock.reason.includes("Continue the next cycle"));

const installHome = mkdtempSync(join(tmpdir(), "codex-install-preview-"));
const installPreview = execFileSync("node", [
  join(repoRoot, "scripts/install.mjs"),
  "--dry-run",
  "--merge",
  `--codex-home=${installHome}`
], { encoding: "utf8" });
assert.ok(installPreview.includes("Codex App Autonomous Install Report"));
assert.ok(installPreview.includes("render hooks.json"));

const uninstallPreview = execFileSync("node", [
  join(repoRoot, "scripts/uninstall.mjs"),
  "--dry-run",
  `--codex-home=${installHome}`
], { encoding: "utf8" });
assert.ok(uninstallPreview.includes("Codex App Autonomous Uninstall Plan"));
assert.ok(uninstallPreview.includes("skip modified/user-owned hooks.json without manifest") === false);

const installHomeReal = mkdtempSync(join(tmpdir(), "codex-install-real-"));
writeFileSync(join(installHomeReal, "AGENTS.md"), "# User Rules\n\nKeep this line.\n");
execFileSync("node", [
  join(repoRoot, "scripts/install.mjs"),
  "--merge",
  `--codex-home=${installHomeReal}`
], { encoding: "utf8" });
const manifestPath = join(installHomeReal, "codex-app-autonomous-manifest.json");
assert.ok(existsSync(manifestPath));
const manifest = JSON.parse(read(manifestPath));
assert.equal(manifest.version, packageJson.version);
assert.ok(manifest.rendered_hooks_sha256);
assert.ok(manifest.files.some((file) => file.path === "hooks.json" && file.kind === "generated"));
assert.ok(manifest.files.some((file) => file.path === "AGENTS.md" && file.kind === "managed-block"));
writeFileSync(join(installHomeReal, "hooks.json"), "{\"userOwned\":true}\n", "utf8");
const uninstallReal = execFileSync("node", [
  join(repoRoot, "scripts/uninstall.mjs"),
  `--codex-home=${installHomeReal}`
], { encoding: "utf8" });
assert.ok(uninstallReal.includes("skip modified/user-owned"));
assert.equal(read(join(installHomeReal, "hooks.json")), "{\"userOwned\":true}\n");
const remainingAgents = read(join(installHomeReal, "AGENTS.md"));
assert.ok(remainingAgents.includes("Keep this line."));
assert.equal(remainingAgents.includes("codex-app-autonomous-runs:begin"), false);
assert.equal(existsSync(manifestPath), false);
assert.equal(existsSync(join(installHomeReal, "skills/timed-autonomous-run/SKILL.md")), false);
assert.equal(existsSync(join(installHomeReal, "skills/timed-autonomous-run")), false);

const installHomeMerge = mkdtempSync(join(tmpdir(), "codex-hooks-merge-"));
const customHooks = {
  hooks: {
    PreToolUse: [
      {
        matcher: "CustomTool",
        hooks: [{ type: "command", command: "echo custom-pre" }]
      }
    ],
    Stop: [
      {
        matcher: "CustomStop",
        hooks: [{ type: "command", command: "echo custom-stop" }]
      }
    ]
  }
};
writeFileSync(join(installHomeMerge, "hooks.json"), `${JSON.stringify(customHooks, null, 2)}\n`, "utf8");
execFileSync("node", [
  join(repoRoot, "scripts/install.mjs"),
  "--merge",
  `--codex-home=${installHomeMerge}`
], { encoding: "utf8" });
const mergedManifest = JSON.parse(read(join(installHomeMerge, "codex-app-autonomous-manifest.json")));
assert.ok(mergedManifest.files.some((file) => file.path === "hooks.json" && file.kind === "merged-json"));
const mergedHooks = JSON.parse(read(join(installHomeMerge, "hooks.json")));
assert.ok(JSON.stringify(mergedHooks).includes("echo custom-pre"));
assert.ok(JSON.stringify(mergedHooks).includes("pre_tool_use_policy.py"));
assert.ok(JSON.stringify(mergedHooks).includes("stop_continue_guard.py"));
execFileSync("node", [
  join(repoRoot, "scripts/uninstall.mjs"),
  `--codex-home=${installHomeMerge}`
], { encoding: "utf8" });
const preservedHooks = JSON.parse(read(join(installHomeMerge, "hooks.json")));
const preservedText = JSON.stringify(preservedHooks);
assert.ok(preservedText.includes("echo custom-pre"));
assert.ok(preservedText.includes("echo custom-stop"));
assert.equal(preservedText.includes("pre_tool_use_policy.py"), false);
assert.equal(preservedText.includes("stop_continue_guard.py"), false);

const installHomeDryRun = mkdtempSync(join(tmpdir(), "codex-uninstall-dry-run-"));
execFileSync("node", [
  join(repoRoot, "scripts/install.mjs"),
  "--merge",
  `--codex-home=${installHomeDryRun}`
], { encoding: "utf8" });
const dryRunUninstallOutput = execFileSync("node", [
  join(repoRoot, "scripts/uninstall.mjs"),
  "--dry-run",
  `--codex-home=${installHomeDryRun}`
], { encoding: "utf8" });
assert.equal(dryRunUninstallOutput.includes("remove empty directory"), false);
assert.ok(existsSync(join(installHomeDryRun, "skills/timed-autonomous-run/SKILL.md")));
assert.ok(existsSync(join(installHomeDryRun, "skills/timed-autonomous-run")));
assert.ok(existsSync(join(installHomeDryRun, "codex-app-autonomous-manifest.json")));

const packCommand = process.platform === "win32" ? "npm.cmd pack --dry-run --json" : "npm pack --dry-run --json";
const packOutput = JSON.parse(execSync(packCommand, {
  cwd: repoRoot,
  encoding: "utf8"
}))[0];
const packedFiles = packOutput.files.map((file) => file.path);
assert.ok(packedFiles.includes("templates/codex/skills/timed-autonomous-run/SKILL.md"));
assert.ok(packedFiles.includes("templates/codex/skills/timed-autonomous-run/schemas/improvement-candidate.schema.json"));
assert.ok(packedFiles.includes("templates/codex/skills/timed-autonomous-run/schemas/learning-summary.schema.json"));
assert.ok(packedFiles.includes("templates/codex/skills/timed-autonomous-run/schemas/promotion-report.schema.json"));
assert.ok(packedFiles.includes("templates/codex/skills/timed-autonomous-run/schemas/run-retrospective.schema.json"));
assert.ok(packedFiles.includes("scripts/promote-learning.mjs"));
assert.ok(packedFiles.includes("scripts/summarize-learning.mjs"));
assert.ok(packedFiles.includes("scripts/github-release.mjs"));
assert.ok(packedFiles.includes("tests/validate-long-run-simulation.js"));
assert.ok(packedFiles.includes("tests/validate-rules.js"));
assert.ok(packedFiles.includes("examples/long-run-simulation/README.md"));
assert.ok(packedFiles.includes(".github/workflows/validate.yml"));
assert.equal(packedFiles.some((file) => file.includes(".codex/app-active-runs")), false);
assert.equal(packedFiles.some((file) => file.includes("__pycache__") || file.endsWith(".pyc")), false);

const exampleOutput = execFileSync("node", [join(repoRoot, "examples/medium-project/tests/validate.js")], {
  encoding: "utf8"
});
assert.ok(exampleOutput.includes("medium example validation passed"));

const longRunOutput = execFileSync("node", [join(repoRoot, "tests/validate-long-run-simulation.js")], {
  encoding: "utf8"
});
assert.ok(longRunOutput.includes("long-run simulation validation passed"));

const summaryPreview = execFileSync("node", [
  join(repoRoot, "scripts/summarize-learning.mjs"),
  "--dry-run",
  `--codex-home=${installHome}`,
  `--root=${join(repoRoot, "examples/long-run-simulation")}`
], { encoding: "utf8" });
const summaryJson = JSON.parse(summaryPreview);
assert.ok(summaryJson.totals.candidates >= 3);
assert.ok(summaryJson.recommended_promotions.length >= 1);

const promotionDryRunDir = join(mkdtempSync(join(tmpdir(), "codex-promotion-dry-run-")), "report");
const promotionDryRun = execFileSync("node", [
  join(repoRoot, "scripts/promote-learning.mjs"),
  "--dry-run",
  "--allow-no-changes",
  "--allow-branch",
  `--report-dir=${promotionDryRunDir}`,
  "--reviewer-result=open-source-test-reviewer"
], { encoding: "utf8" });
assert.ok(promotionDryRun.includes("Promotion report JSON"));
assert.equal(existsSync(promotionDryRunDir), false, "promotion dry-run must not write report files");

const githubReleaseDryRun = execFileSync("node", [
  join(repoRoot, "scripts/github-release.mjs"),
  "--dry-run",
  "--repo=wxmb01/codex-app-autonomous-runs",
  "--tag=v0.0.0-test",
  "--target=0000000000000000000000000000000000000000",
  "--title=v0.0.0-test",
  "--notes=release dry run"
], { encoding: "utf8" });
assert.ok(githubReleaseDryRun.includes("create-or-update-github-release"));

const hookBenchOutput = execFileSync("node", [
  join(repoRoot, "scripts/bench-hooks.mjs"),
  "--iterations=2",
  "--max-avg-ms=300"
], { encoding: "utf8" });
assert.ok(hookBenchOutput.includes("Hook benchmark passed"));

console.log("open-source validation passed");
