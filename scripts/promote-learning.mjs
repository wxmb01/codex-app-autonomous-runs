#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const schemaPath = join(
  repoRoot,
  "templates",
  "codex",
  "skills",
  "timed-autonomous-run",
  "schemas",
  "promotion-report.schema.json"
);
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

function parseArgs(argv) {
  const args = { "promotion-category": [], "candidate-file": [] };
  for (const item of argv) {
    if (!item.startsWith("--")) continue;
    const eq = item.indexOf("=");
    const key = eq === -1 ? item.slice(2) : item.slice(2, eq);
    const value = eq === -1 ? true : item.slice(eq + 1);
    if (key === "promotion-category") args[key].push(value);
    else if (key === "candidate-file") args[key].push(value);
    else args[key] = value;
  }
  return args;
}

function bin(name) {
  return name;
}

function quoteCmdArg(arg) {
  if (/^[A-Za-z0-9_./:=\\-]+$/.test(arg)) return arg;
  return `"${arg.replaceAll('"', '\\"')}"`;
}

function run(command, args, options = {}) {
  const printable = [command, ...args].join(" ");
  let actualCommand = command;
  let actualArgs = args;
  if (process.platform === "win32" && command === "npm") {
    actualCommand = process.env.ComSpec || "cmd.exe";
    actualArgs = ["/d", "/s", "/c", ["npm", ...args].map(quoteCmdArg).join(" ")];
  }
  if (options.dryRun) {
    return { command: printable, status: "dry-run", stdout: "" };
  }
  try {
    const stdout = execFileSync(actualCommand, actualArgs, {
      cwd: options.cwd ?? repoRoot,
      encoding: "utf8",
      stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"]
    });
    return { command: printable, status: "passed", stdout: typeof stdout === "string" ? stdout.trim() : "" };
  } catch (error) {
    return {
      command: printable,
      status: "failed",
      stdout: String(error.stdout ?? "").trim(),
      stderr: String(error.stderr ?? error.message).trim()
    };
  }
}

