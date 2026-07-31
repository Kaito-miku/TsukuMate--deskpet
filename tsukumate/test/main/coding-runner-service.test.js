"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createCodingRunnerService, normalizeOutput } = require("../../src/main/chat/coding-runner-service");

test("coding runner executes Python with controlled standard input", async () => {
  const runner = createCodingRunnerService();
  const result = await runner.run({ key: "python-test", language: "python", code: "a, b = map(int, input().split())\nprint(a + b)\n", input: "2 3\n" });
  assert.equal(result.ok, true);
  assert.equal(normalizeOutput(result.stdout), "5");
});

test("coding runner rejects unsupported languages and oversized input", async () => {
  const runner = createCodingRunnerService();
  assert.equal((await runner.run({ key: "bad", language: "shell", code: "", input: "" })).ok, false);
  assert.match((await runner.run({ key: "large", language: "python", code: "print(1)", input: "x".repeat(70 * 1024) })).error, /64 KB/);
});
