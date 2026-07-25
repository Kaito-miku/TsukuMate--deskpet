"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { readMotionGroups } = require("../src/main/theme/live2d-assets");

test("readMotionGroups exposes model3 motion groups without file paths", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clawd-live2d-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "pet.model3.json");
  fs.writeFileSync(file, JSON.stringify({
    FileReferences: {
      Motions: {
        Idle: [{ File: "idle.motion3.json" }, { File: "idle-2.motion3.json" }],
        Tap: [{ File: "tap.motion3.json" }],
      },
    },
  }));
  assert.deepEqual(readMotionGroups(file), [
    { group: "Idle", count: 2 },
    { group: "Tap", count: 1 },
  ]);
});

test("readMotionGroups safely handles missing or malformed model files", () => {
  assert.deepEqual(readMotionGroups("/definitely/missing/model.model3.json"), []);
});
