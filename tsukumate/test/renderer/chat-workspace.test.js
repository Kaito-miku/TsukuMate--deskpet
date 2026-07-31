"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "..", "src");
const read = (name) => fs.readFileSync(path.join(SRC, name), "utf8");
const { paginateHistoryLines } = require("../../src/shared/chat/chat-history-page");
const { computeWorkspaceCamera } = require("../../src/shared/live2d/live2d-workspace-camera");

test("chat workspace ships a three-column conversation/diary/Live2D shell", () => {
  const html = read("renderer/chat-workspace/chat-workspace.html");
  const css = read("renderer/chat-workspace/chat-workspace.css");
  assert.match(html, /class="tool-rail"/);
  assert.match(html, /id="diary-tool"/);
  assert.match(html, /id="chat-tool"/);
  assert.doesNotMatch(html, /id="history-tool"/);
  assert.match(html, /id="conversation-navigator"/);
  assert.match(html, /id="diary-empty-state"/);
  assert.match(html, /id="live2d-stage"/);
  assert.match(css, /grid-template-columns:68px 0 minmax\(460px,1fr\) minmax\(280px,34%\)/);
  assert.match(css, /\.workspace\.drawer-open/);
});

test("workspace has a conversation-history action and a dedicated Live2D camera fit", () => {
  const renderer = read("renderer/chat-workspace/chat-workspace-renderer.js");
  const chat = read("main/chat/minicpm-chat.js");
  assert.match(renderer, /chat-tool.*showConversationDrawer/);
  assert.match(renderer, /showDiaryDrawer\([\s\S]*selectedDiary = null/);
  assert.match(chat, /workspaceFraming:\s*"head-to-knees"/);
  assert.match(read("renderer/chat-workspace/chat-workspace-screen.css"), /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  assert.match(renderer, /function renderSafeMarkdown/);
  assert.match(renderer, /function appendMarkdownInline/);
  assert.match(read("renderer/chat-workspace/chat-workspace.html"), /chat-workspace-markdown\.css/);
  assert.match(read("renderer/chat-workspace/chat-workspace.html"), /chat-workspace-bubbles\.css/);
  assert.match(renderer, /messageNodeCache/);
  assert.match(renderer, /splitStreamingContent/);
  assert.match(renderer, /message-code-block/);
  assert.match(renderer, /message-html-preview/);
  assert.match(renderer, /TsukuMateRichContent\.renderCard/);
  assert.match(renderer, /raw complete web document/);
  assert.match(renderer, /vcp-root\|response-root/);
  assert.match(renderer, /TsukuMateRichContent\.onInput/);
  assert.match(renderer, /return "default"/);
  assert.match(renderer, /visual-bubble-stable/);
  assert.match(renderer, /clearMessageNode\(row\); row\.replaceChildren\(\)/);
  assert.doesNotMatch(renderer, /function renderMessages\(\) \{[\s\S]{0,180}root\.replaceChildren\(\)/);
  assert.match(read("renderer/chat-workspace/chat-workspace.html"), /id="coding-qa-tool"/);
  assert.match(read("renderer/chat-workspace/chat-workspace.html"), /id="coding-qa-layout"/);
  assert.match(renderer, /function renderCodingQa\(\)/);
  assert.match(chat, /chat-workspace:coding-qa:send/);
});

test("full workspace hides the desktop pet only while the workspace is visible", () => {
  const chat = read("main/chat/minicpm-chat.js");
  assert.match(chat, /function syncWorkspacePetVisibility\(workspaceVisible\)/);
  assert.match(chat, /workspace\.on\("show", \(\) => syncWorkspacePetVisibility\(true\)\)/);
  assert.match(chat, /workspace\.on\("restore", \(\) => syncWorkspacePetVisibility\(true\)\)/);
  assert.match(chat, /workspace\.on\("minimize", \(\) => syncWorkspacePetVisibility\(false\)\)/);
  assert.match(chat, /workspace\.on\("hide", \(\) => syncWorkspacePetVisibility\(false\)\)/);
  assert.match(chat, /syncWorkspacePetVisibility\(true\);\s*if \(workspace\.isMinimized\(\)\) workspace\.restore\(\)/);
});

test("workspace uses a neutral default visual bubble and isolated code blocks", () => {
  const css = read("renderer/chat-workspace/chat-workspace-bubbles.css");
  const renderer = read("renderer/chat-workspace/chat-workspace-renderer.js");
  const chat = read("main/chat/minicpm-chat.js");
  assert.match(css, /\.message-code-block/);
  assert.match(css, /data-bubble-theme="science"/);
  assert.match(css, /rgba\(42,44,49,\.76\)/);
  assert.match(css, /\.thinking-card/);
  assert.match(css, /tm-thinking-flow/);
  assert.match(renderer, /function renderThinkingCard/);
  assert.match(renderer, /thinkingState/);
  assert.match(chat, /frame\?\.event === "think"/);
  assert.match(chat, /assistant\.thinking \+=/);
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

test("workspace preload exposes only constrained conversation, attachment and diary operations", () => {
  const preload = read("preload/preload-chat-workspace.js");
  assert.match(preload, /chat-workspace:list-history/);
  assert.match(preload, /chat-workspace:load-diary/);
  assert.match(preload, /chat-workspace:save-diary/);
  assert.match(preload, /chat-workspace:create-conversation/);
  assert.match(preload, /chat-workspace:delete-conversation/);
  assert.match(preload, /chat-workspace:select-attachments/);
  assert.match(preload, /chat-workspace:paste-image/);
  assert.match(preload, /chat-workspace:read-clipboard-image/);
  assert.match(preload, /chat-workspace:discard-attachment/);
  assert.match(preload, /chat-workspace:get-a2ui-source/);
  assert.match(preload, /chat-workspace:perform-a2ui-action/);
  assert.match(preload, /chat-workspace:get-a2ui-model/);
  assert.match(preload, /chat-workspace:get-a2ui-whep-config/);
  assert.doesNotMatch(preload, /chat-workspace:screen-list/);
  assert.doesNotMatch(preload, /require\("fs"\)/);
  assert.doesNotMatch(preload, /openPath/);
});

test("conversation drawer provides a guarded delete control for new sessions", () => {
  const renderer = read("renderer/chat-workspace/chat-workspace-renderer.js");
  const chat = read("main/chat/minicpm-chat.js");
  assert.match(renderer, /conversation-delete/);
  assert.match(renderer, /api\.deleteConversation/);
  assert.match(chat, /chat-workspace:delete-conversation/);
  assert.match(chat, /conversationStore\.remove/);
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

test("daily diary includes new conversation sessions and only catches up yesterday on launch", () => {
  const chat = read("main/chat/minicpm-chat.js");
  assert.match(chat, /function readDailyDiaryRecords\(day\)/);
  assert.match(chat, /conversationStore\.readMessages\(conversation\.id\)/);
  assert.match(chat, /const yesterday = new Date\(\); yesterday\.setDate\(yesterday\.getDate\(\) - 1\)/);
  assert.match(chat, /if \(!fs\.existsSync\(path\.join\(diaryDir,/);
  assert.match(chat, /await generateDailyDiary\(day\)/);
});

test("workspace replaces screen capture with tokenized learning attachments", () => {
  const html = read("renderer/chat-workspace/chat-workspace.html");
  const renderer = read("renderer/chat-workspace/chat-workspace-renderer.js");
  const chat = read("main/chat/minicpm-chat.js");
  assert.match(html, /id="attachment-button"/);
  assert.match(renderer, /attachmentIds: ids/);
  assert.match(chat, /studyAttachments\.commit/);
  assert.doesNotMatch(renderer, /screenImageDataUrl|screenCaptureToken/);
  assert.match(chat, /minicpm:screen-capture-list/);
  assert.match(renderer, /addEventListener\("paste"/);
  assert.match(renderer, /api\.readClipboardImage/);
  assert.match(chat, /chat-workspace:paste-image/);
  assert.match(chat, /clipboard\.readImage\(\)/);
  assert.match(chat, /studyAttachments\.addClipboardImage/);
});

test("workspace image viewer keeps attachments tokenized while offering preview, annotation and OCR", () => {
  const html = read("renderer/chat-workspace/chat-workspace.html");
  const renderer = read("renderer/chat-workspace/chat-workspace-renderer.js");
  const preload = read("preload/preload-chat-workspace.js");
  const chat = read("main/chat/minicpm-chat.js");
  assert.match(html, /id="image-viewer"/); assert.match(html, /id="image-canvas"/); assert.match(html, /id="image-ocr"/);
  assert.match(html, /id="image-eraser"/); assert.match(html, /id="image-line"/); assert.match(html, /id="image-rect"/); assert.match(html, /id="image-undo"/); assert.match(html, /id="image-redo"/);
  assert.match(html, /id="annotation-selection-menu"/); assert.match(html, /id="annotation-scale-up"/);
  assert.match(renderer, /openImageViewer/); assert.match(renderer, /previewAttachmentImage/); assert.match(renderer, /ocrAttachmentImage/);
  assert.match(renderer, /function renderAnnotations/); assert.match(renderer, /function restoreAnnotationHistory/); assert.match(renderer, /rectsIntersect/); assert.match(renderer, /function showAnnotationSelectionMenu/); assert.match(renderer, /function moveAnnotation/);
  assert.match(renderer, /Ctrl-modified wheel event/); assert.match(renderer, /event\.ctrlKey/);
  assert.match(preload, /chat-workspace:preview-attachment-image/); assert.match(preload, /chat-workspace:ocr-attachment-image/);
  assert.match(chat, /studyAttachments\.readImage/); assert.match(chat, /You are an OCR transcriber/);
});

test("workspace keeps lifecycle state separate from Cubism diagnostic logs", () => {
  const preload = read("preload/preload-chat-workspace.js");
  const renderer = read("renderer/chat-workspace/chat-workspace-renderer.js");
  assert.match(preload, /lifecycleEvent/);
  assert.match(preload, /lastLive2dStatus\.phase/);
  assert.match(renderer, /let viewState = \{ content: "chat", drawer: null/);
  assert.match(renderer, /renderMessages\(\)/);
  assert.match(renderer, /live2dHasVisibleFrame/);
  assert.match(renderer, /detectLive2dFrame/);
});

test("workspace renders an accessible scroll navigator and floating latest-message control", () => {
  const html = read("renderer/chat-workspace/chat-workspace.html");
  const renderer = read("renderer/chat-workspace/chat-workspace-renderer.js");
  const css = read("renderer/chat-workspace/chat-workspace-learning.css");
  assert.match(html, /aria-label="对话阅读导航"/);
  assert.match(renderer, /conversation-nav-marker/);
  assert.match(renderer, /updateConversationNavigator/);
  assert.match(renderer, /scrollNavigatorTo/);
  assert.match(css, /border-radius:999px!important/);
  assert.match(css, /\.conversation-nav-track/);
});

test("workspace navigation and Live2D columns stay fixed across section switches", () => {
  const css = read("renderer/chat-workspace/chat-workspace-learning.css");
  assert.match(css, /--drawer-column:0px/);
  assert.match(css, /--live2d-column:340px/);
  assert.match(css, /\.workspace\.drawer-open\{--drawer-column:250px\}/);
  assert.match(css, /\.tool-rail\{grid-column:1;grid-row:1;position:relative;z-index:30/);
  assert.match(css, /\.live2d-pane\{grid-column:4;grid-row:1;width:var\(--live2d-column\)/);
  assert.match(css, /\.drawer\[aria-hidden="true"\]\{visibility:hidden/);
});

test("workspace Live2D framing caches neutral model-space bounds", () => {
  const renderer = read("renderer/shared/live2d/live2d-cubism5-renderer.ts");
  assert.match(renderer, /let rawBoundsCache: any = null/);
  assert.match(renderer, /if \(!rawBoundsCache\)/);
  assert.match(renderer, /projection\.transformY\(rawBoundsCache\.minY\)/);
  assert.doesNotMatch(renderer, /boundsCache\.width !== width/);
});
