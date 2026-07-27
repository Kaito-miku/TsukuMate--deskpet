"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createLearningService } = require("../../src/main/chat/learning-service");

function makeService(root, complete = async () => "") {
  return createLearningService({ root, dialog: {}, shell: {}, nativeImage: {}, complete, getConfig: () => ({}) });
}

test("learning notes are editable and context only uses signed note ids", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-learning-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const service = makeService(root);
  const note = service.saveNote({ title: "二次函数", content: "顶点式和判别式是重点", sourceMessageId: "message-1" });
  const context = await service.buildContext({ noteIds: [note.id, "../../oops"], query: "二次函数" });
  assert.equal(context.refs.length, 1);
  assert.match(context.text, /顶点式/);
  const updated = service.saveNote({ id: note.id, title: "二次函数复习", content: "更新内容" });
  assert.equal(updated.title, "二次函数复习");
  assert.equal(service.deleteNote(note.id), true);
  assert.equal(service.getNote(note.id), null);
});

test("deleting a resource removes its entire local directory and index", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-learning-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const service = makeService(root); const resourceId = "resource-delete-test";
  const dir = path.join(root, "learning", "resources", resourceId); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "source.txt"), "要删除的资源", "utf8");
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ id: resourceId, name: "删除测试.txt", extension: ".txt", storedName: "source.txt", size: 12, status: "ready", text: "要删除的资源" }), "utf8");
  assert.ok(service.getResource(resourceId));
  assert.equal(service.deleteResource(resourceId), true);
  assert.equal(fs.existsSync(dir), false);
  assert.equal(service.getResource(resourceId), null);
});

test("practice generation persists only validated structured questions", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-learning-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const service = makeService(root, async () => JSON.stringify({ title: "函数练习", questions: [{ id: "q1", type: "choice", prompt: "f(x)=x² 的最小值？", options: ["0", "1"], answer: "0", acceptableAnswers: ["A"] }] }));
  const note = service.saveNote({ title: "函数", content: "抛物线 y=x² 的最小值为 0" });
  const practice = await service.generate({ noteIds: [note.id], kind: "choice", subject: "math" });
  assert.equal(practice.questions.length, 1);
  const submitted = await service.submit(practice.id, "q1", "0", "");
  assert.equal(submitted.response.correct, true);
  assert.equal(submitted.response.analysis, "");
});

test("a single-purpose practice cannot be polluted by another question type", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-learning-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const service = makeService(root, async () => JSON.stringify({ title: "诗词卡片", questions: [{ id: "wrong-kind", type: "fill", prompt: "《马诗》的作者是谁？", answer: "李贺", options: ["李白"] }] }));
  const note = service.saveNote({ title: "诗词", content: "《马诗》作者是李贺" });
  const practice = await service.generate({ noteIds: [note.id], kind: "flashcards" });
  assert.deepEqual(practice.questions.map((question) => question.type), ["flashcard"]);
});

test("a practice set can be removed with all of its saved progress", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-learning-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const service = makeService(root, async () => JSON.stringify({ title: "删除测试", questions: [{ prompt: "1+1=?", answer: "2", type: "fill" }] }));
  const note = service.saveNote({ title: "测试", content: "一加一等于二" }); const practice = await service.generate({ noteIds: [note.id], kind: "fill" });
  assert.equal(service.deletePractice(practice.id), true);
  assert.equal(service.getPractice(practice.id), null);
});

test("batch submission stores a whole set and records flashcard mastery", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-learning-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const service = makeService(root, async () => JSON.stringify({ title: "批量练习", questions: [{ id: "fill-1", type: "fill", prompt: "1+1=?", answer: "2" }, { id: "card-1", type: "flashcard", prompt: "A", answer: "A" }] }));
  const note = service.saveNote({ title: "基础", content: "一加一等于二" }); const practice = await service.generate({ noteIds: [note.id], kind: "review" });
  const result = await service.submitBatch(practice.id, [{ questionId: "fill-1", answer: "2" }, { questionId: "card-1", mastered: true }]);
  assert.equal(result.practice.questions.find((item) => item.id === "fill-1").response.correct, true);
  assert.equal(result.practice.questions.find((item) => item.id === "card-1").response.answer, "__mastered__");
});
