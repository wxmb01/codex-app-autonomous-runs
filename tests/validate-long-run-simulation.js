import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtureRoot = join(repoRoot, "examples", "long-run-simulation");
const runRoot = join(fixtureRoot, "codex-app-active-runs");
const runName = readFileSync(join(runRoot, "current"), "utf8").trim();
const runDir = join(runRoot, runName);
const schemaRoot = join(repoRoot, "templates", "codex", "skills", "timed-autonomous-run", "schemas");

function readJson(path) {
  assert.ok(existsSync(path), `missing ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function readJsonl(path) {
  assert.ok(existsSync(path), `missing ${path}`);
  return readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function validateRequired(name, object, schemaName) {
  const schema = readJson(join(schemaRoot, schemaName));
  for (const field of schema.required) {
    assert.ok(object[field] !== undefined && object[field] !== null, `${name} missing ${field}`);
  }
  return schema;
}

function validateJsonSchema(name, object, schema) {
  function fail(path, message) {
    throw new assert.AssertionError({
      message: `${name} ${path}: ${message}`
    });
  }

  function matchesType(value, expected) {
    const values = Array.isArray(expected) ? expected : [expected];
    return values.some((type) => {
      if (type === "array") return Array.isArray(value);
      if (type === "null") return value === null;
      if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
      return typeof value === type;
    });
  }

  function check(value, spec, path) {
    if (spec.type && !matchesType(value, spec.type)) {
      fail(path, `expected type ${JSON.stringify(spec.type)}`);
    }
    if (spec.enum && !spec.enum.includes(value)) {
      fail(path, `expected one of ${spec.enum.join(", ")}`);
    }
    if (typeof value === "string" && spec.minLength && value.length < spec.minLength) {
      fail(path, `expected minLength ${spec.minLength}`);
    }
    if (Array.isArray(value)) {
      if (spec.minItems && value.length < spec.minItems) fail(path, `expected minItems ${spec.minItems}`);
      if (spec.items) value.forEach((item, index) => check(item, spec.items, `${path}[${index}]`));
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const field of spec.required ?? []) {
        if (value[field] === undefined || value[field] === null) fail(`${path}.${field}`, "missing required field");
      }
      if (spec.additionalProperties === false) {
        const allowed = new Set(Object.keys(spec.properties ?? {}));
        for (const field of Object.keys(value)) {
          if (!allowed.has(field)) fail(`${path}.${field}`, "unexpected property");
        }
      }
      for (const [field, childSpec] of Object.entries(spec.properties ?? {})) {
        if (value[field] !== undefined && value[field] !== null) check(value[field], childSpec, `${path}.${field}`);
      }
    }
  }

  check(object, schema, "$");
}

const requiredFiles = [
  "README.md",
  "package.json",
  "src/workflow.js",
  "tests/validate.js",
  "codex-app-active-runs/current",
  "codex-app-active-runs/medium-dashboard-hardening/run-state.json",
  "codex-app-active-runs/medium-dashboard-hardening/progress.md",
  "codex-app-active-runs/medium-dashboard-hardening/progress.jsonl",
  "codex-app-active-runs/medium-dashboard-hardening/lessons-learned.md",
  "codex-app-active-runs/medium-dashboard-hardening/improvement-candidates.jsonl",
  "codex-app-active-runs/medium-dashboard-hardening/promotion-report.json",
  "codex-app-active-runs/medium-dashboard-hardening/promotion-report.md",
  "codex-app-active-runs/medium-dashboard-hardening/run-retrospective.json"
];

for (const file of requiredFiles) {
  assert.ok(existsSync(join(fixtureRoot, file)), `fixture file missing: ${file}`);
}

const state = readJson(join(runDir, "run-state.json"));
validateRequired("run-state", state, "run-state.schema.json");
assert.equal(state.status, "completed");
assert.equal(state.project_size, "medium");
assert.equal(state.completed_cycles, 6);

const events = readJsonl(join(runDir, "progress.jsonl"));
assert.ok(events.length >= 6);
for (const [index, event] of events.entries()) {
  validateRequired(`progress event ${index + 1}`, event, "progress-event.schema.json");
}
const first = Date.parse(events[0].timestamp);
const last = Date.parse(events.at(-1).timestamp);
assert.ok((last - first) / 60000 >= 30, "simulation must represent at least 30 minutes");
assert.ok(events.some((event) => event.reviewer.includes("project_completeness_reviewer")));
assert.ok(events.some((event) => event.reviewer.includes("autonomous_reviewer")));

const candidates = readJsonl(join(runDir, "improvement-candidates.jsonl"));
assert.ok(candidates.length >= 3);
for (const [index, candidate] of candidates.entries()) {
  validateRequired(`candidate ${index + 1}`, candidate, "improvement-candidate.schema.json");
}
assert.ok(candidates.some((candidate) => candidate.category === "global-validation" && candidate.status === "applied"));
assert.ok(candidates.some((candidate) => candidate.category === "performance" && candidate.status === "applied"));
assert.ok(candidates.some((candidate) => candidate.category === "global-safety" && candidate.status === "shadowed"));

const promotion = readJson(join(runDir, "promotion-report.json"));
const promotionSchema = validateRequired("promotion report", promotion, "promotion-report.schema.json");
validateJsonSchema("promotion report", promotion, promotionSchema);
assert.ok(promotionSchema.reviewer_required_for_categories.includes("global-validation"));
assert.ok(promotionSchema.reviewer_required_for_categories.includes("performance"));
assert.equal(promotion.install_result.status, "passed");
assert.match(promotion.git.commit_sha, /^[0-9a-f]{40}$/);
assert.equal(promotion.github.push_result.status, "passed");
assert.ok(promotion.github.release.release_url.includes("/releases/tag/v0.1.8"));
assert.equal(promotion.reviewer.required, true);
assert.equal(promotion.reviewer.used, true);
assert.ok(promotion.reviewer.result.length > 20);
for (const category of promotion.promotion.categories) {
  if (promotionSchema.reviewer_required_for_categories.includes(category)) {
    assert.equal(promotion.reviewer.used, true, `${category} promotion must bind reviewer`);
  }
}
assert.throws(() => {
  const invalid = structuredClone(promotion);
  delete invalid.github.release.release_url;
  validateJsonSchema("invalid promotion report", invalid, promotionSchema);
  if (["success", "passed", "created", "updated"].includes(invalid.github.release.status)) {
    assert.ok(invalid.github.release.release_url || invalid.github.release.url, "release URL required");
  }
}, /release URL|required|missing/);
assert.throws(() => {
  const invalid = structuredClone(promotion);
  delete invalid.git.tag;
  validateJsonSchema("invalid promotion report", invalid, promotionSchema);
}, /git\.tag.*missing/);
assert.throws(() => {
  const invalid = structuredClone(promotion);
  invalid.extra = true;
  validateJsonSchema("invalid promotion report", invalid, promotionSchema);
}, /unexpected property/);
assert.throws(() => {
  const invalid = structuredClone(promotion);
  invalid.steps = [{ name: "step without command", status: "passed" }];
  validateJsonSchema("invalid promotion report", invalid, promotionSchema);
}, /steps\[0\]\.command.*missing/);
assert.throws(() => {
  const invalid = structuredClone(promotion);
  invalid.validation = [{ name: "validation without status", command: "npm test" }];
  validateJsonSchema("invalid promotion report", invalid, promotionSchema);
}, /validation\[0\]\.status.*missing/);

const reportMd = readFileSync(join(runDir, "promotion-report.md"), "utf8");
assert.ok(reportMd.includes("Machine report: `promotion-report.json`"));
assert.ok(reportMd.includes("https://github.com/wxmb01/codex-app-autonomous-runs/releases/tag/v0.1.8"));

const retrospective = readJson(join(runDir, "run-retrospective.json"));
validateRequired("retrospective", retrospective, "run-retrospective.schema.json");
assert.equal(retrospective.outcome, "completed");

const realPathRoot = join(tmpdir(), `codex-real-active-run-${Date.now()}`);
const realActiveRoot = join(realPathRoot, ".codex", "app-active-runs");
const realRunDir = join(realActiveRoot, runName);
mkdirSync(realRunDir, { recursive: true });
writeFileSync(join(realActiveRoot, "current"), runName, "utf8");
for (const file of [
  "run-state.json",
  "progress.md",
  "progress.jsonl",
  "lessons-learned.md",
  "improvement-candidates.jsonl",
  "promotion-report.json",
  "promotion-report.md"
]) {
  writeFileSync(join(realRunDir, file), readFileSync(join(runDir, file)));
}
writeFileSync(join(realRunDir, "run-state.json"), JSON.stringify({
  ...state,
  target: realPathRoot,
  status: "running",
  stop_guard: true,
  deadline: "2099-01-01T00:00:00Z",
  stop_reason: ""
}, null, 2));
const realStopHook = execFileSync("python", [join(repoRoot, "templates", "codex", "hooks", "stop_continue_guard.py")], {
  input: JSON.stringify({ cwd: realPathRoot, stop_hook_active: false }),
  encoding: "utf8"
}).trim();
const realStopDecision = JSON.parse(realStopHook);
assert.equal(realStopDecision.decision, "block");
assert.ok(realStopDecision.reason.includes("Continue the next cycle"));

const projectOutput = execFileSync("node", [join(fixtureRoot, "tests", "validate.js")], {
  encoding: "utf8"
});
assert.ok(projectOutput.includes("long-run simulation project validation passed"));

console.log("long-run simulation validation passed");
