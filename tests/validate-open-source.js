import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  "docs/assets/promo-zh.png",
  "docs/demo.md",
  "docs/faq.md",
  "docs/permissions.md",
  "docs/installation.md",
  "docs/open-source-readiness.md",
  "scripts/Install-CodexAppAutonomous.ps1",
  "scripts/Uninstall-CodexAppAutonomous.ps1",
  "scripts/install.mjs",
  "scripts/uninstall.mjs",
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
  "templates/codex/skills/timed-autonomous-run/schemas/run-state.schema.json"
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
JSON.parse(hooksTemplate.replaceAll("{{CODEX_HOME_WINDOWS_ESCAPED}}", "C:\\\\Users\\\\example\\\\.codex"));

const packageJson = JSON.parse(read(join(repoRoot, "package.json")));
assert.equal(packageJson.private, false);
assert.ok(packageJson.scripts["install:dry-run"]);
assert.ok(packageJson.scripts["uninstall:dry-run"]);
assert.ok(packageJson.scripts["test:example"]);

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
  "run-state.schema.json"
]) {
  const data = JSON.parse(read(join(templateRoot, "skills/timed-autonomous-run/schemas", schema)));
  assert.ok(Array.isArray(data.required));
  assert.ok(data.required.length > 5);
}

const rules = read(join(templateRoot, "rules/autonomous-safety.rules"));
assert.ok(rules.includes('pattern=["npm", "publish"]'));
assert.ok(rules.includes('pattern=["terraform", "apply"]'));
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

const stopHook = join(templateRoot, "hooks/stop_continue_guard.py");
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

const exampleOutput = execFileSync("node", [join(repoRoot, "examples/medium-project/tests/validate.js")], {
  encoding: "utf8"
});
assert.ok(exampleOutput.includes("medium example validation passed"));

console.log("open-source validation passed");
