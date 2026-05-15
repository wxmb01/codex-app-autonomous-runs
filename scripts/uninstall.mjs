#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, rmSync, readdirSync, readFileSync, rmdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || args.has("--what-if");
const codexHomeArg = process.argv.find((arg) => arg.startsWith("--codex-home="));
const codexHome = codexHomeArg ? codexHomeArg.slice("--codex-home=".length) : join(homedir(), ".codex");
const codexHomeResolved = resolve(codexHome);
const manifestPath = join(codexHome, "codex-app-autonomous-manifest.json");
const begin = "<!-- codex-app-autonomous-runs:begin -->";
const end = "<!-- codex-app-autonomous-runs:end -->";

const fallbackTargets = [
  "agents/autonomous_reviewer.toml",
  "agents/project_completeness_reviewer.toml",
  "agents/security_reviewer.toml",
  "agents/test_coverage_reviewer.toml",
  "agents/architecture_reviewer.toml",
  "agents/ui_artifact_reviewer.toml",
  "hooks/pre_tool_use_policy.py",
  "hooks/stop_continue_guard.py",
  "rules/autonomous-safety.rules",
  "skills/timed-autonomous-run",
  "codex-app-autonomous-install-report.md"
];

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function targetPath(relativePath) {
  const full = resolve(codexHome, ...relativePath.split(/[\\/]+/).filter(Boolean));
  if (full !== codexHomeResolved && !full.startsWith(`${codexHomeResolved}\\`) && !full.startsWith(`${codexHomeResolved}/`)) {
    throw new Error(`Refusing to remove path outside Codex home: ${relativePath}`);
  }
  return full;
}

function removePath(full, reason = "remove") {
  console.log(`- ${reason}: ${full}`);
  if (!dryRun) rmSync(full, { recursive: true, force: true });
}

function removeManagedBlock(full) {
  if (!existsSync(full)) return;
  const current = readFileSync(full, "utf8");
  if (!current.includes(begin) || !current.includes(end)) {
    console.log(`- skip modified/user-owned AGENTS.md: ${full}`);
    return;
  }
  const next = current
    .replace(new RegExp(`\\n?${begin}[\\s\\S]*?${end}\\n?`, "g"), "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (next) {
    console.log(`- remove managed AGENTS.md block: ${full}`);
    if (!dryRun) writeFileSync(full, `${next}\n`, "utf8");
  } else {
    removePath(full, "remove empty AGENTS.md");
  }
}

function loadManifest() {
  if (!existsSync(manifestPath)) return null;
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

function uninstallFromManifest(manifest) {
  const files = [...manifest.files].sort((a, b) => b.path.length - a.path.length);
  for (const entry of files) {
    const full = targetPath(entry.path);
    if (!existsSync(full)) continue;
    if (entry.kind === "managed-block" && entry.path === "AGENTS.md") {
      removeManagedBlock(full);
      continue;
    }
    const currentHash = sha256File(full);
    if (currentHash !== entry.sha256) {
      console.log(`- skip modified/user-owned: ${full}`);
      continue;
    }
    removePath(full);
  }
  if (existsSync(manifestPath)) removePath(manifestPath, "remove manifest");
  cleanupEmptyDirs();
}

function uninstallFallback() {
  for (const target of fallbackTargets) {
    const full = targetPath(target);
    if (existsSync(full)) removePath(full);
  }
  removeManagedBlock(targetPath("AGENTS.md"));
  const hooksPath = targetPath("hooks.json");
  if (existsSync(hooksPath)) {
    console.log(`- skip modified/user-owned hooks.json without manifest: ${hooksPath}`);
  }
  cleanupEmptyDirs();
}

function cleanupEmptyDirs() {
  for (const dir of [
    "skills/timed-autonomous-run/schemas",
    "skills/timed-autonomous-run",
    "skills",
    "rules",
    "hooks",
    "agents"
  ]) {
    const full = targetPath(dir);
    if (!existsSync(full)) continue;
    try {
      console.log(`- remove empty directory: ${full}`);
      if (!dryRun) rmdirSync(full);
    } catch {
      // Directory contains user-owned files or is otherwise not removable.
    }
  }
}

console.log("# Codex App Autonomous Uninstall Plan\n");
const manifest = loadManifest();
if (manifest) {
  uninstallFromManifest(manifest);
} else {
  uninstallFallback();
}

if (existsSync(codexHome)) {
  const backups = readdirSync(codexHome).filter((name) => name.startsWith("backup-codex-app-autonomous-"));
  if (backups.length) {
    console.log("\nBackups remain available:");
    for (const backup of backups) console.log(`- ${join(codexHome, backup)}`);
  }
}

if (dryRun) {
  console.log("\nDry run only. No files were removed.");
}
