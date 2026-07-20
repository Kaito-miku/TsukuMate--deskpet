"use strict";

const { test, describe, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { validateConfig, requestJson, makeChatBody } = require("../src/openai-compatible-transport");

let server;
afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  server = null;
});

function listen(handler) {
  return new Promise((resolve) => {
    server = http.createServer(handler).listen(0, "127.0.0.1", () => {
      resolve(`http://127.0.0.1:${server.address().port}/v1/chat/completions`);
    });
  });
}

describe("OpenAI-compatible transport", () => {
  test("validates a complete endpoint and model", () => {
    assert.throws(() => validateConfig({ endpoint: "/v1/chat/completions", model: "x" }), /complete/);
    assert.throws(() => validateConfig({ endpoint: "https://example.test", model: "" }), /Model/);
    assert.equal(validateConfig({ endpoint: "https://example.test/v1/chat/completions", model: "x" }).model, "x");
  });

  test("sends standard fields and parses content plus reasoning SSE", async () => {
    let received;
    const endpoint = await listen((req, res) => {
      let raw = "";
      req.on("data", (c) => { raw += c; });
      req.on("end", () => {
        received = { auth: req.headers.authorization, body: JSON.parse(raw) };
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.write('data: {"choices":[{"delta":{"reasoning_content":"think"}}]}\n\n');
        res.write('data: {"choices":[{"delta":{"content":"answer"}}]}\n\n');
        res.end("data: [DONE]\n\n");
      });
    });
    const events = [];
    await requestJson({
      endpoint, apiKey: "secret-token",
      body: makeChatBody({ model: "remote-model", messages: [{ role: "user", content: "hi" }], stream: true, maxTokens: 12 }),
      onEvent: (event) => events.push(event),
    });
    assert.equal(received.auth, "Bearer secret-token");
    assert.deepEqual(received.body, {
      model: "remote-model", messages: [{ role: "user", content: "hi" }], stream: true,
      max_tokens: 12, temperature: 0.6, top_p: 0.95,
    });
    assert.deepEqual(events, [{ event: "think", content: "think" }, { event: "delta", content: "answer" }]);
  });

  test("returns provider errors without including the authorization token", async () => {
    const endpoint = await listen((_req, res) => {
      res.writeHead(401, { "content-type": "application/json" });
      res.end('{"error":{"message":"invalid key"}}');
    });
    await assert.rejects(
      () => requestJson({ endpoint, apiKey: "never-leak", body: makeChatBody({ model: "x", messages: [], stream: false }) }),
      (err) => err.message === "invalid key" && !err.message.includes("never-leak"),
    );
  });
});
