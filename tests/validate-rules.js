import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const rulesPath = join(repoRoot, "templates/codex/rules/autonomous-safety.rules");

assert.ok(existsSync(rulesPath), `missing ${rulesPath}`);

const rulesText = readFileSync(rulesPath, "utf8");
const rulePattern = /prefix_rule\s*\(\s*pattern=\[([^\]]+)\]\s*,\s*decision="forbidden"\s*\)/g;
const forbiddenPatterns = [];
let match;

while ((match = rulePattern.exec(rulesText)) !== null) {
  const tokens = [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1].toLowerCase());
  assert.ok(tokens.length > 0, `empty forbidden prefix in ${match[0]}`);
  forbiddenPatterns.push(tokens);
}

assert.ok(forbiddenPatterns.length >= 20, "expected the safety rules to parse forbidden prefixes");

function tokenize(command) {
  const tokens = [];
  const tokenPattern = /"((?:\\"|[^"])*)"|'((?:\\'|[^'])*)'|(\S+)/g;
  let item;
  while ((item = tokenPattern.exec(command)) !== null) {
    tokens.push((item[1] ?? item[2] ?? item[3]).toLowerCase());
  }
  return tokens;
}

function decision(command) {
  const tokens = tokenize(command);
  const forbidden = forbiddenPatterns.some((pattern) => {
    if (pattern.length > tokens.length) return false;
    return pattern.every((expected, index) => expected === tokens[index]);
  });
  return forbidden ? "forbidden" : "allowed";
}

const blockedCommands = [
  "npm publish",
  "pnpm publish",
  "yarn publish",
  "terraform apply",
  "terraform destroy",
  "tofu apply",
  "pulumi up",
  "kubectl delete pod x",
  "kubectl apply -f app.yml",
  "helm upgrade app chart",
  "docker push image",
  "vercel deploy app --prod",
  "netlify deploy site --prod",
  "drop database prod",
  "truncate table users",
  "delete from users",
  "rm -rf tmp",
  "Remove-Item -Recurse -Force C:\\tmp\\x"
];

const allowedCommands = [
  "npm test",
  "git push origin main",
  "gh pr create --title test --body test",
  "terraform plan",
  "kubectl get pods",
  "psql -c \"drop database prod\"",
  "mysql -e \"delete from users\"",
  "psql -c select 1",
  "mysql -e select 1"
];

for (const command of blockedCommands) {
  assert.equal(decision(command), "forbidden", `${command} should be forbidden`);
}

for (const command of allowedCommands) {
  assert.equal(decision(command), "allowed", `${command} should be allowed`);
}

console.log("safety rules validation passed");
