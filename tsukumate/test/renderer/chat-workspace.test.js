"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "..", "src");
const read = (name) => fs.readFileSync(path.join(SRC, name), "utf8");
const { paginateHistoryLines } = require("../../src/shared/chat/chat-history-page");
const { computeWorkspaceCamera } = require("../../src/shared/live2d/live2d-workspace-camera");

test("chat workspace ships a three-column chat/history/diary/Live2D shell", () => {
  const html = read("renderer/chat-workspace/chat-workspace.html");
  const css = read("renderer/chat-workspace/chat-workspace.css");
  assert.match(html, /class="tool-rail"/);
  assert.match(html, /id="history-tool"/);
  assert.match(html, /id="diary-tool"/);
  assert.match(html, /id="chat-tool"/);
  assert.match(html, /id="live2d-stage"/);
  assert.match(css, /grid-template-columns:68px 0 minmax\(460px,1fr\) minmax\(280px,34%\)/);
  assert.match(css, /\.workspace\.drawer-open/);
});

test("workspace has a permanent chat return action and a dedicated Live2D camera fit", () => {
  const renderer = read("renderer/chat-workspace/chat-workspace-renderer.js");
  const chat = read("main/chat/minicpm-chat.js");
  assert.match(renderer, /chat-tool.*returnToChat/);
  assert.match(chat, /workspaceFraming:\s*"head-to-knees"/);
  assert.match(read("renderer/chat-workspace/chat-workspace-screen.css"), /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});

test("workspace camera auto-fits tall, regular, and wide drawable bounds without changing aspect", () => {
  for (const bounds of [
    { minX: -0.35, maxX: 0.35, minY: -2.4, maxY: 2.4 },
    { minX: -1, maxX: 1, minY: -1.4, maxY: 1.4 },
    { minX: -2, maxX: 2, minY: -1, maxY: 1 },
  ]) {
    const camera = computeWorkspaceCamera(bounds, 900, { workspaceScale: 1, workspaceOffsetY: 0 });
    assert.ok(camera.fit > 0);
    assert.equal(camera.targetFraction, 0.82);
    const targetWidth = (bounds.maxX - bounds.minX) * camera.fit;
    const targetHeight = ((bounds.maxY - bounds.minY) * 0.82) * camera.fit;
    assert.ok(targetWidth <= 1.800001);
    assert.ok(targetHeight <= 1.800001);
  }
});

test("history pagination exposes every line beyond the old 240-message cap with stable ids", () => {
  const lines = Array.from({ length: 350 }, (_, index) => JSON.stringify({ role: index % 2 ? "assistant" : "user", content: `m${index}` }));
  const seen = [];
  let before;
  do {
    const page = paginateHistoryLines("2026-07-25", lines, before, 100);
    seen.unshift(...page.messages);
    before = page.nextCursor;
    if (!page.hasMore) break;
  } while (true);
  assert.equal(seen.length, 350);
  assert.equal(seen[0].id, "2026-07-25-0");
  assert.equal(seen[349].id, "2026-07-25-349");
});

test("workspace preload exposes only constrained chat, date and diary operations", () => {
  const preload = read("preload/preload-chat-workspace.js");
  assert.match(preload, /chat-workspace:list-history/);
  assert.match(preload, /chat-workspace:load-diary/);
  assert.match(preload, /chat-workspace:save-diary/);
  assert.match(preload, /chat-workspace:screen-list/);
  assert.match(preload, /chat-workspace:screen-discard/);
  assert.doesNotMatch(preload, /require\("fs"\)/);
  assert.doesNotMatch(preload, /openPath/);
});

test("quick launcher opens the workspace while the legacy shortcut still targets the bubble", () => {
  const main = read("main/index.js");
  assert.match(main, /openChat: \(\) => openChatWorkspace\(\)/);
  assert.match(main, /function openMinicpmChat\(\)/);
  assert.match(main, /_minicpmChat\.isWorkspaceOpen\(\)/);
  assert.match(read("main/chat/minicpm-chat.js"), /workspace\.isMinimized\(\).*workspace\.restore\(\)/);
});

test("workspace history and diary IPC reject arbitrary paths", () => {
  const chat = read("main/chat/minicpm-chat.js");
  assert.match(chat, /DATE_ID_RE = \/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//);
  assert.match(chat, /chat-workspace:load-history/);
  assert.match(chat, /chat-workspace:save-diary/);
  assert.match(chat, /fs\.renameSync\(temp, target\)/);
});

test("workspace screen capture remains tokenized and one-shot", () => {
  const html = read("renderer/chat-workspace/chat-workspace.html");
  const renderer = read("renderer/chat-workspace/chat-workspace-renderer.js");
  const chat = read("main/chat/minicpm-chat.js");
  assert.match(html, /id="screen-attachment"/);
  assert.match(renderer, /screenCaptureToken: token/);
  assert.match(chat, /takeScreenCapture\(screenCaptureToken, senderId\)/);
  assert.doesNotMatch(renderer, /screenImageDataUrl/);
});

test("workspace keeps lifecycle state separate from Cubism diagnostic logs", () => {
  const preload = read("preload/preload-chat-workspace.js");
  const renderer = read("renderer/chat-workspace/chat-workspace-renderer.js");
  assert.match(preload, /lifecycleEvent/);
  assert.match(preload, /lastLive2dStatus\.phase/);
  assert.match(renderer, /const viewState = \{ content: "chat", drawer: null/);
  assert.match(renderer, /mergeMessages\(session\.messages\)/);
});
