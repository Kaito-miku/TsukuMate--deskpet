"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const src = (name) => fs.readFileSync(path.join(__dirname, "..", "src", name), "utf8");

test("chat emotion status uses a constrained main-to-renderer IPC surface", () => {
  const main = src("minicpm-chat.js");
  const preload = src("preload-minicpm-chat.js");
  assert.match(main, /publishEmotionStatus\(\{ phase: "provisional", blend: provisional, moodAction: provisionalMoodAction \}\)/);
  const classifier = main.slice(main.indexOf("async function classifyChatEmotion"), main.indexOf("function localDay"));
  assert.ok(
    classifier.indexOf('publishEmotionStatus({ phase: "provisional", blend: provisional, moodAction: provisionalMoodAction })')
      < classifier.indexOf("await requestOpenAi({"),
    "the provisional reaction must be published before waiting for the classifier API",
  );
  assert.match(main, /publishEmotionStatus\(\{ phase: source, blend, moodAction \}\)/);
  assert.match(main, /"minicpm:emotion-status": async \(event\)/);
  assert.match(preload, /getEmotionStatus: \(\) => ipcRenderer\.invoke\("minicpm:emotion-status"\)/);
  assert.match(preload, /classifyEmotion:/);
  assert.match(preload, /onEmotionStatus:/);
  assert.match(main, /"minicpm:emotion-classify-local": async \(event/);
});

test("chat UI renders the latest emotion without adding it to conversation history", () => {
  const html = src("minicpm-chat.html");
  const renderer = src("minicpm-chat-renderer.js");
  assert.match(html, /id="emotionStatus"/);
  assert.match(renderer, /moodPrefix: "持续"/);
  assert.match(renderer, /function renderEmotionStatus/);
  assert.match(renderer, /function formatEmotionBlend/);
  assert.match(renderer, /window\.minicpm\.classifyEmotion\(text, emotionEventId\)/);
  assert.match(renderer, /emotion_event_id: emotionEventId/);
  assert.match(renderer, /API 校正/);
  assert.doesNotMatch(renderer, /history\.push\([^\n]*latestEmotionStatus/);
});
