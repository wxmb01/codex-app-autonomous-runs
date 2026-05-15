import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const files = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else {
      files.push(full);
    }
  }
}

walk(root);

for (const file of files.filter((path) => /\.(md|js|json)$/.test(path))) {
  const text = readFileSync(file, "utf8");
  assert.equal(/\t/.test(text), false, `${file} contains a tab`);
  assert.equal(/\r\n/.test(text), false, `${file} should use LF in fixture files`);
}

console.log("lint rules passed");
