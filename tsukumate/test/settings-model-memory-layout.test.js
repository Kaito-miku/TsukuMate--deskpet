"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "src");
const read = (name) => fs.readFileSync(path.join(SRC, name), "utf8");

test("about page omits the legacy logo/tagline and links to the upstream project", () => {
  const about = read("settings-tab-about.js");
  const metadata = read("shared/product-metadata.js");
  assert.ok(!about.includes('className = "about-logo-wrap"'));
  assert.ok(!about.includes('t("aboutTagline")'));
  assert.ok(about.includes("safe.upstreamRepoUrl"));
  assert.ok(!metadata.includes("huggingface.co"));
  assert.ok(!metadata.includes("MODEL_REPO_URL"));
  assert.ok(metadata.includes('DEFAULT_UPSTREAM_LABEL = "MiniCPM-Desk-Pet"'));
  assert.ok(metadata.includes('DEFAULT_UPSTREAM_URL = "https://github.com/OpenBMB/"'));
});

test("model connections and chat memory are separate direct sidebar pages", () => {
  const renderer = read("settings-renderer.js");
  const api = read("settings-tab-api.js");
  const memory = read("settings-tab-memory.js");
  const html = read("settings.html");
  assert.match(renderer, /\{ id: "api", label: "模型连接"/);
  assert.match(renderer, /\{ id: "memory", label: "聊天与记忆"/);
  assert.ok(!renderer.includes("modelGroup:"));
  assert.ok(!api.includes("聊天与记忆"));
  assert.ok(memory.includes("core.tabs.memory"));
  assert.ok(html.includes('src="settings-tab-memory.js"'));
});

test("Live2D updates patch in place so slider drags do not reset scroll", () => {
  const live2d = read("settings-tab-live2d.js");
  assert.ok(live2d.includes("patchInPlace"));
  assert.ok(live2d.includes('hasOwnProperty.call(changes, "live2d")'));
});
