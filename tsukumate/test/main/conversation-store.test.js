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

test("conversation store persists branch metadata, annotations, and deletes a complete subtree", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-conversation-"));
  const store = createConversationStore(root);
  const parent = store.create({ title: "主话题" });
  store.append(parent.id, { id: "u1", role: "user", content: "解释递归", timestamp: new Date().toISOString() });
  store.append(parent.id, { id: "a1", role: "assistant", content: "递归是函数调用自身。", timestamp: new Date().toISOString() });
  const child = store.create({ title: "分支", parentConversationId: parent.id, branchPointMessageId: "a1", branchType: "inherit", parentSnapshot: { title: "主话题", summary: "递归基础" } });
  const grandchild = store.create({ title: "词汇", parentConversationId: child.id, branchPointMessageId: "a1", branchType: "vocabulary", parentSnapshot: { title: "分支", term: "递归", definition: "函数调用自身" } });
  assert.equal(store.readMeta(child.id).branchType, "inherit");
  assert.equal(store.readMeta(child.id).parentSnapshot.summary, "递归基础");
  const updated = store.updateDerivedMessage(parent.id, "a1", { learningAnnotations: [{ id: "term-0", start: 0, end: 2, term: "递归", definition: "函数调用自身" }] });
  assert.deepEqual(updated.learningAnnotations, [{ id: "term-0", start: 0, end: 2, term: "递归", definition: "函数调用自身" }]);
  assert.equal(store.updateSummary(parent.id, "递归的基本概念", 2).summaryVersion, 2);
  assert.equal(store.removeTree(parent.id), true);
  assert.equal(store.readMeta(parent.id), null);
  assert.equal(store.readMeta(child.id), null);
  assert.equal(store.readMeta(grandchild.id), null);
  fs.rmSync(root, { recursive: true, force: true });
});

test("conversation store preserves a signed special diary receipt on an assistant message", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-conversation-"));
  const store = createConversationStore(root); const meta = store.create();
  store.append(meta.id, { id: "a1", role: "assistant", content: "重要决定", timestamp: new Date().toISOString() });
  store.updateDerivedMessage(meta.id, "a1", { learningAnnotations: [{ id: "term", start: 0, end: 2, term: "重要", definition: "有长期影响" }] });
  const updated = store.updateDerivedMessage(meta.id, "a1", { specialDiary: { id: "special-m5abc-1234567890", title: "新的学习计划", summary: "决定每晚复习", createdAt: "2026-07-31T12:00:00.000Z", trigger: "command" } });
  assert.equal(updated.specialDiary.id, "special-m5abc-1234567890");
  assert.equal(updated.specialDiary.trigger, "command");
  assert.equal(updated.learningAnnotations[0].term, "重要");
  fs.rmSync(root, { recursive: true, force: true });
});

test("conversation store persists only signed graph node positions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-conversation-"));
  const store = createConversationStore(root); const conversation = store.create();
  assert.deepEqual(store.writeGraphLayout({ [conversation.id]: { x: 136.8, y: -44.2 }, outsider: { x: 1, y: 2 }, [conversation.id + "x"]: { x: Infinity, y: 2 } }), { [conversation.id]: { x: 137, y: -44 } });
  assert.deepEqual(store.readGraphLayout(), { [conversation.id]: { x: 137, y: -44 } });
  store.removeTree(conversation.id);
  assert.deepEqual(store.readGraphLayout(), {});
  fs.rmSync(root, { recursive: true, force: true });
});

test("generated titles accept fenced JSON but reject malformed or excessive titles", () => {
  assert.equal(parseGeneratedTitle('```json\n{"title":"复合情绪测试"}\n```', "zh-CN"), "复合情绪测试");
  assert.equal(parseGeneratedTitle("not json", "zh-CN"), "");
  assert.equal(parseGeneratedTitle(JSON.stringify({ title: "这是一个超过二十个字而且不应该被接受的标题" }), "zh-CN"), "");
});
