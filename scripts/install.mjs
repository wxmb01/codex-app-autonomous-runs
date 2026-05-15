#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, copyFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const templateRoot = join(repoRoot, "templates", "codex");
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || args.has("--what-if");
const force = args.has("--force");
const merge = args.has("--merge");
const codexHomeArg = process.argv.find((arg) => arg.startsWith("--codex-home="));
const codexHome = codexHomeArg ? codexHomeArg.slice("--codex-home=".length) : join(homedir(), ".codex");
const backupRoot = join(codexHome, `backup-codex-app-autonomous-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const manifestPath = join(codexHome, "codex-app-autonomous-manifest.json");
const report = [`target: ${codexHome}`];
const manifestFiles = [];

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

function relativeToCodexHome(path) {
  return relative(codexHome, path).replaceAll("\\", "/");
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Text(value) {
  return sha256Buffer(Buffer.from(value, "utf8"));
}

function sha256File(path) {
  return sha256Buffer(readFileSync(path));
}

function remember(dest, sha256, kind = "file") {
  manifestFiles.push({
    path: relativeToCodexHome(dest),
    kind,
    sha256
  });
}

function copyFile(source, dest) {
  if (existsSync(dest) && !force) backup(dest);
  report.push(`copy: ${source} -> ${dest}`);
  ensureParent(dest);
  const hash = sha256File(source);
  remember(dest, hash);
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
  remember(dest, sha256Text(output), "generated");
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
  remember(dest, sha256Text(next), "managed-block");
  if (!dryRun) writeFileSync(dest, next, "utf8");
}

function buildManifest(reportPath, reportText) {
  const hooks = manifestFiles.find((file) => file.path === "hooks.json");
  return {
    name: "codex-app-autonomous-runs",
    version: packageJson.version,
    installed_at: new Date().toISOString(),
    codex_home: codexHome,
    rendered_hooks_sha256: hooks?.sha256 ?? null,
    files: [
      ...manifestFiles,
      {
        path: relativeToCodexHome(reportPath),
        kind: "generated",
        sha256: sha256Text(reportText)
      }
    ]
  };
}

if (!existsSync(templateRoot)) {
  throw new Error(`Template root not found: ${templateRoot}`);
}

for (const dir of ["agents", "hooks", "rules", "skills"]) {
  copyTree(join(templateRoot, dir), join(codexHome, dir));
}
installAgentsMd();
renderHooks();

report.push(`write manifest: ${manifestPath}`);
const reportText = `# Codex App Autonomous Install Report\n\n${report.map((line) => `- ${line}`).join("\n")}\n`;
const reportPath = join(codexHome, "codex-app-autonomous-install-report.md");
const manifest = buildManifest(reportPath, reportText);

if (dryRun) {
  console.log(reportText);
  console.log(`Manifest preview: ${manifest.files.length} managed file entries`);
} else {
  mkdirSync(codexHome, { recursive: true });
  writeFileSync(reportPath, reportText, "utf8");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Installed Codex App autonomous run templates to: ${codexHome}`);
  console.log(`Install report: ${reportPath}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log("Open Codex App settings and trust the installed hooks.");
}
