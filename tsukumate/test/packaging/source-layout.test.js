"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const APP_ROOT = path.join(__dirname, "..", "..");
const SRC_ROOT = path.join(APP_ROOT, "src");
const RENDERER_ROOT = path.join(SRC_ROOT, "renderer");

function walk(root, predicate = () => true) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walk(file, predicate));
    else if (entry.isFile() && predicate(file)) files.push(file);
  }
  return files;
}

function relativeImports(source) {
  return [...source.matchAll(/(?:require\(|\bfrom\s+)["'](\.[^"']+)["']/g)].map((match) => match[1]);
}

test("src root contains only the four Electron architecture layers", () => {
  const entries = fs.readdirSync(SRC_ROOT, { withFileTypes: true });
  assert.deepEqual(entries.filter((entry) => entry.isFile()).map((entry) => entry.name), []);
  assert.deepEqual(
    entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(),
    ["main", "preload", "renderer", "shared"]
  );
});

test("package entry and centralized application paths resolve", () => {
  const pkg = require(path.join(APP_ROOT, "package.json"));
  assert.equal(pkg.main, "src/main/index.js");
  assert.ok(fs.existsSync(path.join(APP_ROOT, pkg.main)));

  const paths = require(path.join(SRC_ROOT, "main", "paths"));
  for (const key of [
    "APP_ROOT", "SRC_ROOT", "RENDERER_ROOT", "PRELOAD_ROOT", "ASSETS_ROOT",
    "HOOKS_ROOT", "THEMES_ROOT", "PWA_ROOT", "EXTENSIONS_ROOT",
  ]) {
    assert.equal(typeof paths[key], "string", `${key} should be exported`);
    assert.ok(fs.existsSync(paths[key]), `${key} should resolve to an existing path`);
  }
});

test("shared and renderer sources respect layer boundaries", () => {
  const sharedFiles = walk(path.join(SRC_ROOT, "shared"), (file) => /\.(?:js|mjs|ts)$/.test(file));
  for (const file of sharedFiles) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /require\(["']electron["']\)/, `${file} imports Electron`);
    assert.doesNotMatch(source, /\b(?:window|document)\s*[.[]/, `${file} depends on the DOM`);
    for (const request of relativeImports(source)) {
      const resolved = path.resolve(path.dirname(file), request);
      assert.ok(!resolved.startsWith(path.join(SRC_ROOT, "main") + path.sep), `${file} imports main: ${request}`);
      assert.ok(!resolved.startsWith(path.join(SRC_ROOT, "preload") + path.sep), `${file} imports preload: ${request}`);
      assert.ok(!resolved.startsWith(RENDERER_ROOT + path.sep), `${file} imports renderer: ${request}`);
    }
  }

  const rendererFiles = walk(RENDERER_ROOT, (file) => /\.(?:js|mjs|ts)$/.test(file));
  const nodeBuiltin = /require\(["'](?:node:)?(?:fs|path|os|child_process|worker_threads|net|tls|http|https)["']\)/;
  for (const file of rendererFiles) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, nodeBuiltin, `${file} imports a Node system module`);
    for (const request of relativeImports(source)) {
      const resolved = path.resolve(path.dirname(file), request);
      assert.ok(!resolved.startsWith(path.join(SRC_ROOT, "main") + path.sep), `${file} imports main: ${request}`);
      assert.ok(!resolved.startsWith(path.join(SRC_ROOT, "preload") + path.sep), `${file} imports preload: ${request}`);
    }
  }
});

test("renderer HTML references existing local assets", () => {
  for (const htmlFile of walk(RENDERER_ROOT, (file) => file.endsWith(".html"))) {
    const html = fs.readFileSync(htmlFile, "utf8");
    for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) {
      const target = match[1].split(/[?#]/, 1)[0];
      if (!target || /^(?:[a-z]+:|\/\/|#)/i.test(target)) continue;
      assert.ok(fs.existsSync(path.resolve(path.dirname(htmlFile), target)), `${htmlFile} references missing ${target}`);
    }
  }
});
