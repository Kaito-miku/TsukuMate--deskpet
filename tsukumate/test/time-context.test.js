"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { buildTimeContext } = require("../src/main/chat/time-context");

test("builds a trusted local time context in the requested time zone", () => {
  const context = buildTimeContext(new Date("2026-07-20T13:05:06.000Z"), "Asia/Shanghai");
  assert.match(context, /2026-07-20 21:05:06/);
  assert.match(context, /Monday/);
  assert.match(context, /Asia\/Shanghai/);
  assert.match(context, /^Trusted local time context:/);
});
