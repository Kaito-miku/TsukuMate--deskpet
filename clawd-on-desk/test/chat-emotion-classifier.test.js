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
