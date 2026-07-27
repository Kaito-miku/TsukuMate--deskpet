"use strict";

const path = require("node:path");

const SRC_ROOT = path.resolve(__dirname, "..");
const APP_ROOT = path.resolve(SRC_ROOT, "..");
const MAIN_ROOT = path.join(SRC_ROOT, "main");
const RENDERER_ROOT = path.join(SRC_ROOT, "renderer");
const PRELOAD_ROOT = path.join(SRC_ROOT, "preload");
const SHARED_ROOT = path.join(SRC_ROOT, "shared");
const ASSETS_ROOT = path.join(APP_ROOT, "assets");
const HOOKS_ROOT = path.join(APP_ROOT, "hooks");
const THEMES_ROOT = path.join(APP_ROOT, "themes");
const PWA_ROOT = path.join(APP_ROOT, "pwa");
const EXTENSIONS_ROOT = path.join(APP_ROOT, "extensions");

module.exports = Object.freeze({
  APP_ROOT,
  SRC_ROOT,
  MAIN_ROOT,
  RENDERER_ROOT,
  PRELOAD_ROOT,
  SHARED_ROOT,
  ASSETS_ROOT,
  HOOKS_ROOT,
  THEMES_ROOT,
  PWA_ROOT,
  EXTENSIONS_ROOT,
});
