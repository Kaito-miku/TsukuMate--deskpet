"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Live2D settings tab uses the settings core tab registry", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "settings-tab-live2d.js"), "utf8");
  assert.match(source, /core\.tabs\.live2d\s*=\s*\{ render \}/);
  assert.doesNotMatch(source, /core\.ops\.registerTab/);
});
