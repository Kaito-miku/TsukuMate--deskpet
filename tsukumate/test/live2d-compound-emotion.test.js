"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const src = (name) => fs.readFileSync(path.join(__dirname, "..", "src", name), "utf8");

test("Cubism 5 uses the primary motion and a weighted Soullink VAD target", () => {
  const renderer = src("renderer/shared/live2d/live2d-cubism5-renderer.ts");
  assert.match(renderer, /emotionVADPresets/);
  assert.match(renderer, /primary\.valence \* blend\.primaryWeight \+ secondary\.valence \* blend\.secondaryWeight/);
  assert.match(renderer, /\{ vadTarget: blendedVAD\(blend\) \}/);
  assert.match(renderer, /motionByEmotion\[emotion\]/, "only the primary emotion selects a native motion");
  assert.match(renderer, /stateEmotion\[currentState\] \|\| latestChatBlend/, "idle restores the latest conversational blend");
  assert.match(renderer, /if \(!stateEmotion\[currentState\]\) setEmotion\(latestChatBlend, latestChatLayer === "reaction"\)/, "chat emotion cannot interrupt a system state");
  assert.match(renderer, /next\.display \? next\.display : next/, "renderer accepts the layered emotion snapshot");
  assert.match(renderer, /playNativeMotion && motionByEmotion\[emotion\]/, "lasting mood changes do not replay native reaction motions");
});

test("legacy Live2D renderer accepts object blends and restores them after system states", () => {
  const renderer = src("renderer/shared/live2d/live2d-renderer.js");
  assert.match(renderer, /function normalizeBlend/);
  assert.match(renderer, /function blendVAD/);
  assert.match(renderer, /STATE_EMOTION\[currentState\] \|\| latestChatBlend/);
  assert.match(renderer, /if \(!STATE_EMOTION\[currentState\]\) triggerEmotion\(latestChatBlend\)/);
  assert.match(renderer, /vadTarget: blendVAD\(blend\)/);
});

test("state keeps object blends but resolves sprite assets through the primary emotion", () => {
  const state = src("main/core/state.js");
  assert.match(state, /emotion: state === "idle" \? chatEmotionRuntime\.snapshot\(\)\.display\.primary : null/);
  assert.match(state, /createEmotionRuntime/);
  assert.match(state, /sendToRenderer\("chat-emotion", snapshot\)/);
});