function mustRun(name, command, args, steps, options = {}) {
  console.log(`> ${name}: ${[command, ...args].join(" ")}`);
  const result = run(command, args, options);
  steps.push({ name, ...result });
  if (result.status === "failed") {
    throw new Error(`${name} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}

function git(args, options = {}) {
  const result = run("git", args, options);
  if (result.status === "failed") throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

function changedFiles() {
  const output = execFileSync("git", ["status", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).replace(/\r?\n$/, "");
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).trim().replaceAll("\\", "/"))
    .map((file) => file.includes(" -> ") ? file.split(" -> ").pop() : file);
}

function readCandidateCategories(files) {
  const categories = [];
  for (const file of files) {
    const path = resolve(repoRoot, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line);
        if (item.category) categories.push(item.category);
      } catch {
        // Candidate files can be partial during a run; promotion validation reports the exact file separately.
      }
    }
  }
  return categories;
}

function inferCategories(files, explicitCategories) {
  const categories = new Set(explicitCategories);
  for (const file of files) {
    if (file === "templates/codex/AGENTS.md" || file.endsWith("/SKILL.md")) categories.add("global-prompt");
    if (file.includes("/schemas/") || file.startsWith("tests/") || file.startsWith("examples/")) {
      categories.add("global-validation");
    }
    if (file.includes("bench-hooks") || file.includes("stop_continue_guard.py") || file.includes("pre_tool_use_policy.py")) {
      categories.add("performance");
    }
    if (file === "README.md" || file.startsWith("docs/") || file === "CHANGELOG.md") categories.add("documentation");
    if (file === "package.json" || file.startsWith("scripts/github-release") || file.startsWith("scripts/promote-learning")) {
      categories.add("release");
    }
  }
  return [...categories].sort();
}

function reportNotesFromChangelog() {
  const text = readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8");
  return text.match(/^##\s+[^\n]+\n([\s\S]*?)(?=\n##\s+|\s*$)/m)?.[1]?.trim() ?? "";
}

function validateAgainstSchema(value, schema, path = "$") {
  function fail(message) {
    throw new Error(`promotion report schema violation at ${path}: ${message}`);
  }
  function matchesType(item, expected) {
    const expectedTypes = Array.isArray(expected) ? expected : [expected];
    return expectedTypes.some((type) => {
      if (type === "array") return Array.isArray(item);
      if (type === "null") return item === null;
      if (type === "object") return item !== null && typeof item === "object" && !Array.isArray(item);
      return typeof item === type;
    });
  }
  if (schema.type && !matchesType(value, schema.type)) {
    fail(`expected type ${JSON.stringify(schema.type)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    fail(`expected one of ${schema.enum.join(", ")}`);
  }
  if (typeof value === "string" && schema.minLength && value.length < schema.minLength) {
    fail(`expected minLength ${schema.minLength}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) {
      fail(`expected at least ${schema.minItems} items`);
    }
    if (schema.items) {
      value.forEach((item, index) => validateAgainstSchema(item, schema.items, `${path}[${index}]`));
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const field of schema.required ?? []) {
      if (value[field] === undefined || value[field] === null) {
        throw new Error(`promotion report schema violation at ${path}.${field}: missing required field`);
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const field of Object.keys(value)) {
        if (!allowed.has(field)) {
          throw new Error(`promotion report schema violation at ${path}.${field}: unexpected property`);
        }
      }
    }
    for (const [field, childSchema] of Object.entries(schema.properties ?? {})) {
      if (value[field] !== undefined && value[field] !== null) {
        validateAgainstSchema(value[field], childSchema, `${path}.${field}`);
      }
    }
  }
}

function validateReport(report) {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  validateAgainstSchema(report, schema);
  const categories = report.promotion.categories ?? [];
  const requiresReviewer = categories.some((category) => ["global-prompt", "global-validation", "performance"].includes(category));
  if (requiresReviewer && (!report.reviewer.used || !report.reviewer.result)) {
    throw new Error("global-prompt/global-validation/performance promotion requires reviewer.used=true and reviewer.result");
  }
  if (["success", "passed", "created", "updated"].includes(report.github.release.status)) {
    if (!(report.github.release.release_url || report.github.release.url)) {
      throw new Error("promotion report missing github.release.release_url for successful release");
    }
  }
}

function writeReport(reportDir, report, options = {}) {
  validateReport(report);
  const jsonPath = join(reportDir, "promotion-report.json");
  const mdPath = join(reportDir, "promotion-report.md");
  const lines = [
    "# Promotion Report",
    "",
    `Generated: ${report.generated_at}`,
    `Version: ${report.version}`,
    `Status: ${report.status}`,
    `Commit: ${report.git.commit_sha}`,
    `Push: ${report.github.push_result.status}`,
    `Release: ${report.github.release?.release_url ?? report.github.release?.url ?? report.github.release?.status ?? "not-created"}`,
    `Reviewer: ${report.reviewer.used ? report.reviewer.result : "not-used"}`,
    "",
    "Machine report: `promotion-report.json`",
    ""
  ];
  if (!options.dryRun) {
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    writeFileSync(mdPath, lines.join("\n"), "utf8");
  }
  return { jsonPath, mdPath };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args["dry-run"] || args["what-if"]);
  const codexHome = args["codex-home"] ? resolve(args["codex-home"]) : join(homedir(), ".codex");
  const version = packageJson.version;
  const tag = args.tag === "none" ? null : (args.tag || `v${version}`);
  const reportDir = args["report-dir"]
    ? resolve(args["report-dir"])
    : dryRun
      ? join(repoRoot, ".codex", "promotions", "dry-run")
      : join(repoRoot, ".codex", "promotions", `${new Date().toISOString().replace(/[:.]/g, "-")}-${version}`);
  const steps = [];
  const beforeFiles = changedFiles();
  const categories = inferCategories(beforeFiles, [
    ...args["promotion-category"],
    ...readCandidateCategories(args["candidate-file"])
  ]);
  const reviewerResult = args["reviewer-result"] || "";
  const requiresReviewer = categories.some((category) => ["global-prompt", "global-validation", "performance"].includes(category));
  if (requiresReviewer && !reviewerResult) {
    throw new Error("This promotion touches global prompt, validation, or performance behavior. Pass --reviewer-result after a read-only reviewer audit.");
  }
  if (beforeFiles.length === 0 && !args["allow-no-changes"]) {
    throw new Error("No repository changes to promote. Pass --allow-no-changes only for report-only validation.");
  }

  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== "main" && !args["allow-branch"]) {
    throw new Error(`Refusing to promote from branch ${branch}. Use --allow-branch only for intentional non-main testing.`);
  }

  mustRun("fetch remote main", "git", ["fetch", "origin", "main"], steps, { dryRun });
  if (!dryRun) {
    const counts = git(["rev-list", "--left-right", "--count", "origin/main...HEAD"]).split(/\s+/).map(Number);
    if (counts[0] > 0) throw new Error("origin/main has commits not present locally; pull/rebase before promoting.");
  }

  mustRun("open-source validation", bin("npm"), ["test"], steps, { inherit: true, dryRun });
  mustRun("rules validation", bin("npm"), ["run", "test:rules"], steps, { inherit: true, dryRun });
  mustRun("example validation", bin("npm"), ["run", "test:example"], steps, { inherit: true, dryRun });
  mustRun("long-run simulation validation", bin("npm"), ["run", "test:long-run"], steps, { inherit: true, dryRun });
  mustRun("final fixture validation", bin("npm"), ["--prefix", "codex-app-final-fixture", "test"], steps, { inherit: true, dryRun });
  mustRun("hook benchmark", bin("npm"), ["run", "bench:hooks", "--", "--iterations=30", "--max-avg-ms=200"], steps, { inherit: true, dryRun });
  mustRun("package dry-run", bin("npm"), ["pack", "--dry-run", "--json"], steps, { dryRun });
  mustRun("install global templates", "node", ["scripts/install.mjs", "--merge", `--codex-home=${codexHome}`], steps, { dryRun });

  let manifest = { version: dryRun ? version : null };
  if (!dryRun) {
    const manifestPath = join(codexHome, "codex-app-autonomous-manifest.json");
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.version !== version) {
      throw new Error(`Installed manifest version ${manifest.version} does not match package ${version}`);
    }
  }

  let commitSha = dryRun ? "dry-run" : "";
  if (!args["skip-commit"]) {
    mustRun("stage promotion diff", "git", ["add", "-A"], steps, { dryRun });
    const commitMessage = args["commit-message"] || `Promote autonomous learning ${version}`;
    mustRun("commit promotion diff", "git", ["commit", "-m", commitMessage], steps, { dryRun });
    commitSha = dryRun ? "dry-run" : git(["rev-parse", "HEAD"]);
  } else {
    commitSha = dryRun ? "dry-run" : git(["rev-parse", "HEAD"]);
  }

  let pushResult = { status: "skipped", command: "git push origin main" };
  if (!args["skip-push"]) {
    pushResult = mustRun("push main", "git", ["push", "origin", "main"], steps, { dryRun });
  }

  let tagResult = { status: "skipped" };
  let release = { status: "skipped" };
  if (tag && !args["skip-release"]) {
    if (!dryRun) {
      try {
        const existingTagSha = git(["rev-list", "-n", "1", tag]);
        if (existingTagSha !== commitSha) {
          throw new Error(`Tag ${tag} already exists at ${existingTagSha}, not ${commitSha}`);
        }
        tagResult = { status: "already-exists", tag };
      } catch {
        tagResult = mustRun("create version tag", "git", ["tag", "-a", tag, "-m", tag], steps, { dryRun });
      }
    } else {
      tagResult = { status: "dry-run", tag };
    }
    mustRun("push version tag", "git", ["push", "origin", tag], steps, { dryRun });
    const notesPath = join(reportDir, "release-notes.md");
    if (!dryRun) {
      mkdirSync(reportDir, { recursive: true });
      writeFileSync(notesPath, `${reportNotesFromChangelog()}\n`, "utf8");
    }
    const releaseResult = mustRun("create or update GitHub release", "node", [
      "scripts/github-release.mjs",
      `--tag=${tag}`,
      `--target=${commitSha}`,
      `--title=${tag}`,
      `--notes-file=${notesPath}`
    ], steps, { dryRun });
    release = dryRun ? { status: "dry-run", tag } : JSON.parse(releaseResult.stdout);
  }

  const report = {
    generated_at: new Date().toISOString(),
    repository: git(["config", "--get", "remote.origin.url"]),
    version,
    status: dryRun ? "dry-run" : "passed",
    promotion: {
      categories,
      changed_files: beforeFiles,
      candidate_files: args["candidate-file"],
      validation_policy: "test suite, hook benchmark, package dry-run, global install, manifest check"
    },
    validation: steps.filter((step) => [
      "open-source validation",
      "rules validation",
      "example validation",
      "long-run simulation validation",
      "final fixture validation",
      "hook benchmark",
      "package dry-run"
    ].includes(step.name)),
    install_result: {
      status: dryRun ? "dry-run" : "passed",
      codex_home: codexHome,
      manifest_version: manifest.version
    },
    git: {
      branch,
      commit_sha: commitSha,
      tag
    },
    github: {
      push_result: pushResult,
      release
    },
    reviewer: {
      required: requiresReviewer,
      used: Boolean(reviewerResult),
      agent_type: args["reviewer-agent"] || "autonomous_reviewer",
      result: reviewerResult,
      findings: args["reviewer-findings"] || "see reviewer result"
    },
    steps
  };

  const paths = writeReport(reportDir, report, { dryRun });
  if (dryRun) {
    console.log("Dry-run promotion report preview:");
    console.log(JSON.stringify(report, null, 2));
  }
  console.log(`Promotion report JSON: ${paths.jsonPath}`);
  console.log(`Promotion report Markdown: ${paths.mdPath}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
