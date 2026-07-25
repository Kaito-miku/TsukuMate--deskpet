const { spawnSync } = require("node:child_process");
const { readdirSync } = require("node:fs");
const path = require("node:path");

const testDir = __dirname;
const NON_TEST_DIRS = new Set(["fakes", "fixtures", "helpers"]);

function discoverTests(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!NON_TEST_DIRS.has(entry.name)) files.push(...discoverTests(path.join(dir, entry.name)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".test.js")) files.push(path.join(dir, entry.name));
  }
  return files;
}

const files = discoverTests(testDir).sort();

if (files.length === 0) {
  console.error("No test/**/*.test.js files found.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status == null ? 1 : result.status);
