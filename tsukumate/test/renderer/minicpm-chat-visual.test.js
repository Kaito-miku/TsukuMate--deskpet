"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("keeps completed replies readable in continuous chat", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "..", "src", "renderer/chat-bubble/minicpm-chat.html"), "utf8");
  assert.match(html, /\.last-reply-region\s*\{[\s\S]*color:\s*var\(--text\);/);
});

test("keeps screen capture as a one-shot chat attachment", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "..", "src", "renderer/chat-bubble/minicpm-chat-renderer.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "..", "..", "src", "renderer/chat-bubble/minicpm-chat.html"), "utf8");
  assert.match(renderer, /screen_capture_token/);
  assert.match(renderer, /discardPendingScreenCapture/);
  assert.match(html, /screen-read-button/);
  assert.match(html, /screen-source-list/);
});
