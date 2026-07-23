"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("maps double click to the configured double reaction", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "hit-renderer.js"), "utf8");
  assert.match(source, /if \(clickCount >= 2 && doubleReact\)/);
  assert.doesNotMatch(source, /clickCount >= 4 && doubleReact/);
});
