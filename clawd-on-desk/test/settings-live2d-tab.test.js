"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createSettingsController } = require("../src/settings-controller");

test("Live2D settings tab uses the settings core tab registry", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "settings-tab-live2d.js"), "utf8");
  assert.match(source, /core\.tabs\.live2d\s*=\s*\{ render \}/);
  assert.doesNotMatch(source, /core\.ops\.registerTab/);
});

test("Live2D layout settings pass the controller registry and persist", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clawd-live2d-settings-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const prefsPath = path.join(dir, "prefs.json");
  const controller = createSettingsController({ prefsPath });
  const value = { modelId: "hiyori", scale: 1.19, offsetX: -22, offsetY: 31 };
  const result = controller.applyUpdate("live2d", value);
  assert.equal(result.status, "ok");
  assert.deepEqual(controller.get("live2d"), value);
  const reloaded = createSettingsController({ prefsPath });
  assert.deepEqual(reloaded.get("live2d"), value);
});

test("Live2D settings reject out-of-range layout values", () => {
  const controller = createSettingsController({
    loadResult: { snapshot: { live2d: { modelId: "", scale: 1, offsetX: 0, offsetY: 0 } }, locked: false },
  });
  assert.equal(controller.applyUpdate("live2d", { modelId: "x", scale: 9, offsetX: 0, offsetY: 0 }).status, "error");
});
