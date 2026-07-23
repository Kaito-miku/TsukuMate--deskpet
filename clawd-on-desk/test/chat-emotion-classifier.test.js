"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseEmotionResponse, extractAssistantText, inferEmotionFromText } = require("../src/chat-emotion-classifier");

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
