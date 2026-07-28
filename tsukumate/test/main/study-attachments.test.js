"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createConversationStore } = require("../../src/main/chat/conversation-store");
const { createStudyAttachmentService } = require("../../src/main/chat/study-attachments");

test("learning documents are copied behind opaque ids and added within the text budget", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-attachment-"));
  const source = path.join(root, "notes.txt"); fs.writeFileSync(source, "Newton's second law: F = ma", "utf8");
  const store = createConversationStore(path.join(root, "history")); const conversation = store.create();
  const service = createStudyAttachmentService({
    dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [source] }) },
    shell: { openPath: async () => "" }, nativeImage: {}, store, getWindow: () => null,
  });
  const selected = await service.select(conversation.id, 7);
  assert.equal(selected.ok, true); assert.equal(selected.attachments.length, 1);
  assert.equal(Object.hasOwn(selected.attachments[0], "path"), false);
  const committed = service.commit(conversation.id, [selected.attachments[0].id], 7);
  const content = service.buildModelContent(conversation.id, [{ role: "user", content: "Explain", attachments: committed }]);
  assert.equal(content[0].role, "user"); assert.match(content[0].content[1].text, /F = ma/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("pending attachments remain sender scoped", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-attachment-owner-"));
  const source = path.join(root, "notes.md"); fs.writeFileSync(source, "# Notes", "utf8");
  const store = createConversationStore(path.join(root, "history")); const conversation = store.create();
  const service = createStudyAttachmentService({ dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [source] }) }, shell: {}, nativeImage: {}, store, getWindow: () => null });
  const selected = await service.select(conversation.id, 1); const id = selected.attachments[0].id;
  assert.equal(service.discard(conversation.id, id, 2), false);
  assert.throws(() => service.commit(conversation.id, [id], 2), /失效/);
  assert.equal(service.discard(conversation.id, id, 1), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test("clipboard images become opaque pending image attachments", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-clipboard-image-"));
  const store = createConversationStore(path.join(root, "history")); const conversation = store.create();
  const service = createStudyAttachmentService({ dialog: {}, shell: {}, nativeImage: {}, store, getWindow: () => null });
  const png = "data:image/png;base64,aGVsbG8=";
  const result = service.addClipboardImage(conversation.id, 7, { mimeType: "image/png", dataUrl: png });
  assert.equal(result.ok, true); assert.equal(result.attachment.kind, "image");
  assert.equal(Object.hasOwn(result.attachment, "path"), false);
  assert.equal(service.discard(conversation.id, result.attachment.id, 8), false);
  assert.equal(service.discard(conversation.id, result.attachment.id, 7), true);
  assert.equal(service.addClipboardImage(conversation.id, 7, { mimeType: "image/gif", dataUrl: "data:image/gif;base64,aGVsbG8=" }).ok, false);
  fs.rmSync(root, { recursive: true, force: true });
});
