"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRichStudyCards, studyCardMode, MAX_CARDS } = require("../../src/shared/chat/rich-study-card");

test("study cards require the exact complete fence and keep ordinary text", () => {
  const parsed = parseRichStudyCards("普通解释\n```tsukumate-study-card\n<style>.a{color:red}</style><section class=a>卡片</section>\n```");
  assert.equal(parsed.content, "普通解释"); assert.equal(parsed.richCards.length, 1);
  assert.match(parsed.richCards[0].css, /color:red/); assert.match(parsed.richCards[0].html, /section/);
  assert.equal(parseRichStudyCards("```html\n<section>x</section>\n```").richCards.length, 0);
  assert.equal(parseRichStudyCards("```tsukumate-study-card\n<section>x</section>").richCards.length, 0);
});

test("study card count and user overrides are bounded", () => {
  const block = "```tsukumate-study-card\n<section>x</section>\n```";
  assert.equal(parseRichStudyCards(Array(5).fill(block).join("\n")).richCards.length, MAX_CARDS);
  assert.equal(studyCardMode("请用卡片展示"), "force");
  assert.equal(studyCardMode("不要气泡，纯文字"), "off");
  assert.equal(studyCardMode("请解释牛顿定律"), "auto");
});
