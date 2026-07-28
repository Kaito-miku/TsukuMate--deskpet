"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createA2uiMediaService } = require("../../src/main/chat/a2ui-media-service");

test("A2UI media only registers public HTTPS search results and gates external opens", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-a2ui-")); let opened = ""; let confirmations = 0;
  const service = createA2uiMediaService({ root, shell: { openExternal: async (url) => { opened = url; } }, dialog: { showMessageBox: async () => { confirmations += 1; return { response: 1 }; } } });
  const records = service.registerSearchSources([{ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", name: "video" }, { url: "https://127.0.0.1/no", name: "private" }]);
  assert.equal(records.length, 1);
  const resolved = await service.resolveSource(records[0].id, "video");
  assert.equal(resolved.provider, "youtube"); assert.match(resolved.embedUrl, /youtube-nocookie/);
  assert.equal((await service.openSource(records[0].id)).ok, true); assert.equal(confirmations, 1); assert.match(opened, /youtube\.com/);
  fs.rmSync(root, { recursive: true, force: true });
});
