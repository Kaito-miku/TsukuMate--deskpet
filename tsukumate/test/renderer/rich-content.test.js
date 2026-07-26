"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("rich card preview is scriptless, network isolated and supports source switching", () => {
  const file = fs.readFileSync(path.join(__dirname, "../../src/renderer/shared/rich-content/index.js"), "utf8");
  assert.match(file, /DOMPurify\.sanitize/);
  assert.match(file, /setAttribute\("sandbox", ""\)/);
  assert.match(file, /default-src 'none'/);
  assert.match(file, /url\\s\*/);
  assert.match(file, /查看源码/); assert.match(file, /返回卡片/);
});
