#!/usr/bin/env node
import { existsSync, rmSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || args.has("--what-if");
const codexHomeArg = process.argv.find((arg) => arg.startsWith("--codex-home="));
const codexHome = codexHomeArg ? codexHomeArg.slice("--codex-home=".length) : join(homedir(), ".codex");

const targets = [
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
  "hooks.json",
  "codex-app-autonomous-install-report.md"
];

console.log(`# Codex App Autonomous Uninstall Plan\n`);
for (const target of targets) {
  const full = join(codexHome, target);
  if (existsSync(full)) {
    console.log(`- remove: ${full}`);
    if (!dryRun) rmSync(full, { recursive: true, force: true });
  }
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
