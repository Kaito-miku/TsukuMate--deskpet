"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseEmotionResponse,
  parseEmotionBlendResponse,
  extractAssistantText,
  inferEmotionFromText,
  inferEmotionBlendFromText,
  normalizeEmotionBlend,
} = require("../src/chat-emotion-classifier");

test("parses strict, fenced, direct, localized, and reasoning emotion responses", () => {
  assert.equal(parseEmotionResponse('{"emotion":"happy"}'), "happy");
  assert.equal(parseEmotionResponse('```json\n{"mood":"shy"}\n```'), "shy");
  assert.equal(parseEmotionResponse("surprised"), "surprised");
  assert.equal(parseEmotionResponse("情绪判断：轻微不满"), "annoyed");
  assert.equal(parseEmotionResponse("无法判断"), null);
  assert.equal(parseEmotionResponse(extractAssistantText({ choices: [{ message: { content: "", reasoning_content: "focused" } }] })), "focused");
});

test("multilingual heuristics distinguish representative user emotions", () => {
  assert.equal(inferEmotionFromText("今天终于成功了，我真的很开心"), "happy");
  assert.equal(inferEmotionFromText("你这样夸我，我都有点不好意思了"), "shy");
  assert.equal(inferEmotionFromText("刚才突然一声巨响，吓了我一跳"), "surprised");
  assert.equal(inferEmotionFromText("这个软件又崩溃了，真的烦死了"), "annoyed");
  assert.equal(inferEmotionFromText("我的手机刚刚被抢走了"), "surprised");
  assert.equal(inferEmotionFromText("今日は悲しいし、寂しい"), "sad");
  assert.equal(inferEmotionFromText("Please carefully analyze and debug this code"), "focused");
  assert.equal(inferEmotionFromText("我没有生气，只是普通地问一下"), null);
});

test("weighted lexicon covers positive, negative, and neutral task language", () => {
  assert.equal(inferEmotionFromText("你真的很棒，又专业又靠谱，谢谢你"), "happy");
  assert.equal(inferEmotionFromText("我喜欢你……这样说有点不好意思"), "shy");
  assert.equal(inferEmotionFromText("这个垃圾软件又卡顿又崩溃，太差劲了"), "annoyed");
  assert.equal(inferEmotionFromText("怎么办？？我的账号被锁了，很紧急"), "surprised");
  assert.equal(inferEmotionFromText("我真的很失望，算了吧，不想说了"), "sad");
  assert.equal(inferEmotionFromText("今天太累了，我想睡觉"), "sleepy");
  assert.equal(inferEmotionFromText("不对，请重新解释这个设置的更新步骤"), "focused");
  assert.equal(inferEmotionFromText("请显示当前状态、版本和进度"), "focused");
  assert.equal(inferEmotionFromText("今天是星期三"), null);
});

test("punctuation and emoji modify but do not overwhelm explicit emotion", () => {
  assert.equal(inferEmotionFromText("太好了！！我们成功了🎉"), "happy");
  assert.equal(inferEmotionFromText("怎么会这样？？？"), "surprised");
  assert.equal(inferEmotionFromText("我没有生气，只是想问设置在哪里"), "focused");
});

test("parses and normalizes compound API responses while preserving legacy labels", () => {
  const blend = parseEmotionBlendResponse('```json\n{"primary":"happy","secondary":"shy","primaryWeight":7,"secondaryWeight":3,"intensity":0.8}\n```');
  assert.equal(blend.primary, "happy");
  assert.equal(blend.secondary, "shy");
  assert.equal(blend.compoundName, "shy-joy");
  assert.equal(blend.primaryWeight, 0.7);
  assert.equal(blend.secondaryWeight, 0.3);
  assert.equal(blend.source, "api");
  assert.equal(parseEmotionBlendResponse('{"primary":"happy"'), null, "partial streamed JSON must not settle early");
  assert.deepEqual(parseEmotionBlendResponse("sad"), normalizeEmotionBlend("sad", "api"));
  assert.equal(normalizeEmotionBlend({ primary: "sad", secondary: "sad" }).secondary, undefined);
});

test("vector accumulation produces thresholded compound emotions and separate intensity", () => {
  const tiredJoy = inferEmotionBlendFromText("终于修好了，但真的累死了");
  assert.equal(tiredJoy.primary, "sleepy");
  assert.equal(tiredJoy.secondary, "happy");
  assert.ok(Math.abs(tiredJoy.primaryWeight + tiredJoy.secondaryWeight - 1) < 1e-9);

  const bittersweet = inferEmotionBlendFromText("谢谢你陪我，可我还是很难过");
  assert.equal(bittersweet.primary, "sad");
  assert.equal(bittersweet.secondary, "happy");
  assert.equal(bittersweet.compoundName, "bittersweet");

  const shyJoy = inferEmotionBlendFromText("见到你真开心，可是有点害羞");
  assert.equal(shyJoy.primary, "happy");
  assert.equal(shyJoy.secondary, "shy");
  assert.equal(shyJoy.compoundName, "shy-joy");

  assert.ok(inferEmotionBlendFromText("非常难过").intensity > inferEmotionBlendFromText("有点难过").intensity);
});

test("longest phrases, negation, task suppression, and English boundaries avoid false blends", () => {
  const notHappy = inferEmotionBlendFromText("不开心");
  assert.equal(notHappy.primary, "sad");
  assert.equal(notHappy.secondary, undefined);
  assert.equal(inferEmotionBlendFromText("没有生气").primary, "calm");
  assert.equal(inferEmotionBlendFromText("不对，请继续分析").primary, "focused");
  assert.equal(inferEmotionBlendFromText("supervisor").primary, "calm");
  assert.equal(inferEmotionBlendFromText("请修复这个垃圾 bug").secondary, undefined, "task words must not pollute an explicit affect");
});
