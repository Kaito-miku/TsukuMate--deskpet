"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createCodingQaService, normalizeOcrMarkdown } = require("../../src/main/chat/coding-qa-service");

function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-coding-qa-"));
  const service = createCodingQaService({
    root,
    getWindow: () => null,
    dialog: { showOpenDialog: async () => options.dialogResult || { canceled: true, filePaths: [] } },
    ocr: options.ocr || (async () => "# Two Sum\n\nWrite a function."),
  });
  return { root, service, dispose: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("coding QA service persists a separate problem, markdown and answer history", () => {
  const h = fixture();
  try {
    const problem = h.service.create();
    const saved = h.service.save(problem.id, { markdown: "# Two Sum\n\nReturn indices." });
    h.service.appendMessage(problem.id, { id: "u1", role: "user", content: "给一点提示" });
    h.service.appendMessage(problem.id, { id: "a1", role: "assistant", content: "先用哈希表。", thinking: "先确认输入和复杂度。", thinkingState: "complete" });
    const restored = h.service.get(problem.id);
    assert.equal(saved.title, "Two Sum");
    assert.equal(restored.markdown, "# Two Sum\n\nReturn indices.");
    assert.deepEqual(restored.messages.map((item) => item.content), ["给一点提示", "先用哈希表。"]);
    assert.equal(restored.messages[1].thinking, "先确认输入和复杂度。");
    assert.equal(restored.messages[1].thinkingState, "complete");
    assert.equal(h.service.list()[0].id, problem.id);
  } finally { h.dispose(); }
});

test("coding QA image recognition stores an opaque image record and editable markdown", async () => {
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-coding-source-"));
  const imagePath = path.join(sourceRoot, "problem.png");
  fs.writeFileSync(imagePath, Buffer.from("fake-png"));
  const h = fixture({ dialogResult: { canceled: false, filePaths: [imagePath] }, ocr: async () => "# 图片题\n\n`for` 循环" });
  try {
    const problem = h.service.create();
    const selected = await h.service.selectImage(problem.id);
    assert.equal(selected.ok, true);
    assert.equal(selected.problem.image.name, "problem.png");
    const recognized = await h.service.recognize(problem.id);
    assert.equal(recognized.ok, true);
    assert.match(recognized.problem.markdown, /for/);
    const image = h.service.readImage(problem.id);
    assert.equal(image.ok, true);
    assert.match(image.image.dataUrl, /^data:image\/png;base64,/);
  } finally { h.dispose(); fs.rmSync(sourceRoot, { recursive: true, force: true }); }
});

test("coding QA OCR normalizes common LaTeX math into readable problem text", () => {
  const result = normalizeOcrMarkdown("从 $n$ 个数中取 $r$ 个（$r \\le n$），即 $1,2,\\dots,n$。");
  assert.equal(result, "从 n 个数中取 r 个（r ≤ n），即 1,2,…,n。");
});

test("coding QA delete removes only the selected problem directory", () => {
  const h = fixture();
  try {
    const first = h.service.create(); const second = h.service.create();
    assert.equal(h.service.remove(first.id), true);
    assert.equal(h.service.get(first.id), null);
    assert.ok(h.service.get(second.id));
  } finally { h.dispose(); }
});

test("coding QA persists per-language code and local test groups", () => {
  const h = fixture();
  try {
    const problem = h.service.create();
    h.service.saveRunner(problem.id, { language: "python", code: { cpp: "int main(){}", python: "print(input())" }, tests: [{ id: "sample-1", input: "hello", output: "hello", source: "sample" }] });
    const restored = h.service.get(problem.id);
    assert.equal(restored.runner.language, "python");
    assert.equal(restored.runner.code.cpp, "int main(){}");
    assert.deepEqual(restored.runner.tests[0], { id: "sample-1", input: "hello", output: "hello", source: "sample" });
  } finally { h.dispose(); }
});
