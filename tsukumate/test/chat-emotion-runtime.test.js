"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createEmotionRuntime, normalizeMoodDurationMinutes } = require("../src/shared/emotion/chat-emotion-runtime");
const { inferEmotionBlendFromText, inferMoodActionFromText, parseEmotionDecisionResponse } = require("../src/shared/emotion/chat-emotion-classifier");

function fixture(minutes = 15) {
  let time = 1_000_000;
  const runtime = createEmotionRuntime({
    now: () => time,
    moodDurationMinutes: minutes,
    setTimeout: () => ({ fake: true }),
    clearTimeout: () => {},
  });
  return { runtime, now: () => time, advance: (ms) => { time += ms; } };
}

test("instant reaction expires after six seconds and reveals the lasting mood", () => {
  const f = fixture();
  let state = f.runtime.apply({ eventId: "one", blend: { primary: "sad", intensity: 0.8 }, moodAction: "establish" });
  assert.equal(state.activeLayer, "reaction");
  assert.equal(state.reaction.blend.primary, "sad");
  assert.equal(state.mood.blend.primary, "sad");
  const expiry = state.mood.expiresAt;
  f.advance(6001);
  state = f.runtime.snapshot();
  assert.equal(state.reaction, null);
  assert.equal(state.activeLayer, "mood");
  assert.equal(state.display.primary, "sad");
  assert.equal(state.mood.expiresAt, expiry);
});

test("a new instant emotion preserves the old mood and its original deadline by default", () => {
  const f = fixture();
  let state = f.runtime.apply({ eventId: "sad", blend: { primary: "sad", intensity: 0.8 }, moodAction: "establish" });
  const expiry = state.mood.expiresAt;
  f.advance(7000);
  state = f.runtime.apply({ eventId: "happy", blend: { primary: "happy", intensity: 0.9 }, moodAction: "preserve" });
  assert.equal(state.reaction.blend.primary, "happy");
  assert.equal(state.mood.blend.primary, "sad");
  assert.equal(state.mood.expiresAt, expiry);
});

test("resolve clears lasting mood without cancelling the current reaction", () => {
  const f = fixture();
  f.runtime.apply({ eventId: "sad", blend: { primary: "sad", intensity: 0.8 }, moodAction: "establish" });
  f.advance(7000);
  let state = f.runtime.apply({ eventId: "better", blend: { primary: "happy", intensity: 0.7 }, moodAction: "resolve" });
  assert.equal(state.activeLayer, "reaction");
  assert.equal(state.reaction.blend.primary, "happy");
  assert.equal(state.mood.blend.primary, "calm");
  f.advance(6001);
  state = f.runtime.snapshot();
  assert.equal(state.activeLayer, "calm");
});

test("ease lowers intensity without refreshing the deadline", () => {
  const f = fixture();
  let state = f.runtime.apply({ eventId: "sad", blend: { primary: "sad", intensity: 1 }, moodAction: "establish" });
  const expiry = state.mood.expiresAt;
  f.advance(1000);
  state = f.runtime.apply({ eventId: "ease", blend: "happy", moodAction: "ease" });
  assert.equal(state.mood.blend.primary, "sad");
  assert.equal(state.mood.blend.intensity, 0.45);
  assert.equal(state.mood.expiresAt, expiry);
});

test("API correction replaces the same event instead of accumulating twice", () => {
  const f = fixture();
  f.runtime.apply({ eventId: "same", blend: "sad", moodAction: "establish" });
  const state = f.runtime.apply({ eventId: "same", blend: "happy", moodAction: "preserve" });
  assert.equal(f.runtime.eventCount, 1);
  assert.equal(state.reaction.blend.primary, "happy");
  assert.equal(state.mood.blend.primary, "calm");
});

test("duration accepts only the four persisted choices and expires exactly", () => {
  assert.equal(normalizeMoodDurationMinutes(5), 5);
  assert.equal(normalizeMoodDurationMinutes(30), 30);
  assert.equal(normalizeMoodDurationMinutes(22), 15);
  const f = fixture(5);
  f.runtime.apply({ eventId: "mood", blend: "shy", moodAction: "establish" });
  f.advance(5 * 60 * 1000 + 1);
  assert.equal(f.runtime.snapshot().mood.blend.primary, "calm");
});

test("local mood fallback resolves only explicit recovery phrases", () => {
  assert.equal(inferMoodActionFromText("我好多了，谢谢你安慰我", inferEmotionBlendFromText("我好多了，谢谢你安慰我")), "resolve");
  assert.equal(inferMoodActionFromText("只是稍微好一点了", inferEmotionBlendFromText("只是稍微好一点了")), "ease");
  assert.equal(inferMoodActionFromText("我还没好，还是很难过", inferEmotionBlendFromText("我还没好，还是很难过")), "preserve");
});

test("API decision parsing validates mood actions and defaults invalid values to preserve", () => {
  const resolved = parseEmotionDecisionResponse('{"primary":"happy","primaryWeight":1,"secondaryWeight":0,"intensity":0.8,"moodAction":"resolve"}');
  assert.equal(resolved.blend.primary, "happy");
  assert.equal(resolved.moodAction, "resolve");
  const invalid = parseEmotionDecisionResponse('{"primary":"sad","moodAction":"delete_everything"}');
  assert.equal(invalid.moodAction, "preserve");
});
