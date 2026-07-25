"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("chat sends only with Cmd/Ctrl+Enter", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "renderer/chat-bubble/minicpm-chat-renderer.js"), "utf8");
  assert.match(source, /e\.key === "Enter" && \(e\.metaKey \|\| e\.ctrlKey\) && !e\.altKey/);
});
