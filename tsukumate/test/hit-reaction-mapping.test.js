"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("reserves the primary click for the launcher instead of accumulating double clicks", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "renderer/hit-target/hit-renderer.js"), "utf8");
  assert.doesNotMatch(source, /clickCount >= 2 && doubleReact/);
  assert.match(source, /toggleQuickLauncher/);
});
