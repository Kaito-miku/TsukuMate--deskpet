"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createConversationStore } = require("../../src/main/chat/conversation-store");
const { parseGeneratedTitle } = require("../../src/main/chat/conversation-title");

test("conversation store persists titles, messages and context boundaries", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-conversation-"));
  const store = createConversationStore(root); const meta = store.create();
  store.append(meta.id, { id: "u1", role: "user", content: "hello", timestamp: new Date().toISOString() });
  store.append(meta.id, { id: "b1", role: "context-boundary", content: "clear", timestamp: new Date().toISOString() });
  assert.equal(store.readMessages(meta.id).length, 2);
  assert.equal(store.readMeta(meta.id).contextBoundaryId, "b1");
  store.updateTitle(meta.id, "Manual title", "user");
  assert.equal(store.updateTitle(meta.id, "Late AI", "ai").title, "Manual title");
  fs.rmSync(root, { recursive: true, force: true });
});

test("conversation store removes only a signed new-session directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-conversation-"));
  const store = createConversationStore(root); const meta = store.create();
  store.append(meta.id, { id: "u1", role: "user", content: "remove me", timestamp: new Date().toISOString() });
  assert.equal(store.remove(meta.id), true);
  assert.equal(store.readMeta(meta.id), null);
  assert.equal(store.remove("legacy-2026-07-27"), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test("conversation store removes one message without corrupting JSONL history", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-conversation-"));
  const store = createConversationStore(root); const meta = store.create();
  store.append(meta.id, { id: "u1", role: "user", content: "keep", timestamp: new Date().toISOString() });
  store.append(meta.id, { id: "a1", role: "assistant", content: "remove", timestamp: new Date().toISOString() });
  assert.equal(store.removeMessage(meta.id, "a1"), true);
  assert.deepEqual(store.readMessages(meta.id).map((message) => message.id), ["u1"]);
  assert.equal(store.removeMessage(meta.id, "missing"), false);
  assert.equal(store.removeMessage("legacy-2026-07-27", "u1"), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test("conversation store edits one message while retaining its position and history", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-conversation-"));
  const store = createConversationStore(root); const meta = store.create();
  store.append(meta.id, { id: "u1", role: "user", content: "before", timestamp: new Date().toISOString() });
  store.append(meta.id, { id: "a1", role: "assistant", content: "answer", timestamp: new Date().toISOString() });
  assert.equal(store.updateMessage(meta.id, "a1", { content: "edited answer" }).content, "edited answer");
  assert.deepEqual(store.readMessages(meta.id).map((message) => message.content), ["before", "edited answer"]);
  assert.equal(store.updateMessage(meta.id, "missing", { content: "nope" }), null);
  fs.rmSync(root, { recursive: true, force: true });
});

test("generated titles accept fenced JSON but reject malformed or excessive titles", () => {
  assert.equal(parseGeneratedTitle('```json\n{"title":"复合情绪测试"}\n```', "zh-CN"), "复合情绪测试");
  assert.equal(parseGeneratedTitle("not json", "zh-CN"), "");
  assert.equal(parseGeneratedTitle(JSON.stringify({ title: "这是一个超过二十个字而且不应该被接受的标题" }), "zh-CN"), "");
});
