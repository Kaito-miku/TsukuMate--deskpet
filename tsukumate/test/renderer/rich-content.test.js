"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("rich card preview runs common web code in an opaque, capability-limited sandbox", () => {
  const file = fs.readFileSync(path.join(__dirname, "../../src/renderer/shared/rich-content/index.js"), "utf8");
  assert.match(file, /DOMPurify\.sanitize/);
  assert.match(file, /setAttribute\("sandbox", "allow-scripts"\)/);
  assert.match(file, /default-src 'none'/);
  assert.match(file, /connect-src 'none'/);
  assert.match(file, /SCRIPT_HOSTS/);
  assert.match(file, /safeRemoteScript/);
  assert.match(file, /structuredDocument/);
  assert.match(file, /renderStructuredDocument/);
  assert.match(file, /renderInlineFragment/);
  assert.match(file, /buildPreviewDocument/);
  assert.match(file, /tsukumate-preview-resize/);
  assert.match(file, /ResizeObserver/);
  assert.match(file, /url\\s\*/);
  assert.match(file, /查看源码/); assert.match(file, /返回卡片/);
});

test("rich content de-indents every raw visual HTML tag in final and streaming paths", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "../../src/renderer/shared/rich-content/index.js"), "utf8");
  const pipeline = fs.readFileSync(path.join(__dirname, "../../src/renderer/shared/rich-content/unistudy-content-pipeline.js"), "utf8");
  assert.ok(renderer.includes('(?=<\\/?[a-z][\\w:-]*\\b)'));
  assert.match(pipeline, /step\(ctx, 'deindent-html', \(text\) => deIndentHtml\(text\)\)/);
});
