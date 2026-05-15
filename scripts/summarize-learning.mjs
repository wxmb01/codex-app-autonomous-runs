#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function parseArgs(argv) {
  const args = { root: [] };
  for (const item of argv) {
    if (!item.startsWith("--")) continue;
    const eq = item.indexOf("=");
    const key = eq === -1 ? item.slice(2) : item.slice(2, eq);
    const value = eq === -1 ? true : item.slice(eq + 1);
    if (key === "root") args.root.push(value);
    else args[key] = value;
  }
  return args;
}

function walk(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    if ([".git", "node_modules", "dist", "coverage"].includes(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function readJsonl(path, sourceType, invalidLines) {
  if (!existsSync(path)) return [];
  const rows = [];
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    try {
      rows.push({
        ...JSON.parse(line),
        _source_file: path,
        _source_type: sourceType,
        _source_line: index + 1
      });
    } catch (error) {
      invalidLines.push({
        file: path,
        line: index + 1,
        error: error.message
      });
    }
  });
  return rows;
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item[key] || "unknown";
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function stableHash(candidate) {
  const targetFiles = Array.isArray(candidate.target_files)
    ? candidate.target_files.slice().sort()
    : [String(candidate.target_files ?? "")];
  const value = JSON.stringify({
    category: candidate.category ?? "",
    risk: candidate.risk ?? "",
    problem: String(candidate.problem ?? "").trim().toLowerCase(),
    proposal: String(candidate.proposal ?? "").trim().toLowerCase(),
    target_files: targetFiles
  });
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function markdown(summary) {
  const lines = [
    "# Cross-Project Learning Summary",
    "",
    `Generated: ${summary.generated_at}`,
    `Candidates: ${summary.totals.candidates}`,
    `Unique candidates: ${summary.totals.unique_candidates}`,
    `Invalid JSONL lines: ${summary.totals.invalid_lines}`,
    "",
    "## Top Candidates",
    ""
  ];
  for (const item of summary.top_candidates) {
    lines.push(`- ${item.id} (${item.category}, ${item.risk}, x${item.count}): ${item.problem}`);
  }
  if (summary.top_candidates.length === 0) lines.push("- none");
  lines.push("", "## Recommended Promotions", "");
  for (const item of summary.recommended_promotions) {
    lines.push(`- ${item.id}: ${item.proposal}`);
  }
  if (summary.recommended_promotions.length === 0) lines.push("- none");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args["dry-run"] || args["what-if"]);
  const codexHome = args["codex-home"] ? resolve(args["codex-home"]) : join(homedir(), ".codex");
  const roots = (args.root.length ? args.root : [repoRoot]).map((root) => resolve(root));
  const invalidLines = [];
  const sources = [];

  const backlog = join(codexHome, "learning", "improvement-backlog.jsonl");
  if (existsSync(backlog)) sources.push({ path: backlog, type: "global-backlog" });

  for (const root of roots) {
    for (const file of walk(root)) {
      if (file.endsWith("improvement-candidates.jsonl")) {
        sources.push({ path: file, type: "project-run" });
      }
    }
  }

  const candidates = sources.flatMap((source) => readJsonl(source.path, source.type, invalidLines));
  const groups = new Map();
  for (const candidate of candidates) {
    const id = stableHash(candidate);
    const group = groups.get(id) ?? {
      id,
      count: 0,
      category: candidate.category || "unknown",
      risk: candidate.risk || "unknown",
      problem: candidate.problem || "",
      proposal: candidate.proposal || "",
      target_files: Array.isArray(candidate.target_files) ? candidate.target_files : [],
      sources: []
    };
    group.count += 1;
    group.sources.push({
      file: relative(repoRoot, candidate._source_file).replaceAll("\\", "/"),
      line: candidate._source_line,
      type: candidate._source_type,
      status: candidate.status,
      promotion_decision: candidate.promotion_decision
    });
    groups.set(id, group);
  }

  const unique = [...groups.values()].sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  const recommended = unique.filter((candidate) => {
    if (candidate.risk === "high") return false;
    if (candidate.category === "global-safety" || candidate.category === "release") return false;
    return candidate.category !== "unknown";
  }).slice(0, 20);

  const summary = {
    generated_at: new Date().toISOString(),
    codex_home: codexHome,
    roots,
    sources,
    totals: {
      sources: sources.length,
      candidates: candidates.length,
      unique_candidates: unique.length,
      invalid_lines: invalidLines.length,
      by_category: countBy(candidates, "category"),
      by_risk: countBy(candidates, "risk"),
      by_decision: countBy(candidates, "promotion_decision")
    },
    top_candidates: unique.slice(0, 25),
    recommended_promotions: recommended,
    invalid_lines: invalidLines
  };

  const jsonText = `${JSON.stringify(summary, null, 2)}\n`;
  const mdText = markdown(summary);
  if (dryRun) {
    console.log(jsonText);
    return;
  }

  const outDir = args["out-dir"] ? resolve(args["out-dir"]) : join(codexHome, "learning");
  const jsonPath = args.json ? resolve(args.json) : join(outDir, "learning-summary.json");
  const mdPath = args.md ? resolve(args.md) : join(outDir, "learning-summary.md");
  mkdirSync(dirname(jsonPath), { recursive: true });
  mkdirSync(dirname(mdPath), { recursive: true });
  writeFileSync(jsonPath, jsonText, "utf8");
  writeFileSync(mdPath, mdText, "utf8");
  console.log(`Learning summary written: ${jsonPath}`);
  console.log(`Learning summary markdown: ${mdPath}`);
}

main();
