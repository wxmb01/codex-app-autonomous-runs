#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const iterationsArg = process.argv.find((arg) => arg.startsWith("--iterations="));
const maxAvgArg = process.argv.find((arg) => arg.startsWith("--max-avg-ms="));
const json = process.argv.includes("--json");
const iterations = iterationsArg ? Number(iterationsArg.slice("--iterations=".length)) : 30;
const maxAvgMs = maxAvgArg ? Number(maxAvgArg.slice("--max-avg-ms=".length)) : 200;

if (!Number.isInteger(iterations) || iterations < 1) {
  throw new Error("--iterations must be a positive integer");
}

function runHook(path, event) {
  return execFileSync("python", [path], {
    input: JSON.stringify(event),
    encoding: "utf8"
  }).trim();
}

function bench(name, path, event) {
  const started = process.hrtime.bigint();
  for (let index = 0; index < iterations; index += 1) {
    runHook(path, event);
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  return {
    name,
    iterations,
    total_ms: Number(elapsedMs.toFixed(1)),
    avg_ms: Number((elapsedMs / iterations).toFixed(1))
  };
}

const preToolHook = join(repoRoot, "templates/codex/hooks/pre_tool_use_policy.py");
const stopHook = join(repoRoot, "templates/codex/hooks/stop_continue_guard.py");

for (const path of [preToolHook, stopHook]) {
  if (!existsSync(path)) throw new Error(`missing hook: ${path}`);
}

const root = mkdtempSync(join(tmpdir(), "codex-hook-bench-"));
const activeRoot = join(root, ".codex/app-active-runs");
const runName = "bench-run";
const runDir = join(activeRoot, runName);
mkdirSync(runDir, { recursive: true });
writeFileSync(join(activeRoot, "current"), runName, "utf8");
writeFileSync(join(runDir, "run-state.json"), JSON.stringify({
  run_id: runName,
  target: root,
  goal: "benchmark stop hook",
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
}), "utf8");
writeFileSync(join(runDir, "progress.md"), "# Benchmark\n", "utf8");
writeFileSync(join(runDir, "progress.jsonl"), JSON.stringify({
  timestamp: "2026-01-01T00:00:00Z",
  cycle: 1,
  phase: "implementation",
  elapsed_minutes: 1,
  task: "benchmark",
  files_changed: [],
  commands: [],
  validation: "none",
  self_review: "none",
  reviewer: "none",
  blocker: "none",
  next_step: "continue"
}) + "\n", "utf8");
writeFileSync(join(runDir, "lessons-learned.md"), "# Benchmark\n\n- Learning artifacts exist.\n", "utf8");
writeFileSync(join(runDir, "improvement-candidates.jsonl"), "", "utf8");
writeFileSync(join(runDir, "promotion-report.md"), "# Promotion Report\n\n- benchmark fixture\n", "utf8");
writeFileSync(join(runDir, "promotion-report.json"), JSON.stringify({
  generated_at: "2026-01-01T00:00:00Z",
  repository: "benchmark",
  version: "0.0.0",
  status: "pending",
  promotion: {
    categories: ["documentation"],
    changed_files: [],
    candidate_files: [],
    validation_policy: "benchmark fixture"
  },
  validation: [],
  install_result: {
    status: "skipped",
    codex_home: "benchmark",
    manifest_version: "0.0.0"
  },
  git: {
    branch: "benchmark",
    commit_sha: "benchmark",
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
    findings: "not required for benchmark fixture"
  },
  steps: []
}) + "\n", "utf8");

const results = [
  bench("pre_tool_use_write_guard", preToolHook, {
    tool_name: "apply_patch",
    tool_input: {
      patch: "*** Begin Patch\n*** Update File: README.md\n@@\n unchanged\n*** End Patch\n"
    }
  }),
  bench("stop_continue_guard_current", stopHook, {
    cwd: root,
    stop_hook_active: false
  })
];

for (const result of results) {
  if (result.avg_ms > maxAvgMs) {
    throw new Error(`${result.name} average ${result.avg_ms}ms exceeds ${maxAvgMs}ms`);
  }
}

if (json) {
  console.log(JSON.stringify({ max_avg_ms: maxAvgMs, results }, null, 2));
} else {
  console.log(`Hook benchmark passed (max avg ${maxAvgMs}ms)`);
  for (const result of results) {
    console.log(`- ${result.name}: ${result.avg_ms}ms avg over ${result.iterations} runs`);
  }
}
