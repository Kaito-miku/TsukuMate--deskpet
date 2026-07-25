"use strict";

const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const SRC_ROOT = path.join(PROJECT_ROOT, "src");

module.exports = Object.freeze({
  PROJECT_ROOT,
  SRC_ROOT,
  main: (...parts) => path.join(SRC_ROOT, "main", ...parts),
  renderer: (...parts) => path.join(SRC_ROOT, "renderer", ...parts),
  preload: (...parts) => path.join(SRC_ROOT, "preload/preload", ...parts),
  shared: (...parts) => path.join(SRC_ROOT, "shared", ...parts),
});
