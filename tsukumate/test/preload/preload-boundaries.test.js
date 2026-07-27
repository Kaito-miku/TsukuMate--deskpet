"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC_ROOT = path.join(__dirname, "..", "..", "src");
const PRELOAD_ROOT = path.join(SRC_ROOT, "preload");

test("preload bridges depend only on Electron and shared modules", () => {
  const files = fs.readdirSync(PRELOAD_ROOT).filter((name) => name.endsWith(".js"));
  assert.ok(files.length > 0);

  for (const name of files) {
    const file = path.join(PRELOAD_ROOT, name);
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/require\(["']([^"']+)["']\)/g)) {
      const request = match[1];
      if (request === "electron") continue;
      assert.ok(request.startsWith("../shared/"), `${name} imports forbidden dependency ${request}`);
      const resolved = path.resolve(PRELOAD_ROOT, request);
      assert.ok(resolved.startsWith(path.join(SRC_ROOT, "shared") + path.sep));
      assert.ok(fs.existsSync(resolved) || fs.existsSync(`${resolved}.js`));
    }
  }
});
