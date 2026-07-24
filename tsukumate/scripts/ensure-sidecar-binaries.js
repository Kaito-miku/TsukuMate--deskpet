"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { TARGETS, fetchSidecarBinaries } = require("./fetch-sidecar-binaries");

const DEFAULT_PREFLIGHT_REQUEST_TIMEOUT_MS = 15000;

function runtimeSidecarTarget({ platform = process.platform, arch = process.arch } = {}) {
  const normalizedPlatform = platform === "win32" ? "windows" : platform;
  return TARGETS.find((target) => target.platform === normalizedPlatform && target.arch === arch) || null;
}

function resolveOverridePath(value, options = {}) {
  const fsApi = options.fs || fs;
  const platform = options.platform || process.platform;
  const exe = platform === "win32" ? "cc-connect-clawd.exe" : "cc-connect-clawd";
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    if (fsApi.statSync(raw).isDirectory()) return path.join(raw, exe);
  } catch {}
  if (raw.endsWith("/") || raw.endsWith("\\")) return path.join(raw, exe);
  return raw;
}

function sidecarFetchCommand(targetDir) {
  return `npm run fetch:sidecars -- --target ${targetDir}`;
}

async function ensureCurrentPlatformSidecar(options = {}) {
  const env = options.env || process.env;
  const fsApi = options.fs || fs;
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;
  if (env.CLAWD_SKIP_SIDECAR_FETCH === "1") return { ok: true, skipped: true, reason: "env-skip" };

  if (env.CLAWD_CC_CONNECT_CLAWD_PATH) {
    const overridePath = resolveOverridePath(env.CLAWD_CC_CONNECT_CLAWD_PATH, { fs: fsApi, platform: options.platform });
    if (fsApi.existsSync(overridePath)) return { ok: true, skipped: true, reason: "override-path", path: overridePath };
    stderr.write(`CLAWD_CC_CONNECT_CLAWD_PATH is set but no sidecar executable was found at ${overridePath}. ${options.strict ? "Strict mode will stop launch." : "Clawd will still launch."}\n`);
    return { ok: false, skipped: true, reason: "override-path-missing", path: overridePath };
  }

  const target = runtimeSidecarTarget(options);
  if (!target) return { ok: true, skipped: true, reason: "unsupported-platform" };
  const rootDir = options.rootDir || path.join(__dirname, "..");
  const binaryPath = path.join(rootDir, "bin", "cc-connect-clawd", target.dir, target.exe);
  try {
    if (fsApi.existsSync(binaryPath) && fsApi.statSync(binaryPath).isFile()) {
      return { ok: true, existing: true, target: target.dir };
    }
  } catch {}

  stdout.write(`TsukuMate is fetching pinned binary for ${target.dir}...\n`);
  const fetchImpl = options.fetchSidecarBinaries || fetchSidecarBinaries;
  try {
    await fetchImpl({ target: target.dir, rootDir, requestTimeoutMs: DEFAULT_PREFLIGHT_REQUEST_TIMEOUT_MS });
    return { ok: true, fetched: true, target: target.dir };
  } catch (error) {
    const command = sidecarFetchCommand(target.dir);
    stderr.write(`The sidecar could not be fetched automatically: ${error.message}. Run ${command}. Set CLAWD_SKIP_SIDECAR_FETCH=1 before running npm start to skip this check.\n`);
    return { ok: false, target: target.dir, command, error: error.message };
  }
}

module.exports = {
  DEFAULT_PREFLIGHT_REQUEST_TIMEOUT_MS,
  runtimeSidecarTarget,
  resolveOverridePath,
  sidecarFetchCommand,
  ensureCurrentPlatformSidecar,
};
