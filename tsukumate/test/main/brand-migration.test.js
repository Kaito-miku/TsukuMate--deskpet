"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { migrateLegacyUserData } = require("../../src/main/core/brand-migration");

test("TsukuMate migrates durable legacy data once without overwriting new data", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-migration-"));
  const legacy = path.join(root, "MiniCPM Desk Pet");
  const current = path.join(root, "TsukuMate");
  fs.mkdirSync(path.join(legacy, "chat-history"), { recursive: true });
  fs.mkdirSync(current, { recursive: true });
  fs.writeFileSync(path.join(legacy, "minicpm-prefs.json"), "legacy");
  fs.writeFileSync(path.join(legacy, "chat-history", "day.jsonl"), "history");
  fs.writeFileSync(path.join(current, "minicpm-prefs.json"), "current");

  const first = migrateLegacyUserData({ appDataDir: root, userDataDir: current });
  assert.equal(first.migrated, true);
  assert.equal(fs.readFileSync(path.join(current, "minicpm-prefs.json"), "utf8"), "current");
  assert.equal(fs.readFileSync(path.join(current, "chat-history", "day.jsonl"), "utf8"), "history");
  assert.equal(fs.existsSync(path.join(current, ".tsukumate-migration-v1.json")), true);

  fs.writeFileSync(path.join(legacy, "chat-history", "later.jsonl"), "later");
  const second = migrateLegacyUserData({ appDataDir: root, userDataDir: current });
  assert.equal(second.reason, "already-complete");
  assert.equal(fs.existsSync(path.join(current, "chat-history", "later.jsonl")), false);
  fs.rmSync(root, { recursive: true, force: true });
});
