"use strict";

// A deliberately small OpenAI Chat Completions client. Keeping this outside
// the renderer means API keys never enter Chromium or renderer DevTools.
const http = require("http");
const https = require("https");
const { createProxyAgent } = require("./proxy-agent");

function validateConfig(input) {
  const endpoint = String(input && input.endpoint || "").trim();
  const model = String(input && input.model || "").trim();
  if (!endpoint) throw new Error("API endpoint is required");
  if (!model) throw new Error("Model name is required");
  let url;
  try { url = new URL(endpoint); } catch { throw new Error("API endpoint must be a complete http(s) URL"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("API endpoint must use http or https");
  }
  return { endpoint: url.toString(), model };
}

function responseError(status, raw) {
  let message = `API request failed (HTTP ${status})`;
  try {
    const parsed = JSON.parse(raw || "{}");
    if (parsed && parsed.error && parsed.error.message) message = String(parsed.error.message);
  } catch {}
  return new Error(message);
}

function requestJson({ endpoint, apiKey, body, signal, timeoutMs = 30000, onEvent }) {
  const url = new URL(endpoint);
  const client = url.protocol === "https:" ? https : http;
  // Match the rest of the app's network behavior: macOS system proxy and
  // HTTPS_PROXY / ALL_PROXY are honored for remote model requests. Never
  // proxy local test servers or sidecar traffic.
  const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  const agent = isLoopback ? undefined : createProxyAgent(endpoint);
  const encoded = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(encoded),
      "Accept": body.stream ? "text/event-stream" : "application/json",
    };
    if (typeof apiKey === "string" && apiKey.trim()) {
      headers.Authorization = `Bearer ${apiKey.trim()}`;
    }
    const req = client.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "POST",
      agent,
      headers,
    }, (res) => {
      let raw = "";
      if ((res.statusCode || 0) < 200 || (res.statusCode || 0) >= 300) {
        res.setEncoding("utf8");
        res.on("data", (chunk) => { raw += chunk; });
        res.on("end", () => finish(reject, responseError(res.statusCode || 0, raw)));
        return;
      }
      res.setEncoding("utf8");
      if (!body.stream) {
        res.on("data", (chunk) => { raw += chunk; });
        res.on("end", () => {
          try { finish(resolve, JSON.parse(raw || "{}")); }
          catch { finish(reject, new Error("API returned invalid JSON")); }
        });
        return;
      }
      let buffer = "";
      res.on("data", (chunk) => {
        buffer += chunk.replace(/\r\n/g, "\n");
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
          if (!data || data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
            if (!delta) continue;
            if (delta.reasoning_content) onEvent && onEvent({ event: "think", content: String(delta.reasoning_content) });
            if (delta.content) onEvent && onEvent({ event: "delta", content: String(delta.content) });
          } catch { /* Ignore provider keepalive/malformed SSE frames. */ }
        }
      });
      res.on("end", () => finish(resolve, { ok: true }));
    });
    req.on("error", (err) => finish(reject, err));
    req.setTimeout(timeoutMs, () => req.destroy(new Error("API request timed out")));
    if (signal) {
      if (signal.aborted) req.destroy(new Error("Request cancelled"));
      signal.addEventListener("abort", () => req.destroy(new Error("Request cancelled")), { once: true });
    }
    req.write(encoded);
    req.end();
  });
}

function makeChatBody({ model, messages, stream, system, maxTokens, temperature, topP }) {
  const normalized = Array.isArray(messages) ? messages.slice() : [];
  if (system) normalized.unshift({ role: "system", content: String(system) });
  return {
    model,
    messages: normalized,
    stream: !!stream,
    max_tokens: Math.max(1, Math.floor(Number(maxTokens) || 768)),
    temperature: typeof temperature === "number" ? temperature : 0.6,
    top_p: typeof topP === "number" ? topP : 0.95,
  };
}

module.exports = { validateConfig, requestJson, makeChatBody };
