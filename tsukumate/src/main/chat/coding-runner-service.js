"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const LANGUAGES = new Set(["cpp", "python"]);
const MAX_CODE_BYTES = 200 * 1024;
const MAX_INPUT_BYTES = 64 * 1024;
const MAX_OUTPUT_BYTES = 256 * 1024;
const COMPILE_TIMEOUT_MS = 12_000;
const RUN_TIMEOUT_MS = 4_000;

function clean(value, max) { return String(value || "").slice(0, max); }
function normalizeOutput(value) { return String(value || "").replace(/\r\n/g, "\n").replace(/[ \t]+(?=\n)/g, "").trimEnd(); }
function executableCandidates() { return process.platform === "win32" ? ["g++", "clang++"] : ["c++", "g++", "clang++"]; }

function createCodingRunnerService() {
  const active = new Map();
  function kill(child) {
    if (!child || child.killed) return;
    try { if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGKILL"); else child.kill("SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} }
  }
  function runProcess(command, args, input, timeoutMs, cwd, key) {
    return new Promise((resolve) => {
      let stdout = ""; let stderr = ""; let timedOut = false; let outputLimited = false;
      let child;
      try { child = spawn(command, args, { cwd, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"], windowsHide: true }); }
      catch (error) { resolve({ ok: false, error: `无法启动工具链：${error.message}` }); return; }
      active.set(key, child);
      const timer = setTimeout(() => { timedOut = true; kill(child); }, timeoutMs);
      const append = (field, chunk) => {
        const text = chunk.toString("utf8");
        if ((stdout.length + stderr.length + text.length) > MAX_OUTPUT_BYTES) { outputLimited = true; kill(child); return; }
        if (field === "stdout") stdout += text; else stderr += text;
      };
      child.stdout.on("data", (chunk) => append("stdout", chunk)); child.stderr.on("data", (chunk) => append("stderr", chunk));
      child.on("error", (error) => { clearTimeout(timer); if (active.get(key) === child) active.delete(key); resolve({ ok: false, error: `工具链不可用：${error.message}`, stdout, stderr }); });
      child.on("close", (exitCode, signal) => { clearTimeout(timer); if (active.get(key) === child) active.delete(key); resolve({ ok: !timedOut && !outputLimited && exitCode === 0, exitCode, signal, timedOut, outputLimited, stdout, stderr }); });
      child.stdin.on("error", () => {}); child.stdin.end(input);
    });
  }
  async function run({ key, language, code, input }) {
    if (!LANGUAGES.has(language)) return { ok: false, error: "仅支持 C++17 或 Python 3" };
    if (Buffer.byteLength(code || "", "utf8") > MAX_CODE_BYTES) return { ok: false, error: "代码不能超过 200 KB" };
    if (Buffer.byteLength(input || "", "utf8") > MAX_INPUT_BYTES) return { ok: false, error: "标准输入不能超过 64 KB" };
    if (active.has(key)) return { ok: false, error: "该题已有代码正在运行" };
    const startedAt = Date.now(); const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tsukumate-judge-"));
    try {
      if (language === "python") {
        const source = path.join(directory, "main.py"); fs.writeFileSync(source, clean(code, MAX_CODE_BYTES), "utf8");
        const result = await runProcess(process.platform === "win32" ? "python" : "python3", [source], clean(input, MAX_INPUT_BYTES), RUN_TIMEOUT_MS, directory, key);
        return { ...result, phase: "run", durationMs: Date.now() - startedAt, stdout: clean(result.stdout, MAX_OUTPUT_BYTES), stderr: clean(result.stderr, MAX_OUTPUT_BYTES) };
      }
      const source = path.join(directory, "main.cpp"); const output = path.join(directory, process.platform === "win32" ? "main.exe" : "main"); fs.writeFileSync(source, clean(code, MAX_CODE_BYTES), "utf8");
      let compile = null;
      for (const compiler of executableCandidates()) { compile = await runProcess(compiler, ["-std=c++17", "-O2", "-pipe", source, "-o", output], "", COMPILE_TIMEOUT_MS, directory, `${key}:compile`); if (compile.ok || !/ENOENT|not found|工具链不可用/i.test(`${compile.error || ""}${compile.stderr || ""}`)) break; }
      if (!compile?.ok) return { ...compile, ok: false, phase: "compile", durationMs: Date.now() - startedAt, error: compile?.timedOut ? "编译超时" : (compile?.stderr || compile?.error || "C++17 编译失败") };
      const result = await runProcess(output, [], clean(input, MAX_INPUT_BYTES), RUN_TIMEOUT_MS, directory, key);
      return { ...result, phase: "run", durationMs: Date.now() - startedAt, stdout: clean(result.stdout, MAX_OUTPUT_BYTES), stderr: clean(result.stderr, MAX_OUTPUT_BYTES) };
    } finally { active.delete(key); try { fs.rmSync(directory, { recursive: true, force: true }); } catch {} }
  }
  function cancel(key) { const child = active.get(key); if (!child) return false; kill(child); return true; }
  return { run, cancel, normalizeOutput, LANGUAGES };
}

module.exports = { createCodingRunnerService, normalizeOutput, LANGUAGES, MAX_CODE_BYTES, MAX_INPUT_BYTES, MAX_OUTPUT_BYTES };
