#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, copyFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const templateRoot = join(repoRoot, "templates", "codex");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || args.has("--what-if");
const force = args.has("--force");
const merge = args.has("--merge");
const codexHomeArg = process.argv.find((arg) => arg.startsWith("--codex-home="));
const codexHome = codexHomeArg ? codexHomeArg.slice("--codex-home=".length) : join(homedir(), ".codex");
const backupRoot = join(codexHome, `backup-codex-app-autonomous-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const report = [`target: ${codexHome}`];

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function ensureParent(path) {
  if (!dryRun) mkdirSync(dirname(path), { recursive: true });
}

function backup(path) {
  if (!existsSync(path)) return;
  const dest = join(backupRoot, relative(codexHome, path));
  report.push(`backup: ${path} -> ${dest}`);
  if (!dryRun) {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(path, dest);
  }
}

function copyFile(source, dest) {
  if (existsSync(dest) && !force) backup(dest);
  report.push(`copy: ${source} -> ${dest}`);
  ensureParent(dest);
  if (!dryRun) copyFileSync(source, dest);
}

function copyTree(sourceDir, destDir) {
  for (const file of walk(sourceDir)) {
    copyFile(file, join(destDir, relative(sourceDir, file)));
  }
}

function renderHooks() {
  const template = readFileSync(join(templateRoot, "hooks.json.template"), "utf8");
  const escaped = codexHome.replaceAll("\\", "\\\\");
  const output = template.replaceAll("{{CODEX_HOME_WINDOWS_ESCAPED}}", escaped);
  const dest = join(codexHome, "hooks.json");
  if (existsSync(dest) && !force) backup(dest);
  report.push(`render hooks.json: ${dest}`);
  ensureParent(dest);
  if (!dryRun) writeFileSync(dest, output, "utf8");
}

function installAgentsMd() {
  const source = join(templateRoot, "AGENTS.md");
  const dest = join(codexHome, "AGENTS.md");
  if (!merge) {
    copyFile(source, dest);
    return;
  }
  const begin = "<!-- codex-app-autonomous-runs:begin -->";
  const end = "<!-- codex-app-autonomous-runs:end -->";
  const block = `${begin}\n${readFileSync(source, "utf8")}\n${end}\n`;
  let next = block;
  if (existsSync(dest)) {
    backup(dest);
    const current = readFileSync(dest, "utf8");
    if (current.includes(begin) && current.includes(end)) {
      next = current.replace(new RegExp(`${begin}[\\s\\S]*?${end}`), block.trimEnd());
      report.push(`replace managed AGENTS.md block: ${dest}`);
    } else {
      next = `${current.trimEnd()}\n\n${block}`;
      report.push(`append managed AGENTS.md block: ${dest}`);
    }
  } else {
    report.push(`write merged AGENTS.md: ${dest}`);
  }
  ensureParent(dest);
  if (!dryRun) writeFileSync(dest, next, "utf8");
}

if (!existsSync(templateRoot)) {
  throw new Error(`Template root not found: ${templateRoot}`);
}

for (const dir of ["agents", "hooks", "rules", "skills"]) {
  copyTree(join(templateRoot, dir), join(codexHome, dir));
}
installAgentsMd();
renderHooks();

const reportText = `# Codex App Autonomous Install Report\n\n${report.map((line) => `- ${line}`).join("\n")}\n`;
if (dryRun) {
  console.log(reportText);
} else {
  mkdirSync(codexHome, { recursive: true });
  const reportPath = join(codexHome, "codex-app-autonomous-install-report.md");
  writeFileSync(reportPath, reportText, "utf8");
  console.log(`Installed Codex App autonomous run templates to: ${codexHome}`);
  console.log(`Install report: ${reportPath}`);
  console.log("Open Codex App settings and trust the installed hooks.");
}
