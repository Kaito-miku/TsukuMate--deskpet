"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const src = (name) => fs.readFileSync(path.join(__dirname, "..", "src", name), "utf8");

test("chat emotion status uses a constrained main-to-renderer IPC surface", () => {
  const main = src("minicpm-chat.js");
  const preload = src("preload-minicpm-chat.js");
  assert.match(main, /publishEmotionStatus\(\{ phase: "classifying"/);
  assert.match(main, /publishEmotionStatus\(\{ phase: source, emotion \}\)/);
  assert.match(main, /"minicpm:emotion-status": async \(event\)/);
  assert.match(preload, /getEmotionStatus: \(\) => ipcRenderer\.invoke\("minicpm:emotion-status"\)/);
  assert.match(preload, /onEmotionStatus:/);
});

test("chat UI renders the latest emotion without adding it to conversation history", () => {
  const html = src("minicpm-chat.html");
  const renderer = src("minicpm-chat-renderer.js");
  assert.match(html, /id="emotionStatus"/);
  assert.match(renderer, /最近情绪/);
  assert.match(renderer, /function renderEmotionStatus/);
  assert.doesNotMatch(renderer, /history\.push\([^\n]*latestEmotionStatus/);
});
