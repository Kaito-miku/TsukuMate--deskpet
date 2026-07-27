"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const BOOTSTRAP_FILE = path.join(
  __dirname,
  "..",
  "..",
  "src",
  "renderer",
  "shared",
  "live2d",
  "live2d-bootstrap.js"
);

test("Live2D bootstrap keeps its bundle URL across asynchronous Core loading", () => {
  const appended = [];
  const reports = [];
  const bootstrapUrl = "file:///app/src/renderer/shared/live2d/live2d-bootstrap.js";
  const document = {
    currentScript: { src: bootstrapUrl },
    createElement: () => ({}),
    head: { appendChild: (element) => appended.push(element) },
  };
  const window = {
    themeConfig: { live2d: { enabled: true, coreUrl: "file:///models/live2dcubismcore.min.js" } },
    electronAPI: { reportLive2dStatus: (payload) => reports.push(payload) },
  };

  vm.runInNewContext(fs.readFileSync(BOOTSTRAP_FILE, "utf8"), {
    URL,
    document,
    window,
  });

  assert.equal(appended.length, 1);
  const coreScript = appended[0];
  assert.equal(coreScript.src, "file:///models/live2dcubismcore.min.js");

  // Browser callbacks do not retain document.currentScript.
  document.currentScript = null;
  window.Live2DCubismCore = {};
  coreScript.onload();

  assert.equal(appended.length, 2);
  assert.equal(
    appended[1].src,
    "file:///app/src/renderer/shared/live2d/live2d-renderer.bundle.js"
  );
  assert.deepEqual(reports, []);
});
