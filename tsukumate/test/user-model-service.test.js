"use strict";

const assert = require("node:assert/strict");
const { describe, test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const APP_ROOT = path.join(__dirname, "..");
const REPO_ROOT = path.join(APP_ROOT, "..");
const pkg = require("../package.json");

describe("user-managed model service", () => {
  test("does not package an inference sidecar or LoRA adapters", () => {
    const resources = JSON.stringify(pkg.build.extraResources || []);
    assert.doesNotMatch(resources, /minicpm-sidecar|sidecar-bin|\.\.\/adapters/);
    assert.equal(pkg.scripts["fetch:adapters"], undefined);
    assert.equal(pkg.scripts["verify:adapters"], undefined);
  });

  test("does not ship model download, onboarding, or local-model settings pages", () => {
    for (const relative of [
      "src/minicpm-model-download.js",
      "src/minicpm-onboarding.js",
      "src/settings-tab-minicpm.js",
    ]) {
      assert.equal(fs.existsSync(path.join(APP_ROOT, relative)), false, relative);
    }
  });

  test("does not keep bundled inference source or adapters in the repository", () => {
    assert.equal(fs.existsSync(path.join(REPO_ROOT, "minicpm-sidecar")), false);
    const adaptersDir = path.join(REPO_ROOT, "adapters");
    assert.equal(fs.existsSync(adaptersDir) ? fs.readdirSync(adaptersDir).length : 0, 0);
  });
});
