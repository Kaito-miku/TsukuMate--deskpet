"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createCodingOjService } = require("../../src/main/chat/coding-oj-service");

test("OJ service accepts only its public source hosts", async () => {
  const service = createCodingOjService({ fetchImpl: async () => { throw new Error("unexpected fetch"); } });
  await assert.rejects(() => service.importProblem("https://example.com/problem/1"), /只支持/);
});

test("OJ service resolves known problem identifiers without untrusted URLs", async () => {
  const service = createCodingOjService({ fetchImpl: async () => ({ json: async () => ({ result: { problems: [] } }) }) });
  const result = await service.search("P1001", "luogu");
  assert.equal(result.length, 1);
  assert.equal(result[0].source, "luogu");
  assert.match(result[0].url, /luogu\.com\.cn/);
});
