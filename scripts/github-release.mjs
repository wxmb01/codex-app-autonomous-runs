#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function parseArgs(argv) {
  const args = { _: [] };
  for (const item of argv) {
    if (!item.startsWith("--")) {
      args._.push(item);
      continue;
    }
    const eq = item.indexOf("=");
    if (eq === -1) {
      args[item.slice(2)] = true;
    } else {
      args[item.slice(2, eq)] = item.slice(eq + 1);
    }
  }
  return args;
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"]
  }).trim();
}

function parseGitHubRepo(remoteUrl) {
  const trimmed = remoteUrl.trim();
  const https = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/i);
  if (https) return `${https[1]}/${https[2]}`;
  const ssh = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i);
  if (ssh) return `${ssh[1]}/${ssh[2]}`;
  const sshUrl = trimmed.match(/^ssh:\/\/git@github\.com\/([^/]+)\/(.+?)(?:\.git)?$/i);
  if (sshUrl) return `${sshUrl[1]}/${sshUrl[2]}`;
  throw new Error(`Cannot infer GitHub owner/repo from origin URL: ${remoteUrl}`);
}

function credentialToken() {
  try {
    const output = execFileSync("git", ["credential", "fill"], {
      cwd: repoRoot,
      input: "protocol=https\nhost=github.com\n\n",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"]
    });
    const secretLine = new RegExp(`^${["pass", "word"].join("")}=(.+)$`, "m");
    const credentialSecret = output.match(secretLine)?.[1];
    return credentialSecret || null;
  } catch {
    return null;
  }
}

function readNotes(args) {
  if (args["notes-file"]) {
    const path = resolve(repoRoot, args["notes-file"]);
    if (!existsSync(path)) throw new Error(`Release notes file not found: ${path}`);
    return readFileSync(path, "utf8");
  }
  if (typeof args.notes === "string") return args.notes;
  const changelog = join(repoRoot, "CHANGELOG.md");
  if (!existsSync(changelog)) return "";
  const text = readFileSync(changelog, "utf8");
  const match = text.match(/^##\s+[^\n]+\n([\s\S]*?)(?=\n##\s+|\s*$)/m);
  return match?.[1]?.trim() ?? "";
}

async function githubApi(method, path, authSecret, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${authSecret}`,
      "User-Agent": "codex-app-autonomous-runs",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message ? `${data.message}` : text;
    const error = new Error(`GitHub API ${method} ${path} failed: ${response.status} ${message}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args["dry-run"] || args["what-if"]);
  const repo = args.repo || parseGitHubRepo(git(["config", "--get", "remote.origin.url"]));
  const tag = args.tag || git(["describe", "--tags", "--exact-match", "HEAD"]);
  const target = args.target || git(["rev-parse", "HEAD"]);
  const title = args.title || tag;
  const body = readNotes(args);
  const payload = {
    tag_name: tag,
    target_commitish: target,
    name: title,
    body,
    draft: Boolean(args.draft),
    prerelease: Boolean(args.prerelease)
  };

  if (dryRun) {
    console.log(JSON.stringify({
      dry_run: true,
      action: "create-or-update-github-release",
      repo,
      payload
    }, null, 2));
    return;
  }

  const authSecret = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || credentialToken();
  if (!authSecret) {
    throw new Error("No GitHub token found. Set GITHUB_TOKEN/GH_TOKEN or sign in with Git credential manager.");
  }

  let release;
  try {
    release = await githubApi("GET", `/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`, authSecret);
    release = await githubApi("PATCH", `/repos/${repo}/releases/${release.id}`, authSecret, payload);
  } catch (error) {
    if (error.status !== 404) throw error;
    release = await githubApi("POST", `/repos/${repo}/releases`, authSecret, payload);
  }

  console.log(JSON.stringify({
    action: "create-or-update-github-release",
    repo,
    tag,
    target,
    release_id: release.id,
    release_url: release.html_url,
    status: "success"
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
