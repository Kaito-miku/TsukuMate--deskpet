"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("sidebar navigation selects tabs on pointerdown, click, and keyboard", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "settings-renderer.js"), "utf8");
  assert.match(source, /item\.addEventListener\("pointerdown"/);
  assert.match(source, /item\.addEventListener\("click", select\)/);
  assert.match(source, /event\.key === "Enter" \|\| event\.key === " "/);
});
