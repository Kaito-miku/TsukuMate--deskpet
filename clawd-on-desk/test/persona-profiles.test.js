"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { normalizeProfiles, selectActiveProfile } = require("../src/persona-profiles");

test("seeds selectable default and Miku persona profiles", () => {
  const profiles = normalizeProfiles(null);
  assert.deepStrictEqual(profiles.map((item) => item.id), ["default", "nakano-miku"]);
  assert.strictEqual(selectActiveProfile(profiles, "nakano-miku").name, "中野三玖");
});

test("normalizes profile inputs and keeps a valid active persona", () => {
  const profiles = normalizeProfiles([{ id: "study", name: "学习", prompt: "Explain clearly." }]);
  assert.deepStrictEqual(selectActiveProfile(profiles, "missing"), profiles[0]);
  assert.deepStrictEqual(profiles, [{ id: "study", name: "学习", prompt: "Explain clearly." }]);
});

test("keeps a legacy API persona as a selectable migration profile", () => {
  const profiles = normalizeProfiles(null, "Existing custom prompt");
  assert.strictEqual(profiles[0].id, "legacy");
  assert.strictEqual(profiles[0].prompt, "Existing custom prompt");
});
