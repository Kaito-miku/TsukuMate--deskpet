"use strict";
//
// MiniCPM Chat — a single bubble window that lives next to the pet and acts
// like a speech / thought balloon. Click pet → input bubble pops up; press
// Enter → bubble vanishes while the pet does its thinking animation; once the
// model starts replying, the bubble reappears with the streamed text and
// fades out a few seconds after the reply finishes.
//
// The window is created lazily on first open and then *hidden* on dismiss —
// the renderer keeps the in-memory conversation history across opens.
//
// Layout assumption:
//   <repo-root>/clawd-on-desk        ← this Electron app
//   <repo-root>/minicpm-sidecar      ← llama.cpp-backed sidecar
//                                       (gateway/ FastAPI + llama-server)
//   <userData>/models/*.gguf         ← GGUF weights downloaded by Onboarding
//
// Override locations via env:
//   MINICPM_SIDECAR_BIN  — point at a prebuilt gateway binary
//   MINICPM_SIDECAR_DIR  — point at the minicpm-sidecar source tree (dev)
//   MINICPM_PYTHON       — explicit Python interpreter (dev fallback)
//
// Historical note: this used to spawn a PyTorch sidecar via conda / uv.
// That stack was retired in v0.8 in favour of llama.cpp; the new sidecar
// has no torch / transformers / peft dependency and ships as a single
// binary per platform alongside llama-server.

const { BrowserWindow, ipcMain, screen, shell, Menu, app, safeStorage, desktopCapturer, systemPreferences } = require("electron");
const { spawn, execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { PRELOAD_ROOT } = require("./main/paths");
const { validateConfig: validateApiConfig, requestJson: requestOpenAi, makeChatBody } = require("./openai-compatible-transport");
const { runAppleMusicCommand } = require("./apple-music-control");
const { buildTimeContext } = require("./time-context");
const { normalizeProfiles, selectActiveProfile } = require("./persona-profiles");
const { createScreenCaptureService } = require("./screen-capture");
const { parseHistoryLines, paginateHistoryLines } = require("./shared/chat/chat-history-page");
const {
  EMOTIONS,
  normalizeEmotionBlend,
  parseEmotionDecisionResponse,
  inferEmotionBlendFromText,
  inferMoodActionFromText,
} = require("./shared/emotion/chat-emotion-classifier");
const { normalizeMoodDurationMinutes } = require("./shared/emotion/chat-emotion-runtime");

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";
const isLinux = process.platform === "linux";
const WIN_TOPMOST_LEVEL = "pop-up-menu";
const LINUX_WINDOW_TYPE = "splash";

// Port chosen to dodge common collisions on dev machines: 8765 is used
// by Apache CouchDB tests, Bitcoin Cash testnet, and a few other tools.
// 18765 ("1" prefix on the old default) is unassigned by IANA and easy
// to remember. Override via MINICPM_PORT env if you need something else.
const DEFAULT_PORT = 18765;
const DEFAULT_HOST = "127.0.0.1";
const BUBBLE_GAP = 3;   // pixels between visible pet sprite and bubble
const EDGE_MARGIN = 8;

const ASK_WIDTH = 120;       // initial empty-input width — tiny pill
const ASK_HEIGHT = 44;
const SPEAK_MAX_WIDTH = 360;
const SPEAK_MAX_HEIGHT = 360;
const MIN_WIDTH = 100;
const MIN_HEIGHT = 40;

// ── locate sidecar binary / dev sources / Python interpreter ───────────────
//
// Two runtime modes, in priority order:
//   A. Packaged app   → bundled binary at <resourcesPath>/sidecar-bin/
//                         minicpm-sidecar(.exe)   ← PyInstaller gateway
//                         llama-server(.exe)      ← llama.cpp build product
//                       (the only path real users ever hit)
//   B. Dev with venv  → minicpm-sidecar/.venv/bin/python -m gateway
//                       (created by `uv sync` inside minicpm-sidecar/)
//
// MINICPM_SIDECAR_BIN / MINICPM_SIDECAR_DIR / MINICPM_PYTHON env vars
// override every mode for local debugging.

function locateSidecarBinary(appRoot) {
  const override = process.env.MINICPM_SIDECAR_BIN;
  if (override && fs.existsSync(override)) return path.resolve(override);
  const ext = process.platform === "win32" ? ".exe" : "";
  if (app && app.isPackaged) {
    // electron-builder puts the binary under
    //   <Contents>/Resources/sidecar-bin/         (macOS .app bundle)
    //   <install>/resources/sidecar-bin/          (Windows / Linux)
    const candidates = [
      path.join(process.resourcesPath, "sidecar-bin", "minicpm-sidecar" + ext),
      path.join(process.resourcesPath, "sidecar-bin", "minicpm-sidecar", "minicpm-sidecar" + ext),
    ];
    for (const c of candidates) {
      try { if (fs.statSync(c).isFile()) return c; } catch {}
    }
  }
  // Dev convenience: scripts/build-gateway.sh emits binaries under
  //   <repo>/minicpm-sidecar/bin/<os>-<arch>/minicpm-sidecar
  // so devs can dogfood the production codepath without rebuilding
  // electron-builder every time.
  const triple = triplet();
  const devBin = path.join(appRoot, "..", "minicpm-sidecar", "bin", triple, "minicpm-sidecar" + ext);
  try { if (fs.statSync(devBin).isFile()) return devBin; } catch {}
  return null;
}

function locateSidecarSourceDir(appRoot) {
  const override = process.env.MINICPM_SIDECAR_DIR;
  if (override) {
    try {
      if (fs.statSync(path.join(override, "gateway", "__main__.py")).isFile()) {
        return path.resolve(override);
      }
    } catch {}
  }
  const candidates = [];
  if (app && app.isPackaged) {
    // Packaged builds ship the source next to the binary so a dev
    // override at MINICPM_PYTHON still has somewhere to point at.
    candidates.push(path.join(process.resourcesPath, "minicpm-sidecar"));
  }
  candidates.push(path.join(appRoot, "..", "minicpm-sidecar"));
  for (const c of candidates) {
    try {
      if (fs.statSync(path.join(c, "gateway", "__main__.py")).isFile()) {
        return path.resolve(c);
      }
    } catch {}
  }
  return null;
}

function locatePython(sidecarDir) {
  // 1. Explicit override always wins.
  const explicit = process.env.MINICPM_PYTHON;
  if (explicit && fs.existsSync(explicit)) return explicit;

  if (!sidecarDir) return null;
  const venvCandidates = [
    path.join(sidecarDir, ".venv", "bin", "python"),
    path.join(sidecarDir, ".venv", "bin", "python3"),
    path.join(sidecarDir, ".venv", "Scripts", "python.exe"),
  ];
  for (const p of venvCandidates) {
    try { if (fs.statSync(p).isFile()) return p; } catch {}
  }
  return null;
}

function triplet() {
  // Matches electron-builder's `${os}-${arch}` expansion so extraResources
  // paths and our dev bin/<triple>/ layout line up.
  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "x64" : process.arch;
  if (process.platform === "darwin") return "mac-"   + arch;
  if (process.platform === "win32")  return "win-"   + arch;
  if (process.platform === "linux")  return "linux-" + arch;
  return process.platform + "-" + arch;
}

// ── Adapter manifest pure helpers ──────────────────────────────────────
//
// These work on plain JS objects with no IO so they're easy to unit-test
// without mocking Electron's `app`. The closure-level wrappers inside
// `initMinicpmChat` do the actual fs reads / writes and call into here.

function parseManifestJson(text) {
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.items)) {
      return { version: 1, items: [] };
    }
    return {
      version: Number(raw.version) || 1,
      items: raw.items.filter((it) => it && typeof it === "object"),
    };
  } catch {
    return { version: 1, items: [] };
  }
}

function manifestUpsertItem(items, entry) {
  if (!entry || !entry.id) return Array.isArray(items) ? items.slice() : [];
  const out = Array.isArray(items) ? items.slice() : [];
  const idx = out.findIndex((it) => it && it.id === entry.id);
  if (idx >= 0) {
    out[idx] = { ...out[idx], ...entry };
  } else {
    out.push({ createdAt: new Date().toISOString(), ...entry });
  }
  return out;
}

function manifestRemoveItem(items, id) {
  const out = Array.isArray(items) ? items.filter((it) => it && it.id !== id) : [];
  return out;
}

// ── Bundled-preset reconcile pure helpers ──────────────────────────────
//
// When a shipped bundle replaces a preset adapter with a newer build (a
// fresh timestamped dir for the same persona), the old copy can linger in
// <userData>/adapters/ after the new one is seeded in. Both .gguf get the
// same persona slug from filename hints, so Settings shows the persona
// twice — and because only one is in the manifest, the other falls back
// to its raw `adapter_model.f16.gguf` filename. These pure helpers decide
// what to re-point / delete; the closure wrapper does the fs walk + writes.

// Mirror of findAdapterByHint's match rule: the hint hits when it's a
// substring of the filename OR its immediate parent dir name (case-
// insensitive). The parent-dir check matters because the .gguf is usually
// generically named while the persona lives in the dir name.
function adapterMatchesHint(filePath, hint) {
  if (!filePath || !hint) return false;
  const needle = String(hint).toLowerCase();
  const lower = path.basename(filePath).toLowerCase();
  const parent = path.basename(path.dirname(filePath)).toLowerCase();
  return lower.includes(needle) || parent.includes(needle);
}

// Per bundled preset, pick the canonical on-disk .gguf and flag older
// copies as superseded. Pure: caller supplies the scanned file list (with
// mtime), the presets, and the current manifest items.
//
//   scanned       : [{ path, name, mtimeMs }]
//   presets       : DEFAULT_PRESET_ENTRIES ({ id, filenameHint, ... })
//   manifestItems : current manifest items
//
// Returns { repoint: [{ id, path }], superseded: [filePath] }. A hint-
// matching file claimed by a *different* manifest entry (e.g. a user
// `upload:*`) is protected: never a candidate, so never re-pointed away
// or deleted.
function planBundledReconcile({ scanned, presets, manifestItems } = {}) {
  const repoint = [];
  const superseded = [];
  const files = Array.isArray(scanned) ? scanned : [];
  const presetList = Array.isArray(presets) ? presets : [];
  const items = Array.isArray(manifestItems) ? manifestItems : [];
  const resolve = (p) => { try { return path.resolve(p); } catch { return p; } };

  for (const preset of presetList) {
    if (!preset || !preset.id || !preset.filenameHint) continue;
    const protectedPaths = new Set();
    for (const it of items) {
      if (!it || !it.path || it.id === preset.id) continue;
      protectedPaths.add(resolve(it.path));
    }
    const candidates = files.filter(
      (f) => f && f.path &&
        adapterMatchesHint(f.path, preset.filenameHint) &&
        !protectedPaths.has(resolve(f.path)),
    );
    if (candidates.length === 0) continue;
    // Canonical = newest by mtime; tie-broken by greatest path so the
    // timestamped dir name (…20260524…) wins deterministically.
    const canonical = candidates.slice().sort((a, b) => {
      const am = Number(a.mtimeMs) || 0;
      const bm = Number(b.mtimeMs) || 0;
      if (am !== bm) return bm - am;
      return a.path < b.path ? 1 : a.path > b.path ? -1 : 0;
    })[0];
    const current = items.find((it) => it && it.id === preset.id);
    if (current && current.path && resolve(current.path) !== resolve(canonical.path)) {
      repoint.push({ id: preset.id, path: canonical.path });
    }
    for (const c of candidates) {
      if (resolve(c.path) !== resolve(canonical.path)) superseded.push(c.path);
    }
  }
  return { repoint, superseded };
}

// Guard for the destructive step: map a superseded .gguf to what may be
// safely removed. Never returns a target at or above the adapter root.
//   - file in a proper subdir of adapterDir → delete that subdir
//   - file directly in adapterDir           → delete just the file
//   - file == adapterDir / outside it        → skip
function safeDeleteTargetFor(filePath, adapterDir) {
  if (!filePath || !adapterDir) return { kind: "skip", target: null };
  let file, root;
  try { file = path.resolve(filePath); root = path.resolve(adapterDir); }
  catch { return { kind: "skip", target: null }; }
  const parent = path.dirname(file);
  if (parent === root) return { kind: "file", target: file };
  if (parent.startsWith(root + path.sep)) return { kind: "dir", target: parent };
  return { kind: "skip", target: null };
}

// Recursive copy of bundled LoRA adapters from `srcDir` (where
// electron-builder dropped them via extraResources) into `dstDir`
// (the user-writable `<userData>/adapters/` we point the gateway at).
//
// Idempotent: skips any file that already exists at the destination so
// user deletions stick across app restarts. Only copies the file kinds
// the gateway and Settings UI care about (`.gguf` weights + README /
// adapter_config metadata), to keep the user dir tidy.
//
// Returns `{ copied, skipped, errors }` for log + test introspection.
// Failures on individual files don't abort the walk — we want best
// effort, the worst case is the user just doesn't see the default
// nekoqa preset and has to drop the .gguf in by hand.
function seedAdaptersFromBundle(srcDir, dstDir, fsImpl = fs, log = () => {}) {
  const result = { copied: [], skipped: [], errors: [] };
  if (!srcDir) return result;
  try { fsImpl.mkdirSync(dstDir, { recursive: true }); } catch {}

  function walk(curSrc, curDst) {
    let entries;
    try { entries = fsImpl.readdirSync(curSrc, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const s = path.join(curSrc, entry.name);
      const d = path.join(curDst, entry.name);
      if (entry.isDirectory()) {
        try { fsImpl.mkdirSync(d, { recursive: true }); } catch {}
        walk(s, d);
        continue;
      }
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      const isAllowed =
        lower.endsWith(".gguf") ||
        lower.endsWith(".md") ||
        lower === "adapter_config.json";
      if (!isAllowed) continue;
      try {
        if (fsImpl.existsSync(d)) {
          result.skipped.push(d);
          continue;
        }
        fsImpl.copyFileSync(s, d);
        result.copied.push(d);
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        log(`[minicpm] adapter seed copy failed: ${entry.name} -> ${msg}`);
        result.errors.push({ path: d, error: msg });
      }
    }
  }
  try { walk(srcDir, dstDir); }
  catch (err) {
    const msg = err && err.message ? err.message : String(err);
    log(`[minicpm] seedAdaptersFromBundle walk failed: ${msg}`);
    result.errors.push({ path: dstDir, error: msg });
  }
  return result;
}

// ── HTTP probe helpers ──────────────────────────────────────────────────────

function httpJson(method, urlStr, body, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + (u.search || ""),
      method,
      headers: { "content-type": "application/json" },
      timeout: timeoutMs,
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode || 0, json: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode || 0, json: null, raw: data });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Sidecar manager ─────────────────────────────────────────────────────────

class Sidecar {
  constructor({ sidecarDir, sidecarBin, appRoot, port, host, log, logFile, adapterDir, modelPresent }) {
    // Source tree of minicpm-sidecar; used only in dev when no prebuilt
    // binary is present. Packaged builds ignore it entirely.
    this.sidecarDir = sidecarDir || null;
    // Optional prebuilt gateway binary. When set we skip Python lookup.
    // Populated in packaged builds via electron-builder extraResources →
    // resources/sidecar-bin/minicpm-sidecar[.exe].
    this.sidecarBin = sidecarBin || null;
    this.appRoot = appRoot || null;
    this.port = port;
    this.host = host;
    this.log = log || (() => {});
    this.proc = null;
    this.starting = null;
    this.stderrTail = [];
    // Where the gateway should scan for *.gguf LoRA adapters. We pass
    // it via MINICPM_ADAPTER_DIR env at spawn time so /api/adapters and
    // /api/load-adapter see the same directory Settings → "open adapter
    // folder" exposes to the user.
    this.adapterDir = adapterDir || null;
    // Mutable: which LoRA (if any) the user wants loaded at this
    // sidecar's startup. We re-read prefs each respawn so a swap done
    // via Settings persists across an explicit "Restart Sidecar".
    this.activeAdapterPath = null;
    // Append-mode file stream where every stdout / stderr line from the
    // sidecar gets persisted to <userData>/logs/sidecar.log. Critical
    // for packaged builds where console.log goes nowhere.
    this.logFile = logFile || null;
    this._fileStream = null;
    this._fileSizeBudget = 2 * 1024 * 1024; // 2 MB before rotate
    this._fileBytesWritten = 0;
    this.modelPresent = typeof modelPresent === "function" ? modelPresent : (() => false);
  }

  _openLogStream() {
    if (!this.logFile) return null;
    if (this._fileStream) return this._fileStream;
    try {
      fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
      // Pre-rotate if the existing file is already over budget so we
      // start clean each app launch (or restart of the sidecar).
      try {
        const st = fs.statSync(this.logFile);
        if (st.size > this._fileSizeBudget) {
          fs.renameSync(this.logFile, this.logFile + ".1");
        }
      } catch {}
      this._fileStream = fs.createWriteStream(this.logFile, { flags: "a" });
      this._fileBytesWritten = 0;
      const ts = new Date().toISOString();
      this._fileStream.write(`\n===== sidecar session ${ts} (host=${this.host} port=${this.port}) =====\n`);
    } catch (err) {
      this.log(`[minicpm-chat] open log file failed: ${err && err.message}`);
    }
    return this._fileStream;
  }

  _appendLog(line) {
    const stream = this._openLogStream();
    if (!stream) return;
    try {
      const chunk = line.endsWith("\n") ? line : line + "\n";
      stream.write(chunk);
      this._fileBytesWritten += Buffer.byteLength(chunk);
      // Soft rotate: when the stream grows past budget, roll over once.
      // We do this lazily so we don't fsync on every line.
      if (this._fileBytesWritten > this._fileSizeBudget) {
        try {
          stream.end();
          fs.renameSync(this.logFile, this.logFile + ".1");
        } catch {}
        this._fileStream = null;
        this._fileBytesWritten = 0;
      }
    } catch {}
  }

  // Pull last N stderr chunks (raw) for inclusion in error toasts /
  // crash dumps.
  _stderrTailString(maxChars = 1500) {
    return (this.stderrTail.join("").trim().slice(-maxChars)) || "(no stderr)";
  }

  baseUrl() { return `http://${this.host}:${this.port}`; }

  async ensureRunning(initialModelDir) {
    if (await this.isHealthy(initialModelDir)) return { status: "already-running" };

    // Gateway may be running but without a loaded model (alive=false).
    // Hot-load via /api/load-model instead of spawning a second process
    // which would fail with EADDRINUSE on the same port.
    if (this.proc && this.modelPresent(initialModelDir)) {
      const gguf = this._resolveGgufPath(initialModelDir);
      if (gguf) {
        const loaded = await this.loadModel(gguf);
        if (loaded && loaded.ok) return { status: "model-loaded" };
      }
    }

    if (this.starting) return this.starting;
    this.starting = this._spawnAndWait(initialModelDir).finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  _resolveGgufPath(dirOrFile) {
    try {
      const st = fs.statSync(dirOrFile);
      if (st.isFile() && dirOrFile.toLowerCase().endsWith(".gguf")) return dirOrFile;
      if (st.isDirectory()) {
        const entries = fs.readdirSync(dirOrFile)
          .filter((n) => n.toLowerCase().endsWith(".gguf"));
        if (entries.length) return path.join(dirOrFile, entries[0]);
      }
    } catch {}
    return null;
  }

  async isHealthy(initialModelDir) {
    try {
      const r = await httpJson("GET", `${this.baseUrl()}/api/health`, null, 1500);
      if (!(r.status === 200 && r.json && r.json.ok === true)) return false;
      if (this.modelPresent(initialModelDir)) {
        return r.json.alive === true
          || !!(r.json.llama_server && r.json.llama_server.status === "ok");
      }
      return true;
    } catch {
      return false;
    }
  }

  async listModels() {
    try {
      const r = await httpJson("GET", `${this.baseUrl()}/api/models`, null, 2000);
      return r.json || null;
    } catch { return null; }
  }

  async loadModel(p) {
    try {
      const r = await httpJson("POST", `${this.baseUrl()}/api/load-model`, { path: p }, 90000);
      return r.json || null;
    } catch (err) { return { error: String(err && err.message || err) }; }
  }

  async checkUpdate() {
    try {
      const r = await httpJson("GET", `${this.baseUrl()}/api/update-check`, null, 4000);
      return r.json || null;
    } catch { return null; }
  }

  async _spawnAndWait(initialModelDir) {
    // We need either the prebuilt gateway binary or the source tree
    // (with a Python venv) to spawn.
    if (!this.sidecarBin && !this.sidecarDir) {
      const err = new Error("sidecar binary not found");
      err.minicpmI18nKey = "chatSidecarMissingBin";
      throw err;
    }

    // Both the binary and `python -m gateway` accept the same flags;
    // we treat them uniformly here.
    const argsCommon = [
      "--host", this.host,
      "--port", String(this.port),
    ];
    if (initialModelDir) argsCommon.push("--model", initialModelDir);

    const env = {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      // Mirror our sidecar.log directory into the gateway so its
      // RotatingFileHandler drops sidecar-internal.log next to what
      // Electron captures — easy to grab via Settings → "打开日志目录".
      MINICPM_LOG_DIR: this.logFile ? path.dirname(this.logFile) : (process.env.MINICPM_LOG_DIR || ""),
      // Point gateway at the writable user adapter dir so /api/adapters
      // and /api/load-adapter see exactly what Settings UI shows.
      MINICPM_ADAPTER_DIR: this.adapterDir || process.env.MINICPM_ADAPTER_DIR || "",
      // Boot directly into the user's persisted LoRA choice. Empty
      // string (or unset) means "boot Base, no LoRA loaded" — the
      // gateway then refrains from passing any --lora flag, keeping
      // memory minimal for users who never opt in to a persona.
      MINICPM_ACTIVE_ADAPTER: this.activeAdapterPath || process.env.MINICPM_ACTIVE_ADAPTER || "",
      // Pin the parent-watchdog inside the gateway to OUR pid (Electron
      // main), not to whatever ppid the PyInstaller bootloader's Python
      // re-exec hop ends up with. If Electron crashes or is `kill -9`'d,
      // the watchdog notices our pid is gone and tears down the
      // sidecar + llama-server within ~2s, so :18765 / :18766 don't
      // stay held by an orphan.
      MINICPM_PARENT_PID: String(process.pid),
    };

    // Strip proxy environment variables to avoid socksio dependency issues.
    // The sidecar only makes local HTTP calls (localhost:18766) and downloads
    // from HuggingFace (which has its own proxy handling via huggingface_hub).
    const proxyVars = [
      "http_proxy", "https_proxy", "ftp_proxy", "socks_proxy",
      "HTTP_PROXY", "HTTPS_PROXY", "FTP_PROXY", "SOCKS_PROXY",
      "all_proxy", "ALL_PROXY",
    ];
    for (const v of proxyVars) {
      delete env[v];
    }

    let proc;
    if (this.sidecarBin) {
      // Production path: a self-contained gateway binary. No Python
      // interpreter required on the host. The gateway itself locates
      // and spawns the llama-server binary sitting next to it.
      this.log(`[minicpm-chat] spawn binary ${this.sidecarBin} --port ${this.port}`);
      proc = spawn(this.sidecarBin, argsCommon, {
        cwd: path.dirname(this.sidecarBin),
        env,
      });
    } else {
      const python = locatePython(this.sidecarDir);
      if (!python) {
        const err = new Error("Python interpreter not found");
        err.minicpmI18nKey = "chatSidecarMissingPython";
        throw err;
      }
      this.log(`[minicpm-chat] spawn ${python} -m gateway --port ${this.port}`);
      proc = spawn(python, ["-m", "gateway", ...argsCommon], {
        cwd: this.sidecarDir,
        env,
      });
    }

    this.proc = proc;
    this.stderrTail.length = 0;

    // Make sure the log file is open for the new session.
    this._openLogStream();
    this._appendLog(`[spawn] ${this.sidecarBin || "python"} (pid=${proc.pid})`);

    proc.stdout.on("data", (b) => {
      const s = b.toString();
      this.log(`[sidecar] ${s.trimEnd()}`);
      this._appendLog(`[stdout] ${s.trimEnd()}`);
    });
    proc.stderr.on("data", (b) => {
      const s = b.toString();
      this.log(`[sidecar! ] ${s.trimEnd()}`);
      this._appendLog(`[stderr] ${s.trimEnd()}`);
      this.stderrTail.push(s);
      if (this.stderrTail.length > 40) this.stderrTail.shift();
    });
    proc.on("exit", (code, signal) => {
      this.log(`[minicpm-chat] sidecar exited code=${code} signal=${signal}`);
      this._appendLog(`[exit] code=${code} signal=${signal}`);
      // If the process died with a non-zero exit (and wasn't a clean
      // SIGTERM from our own stop()), archive the recent stderr tail as
      // a standalone crash dump so we can investigate after restart.
      const crashed = (typeof code === "number" && code !== 0) ||
                       (signal && signal !== "SIGTERM");
      if (crashed && this.logFile) {
        try {
          const dir = path.dirname(this.logFile);
          const ts = new Date().toISOString().replace(/[:.]/g, "-");
          const dump = path.join(dir, `sidecar-crash-${ts}.log`);
          const header =
            `# sidecar crash dump\n` +
            `# at:    ${new Date().toISOString()}\n` +
            `# code:  ${code}\n` +
            `# sig:   ${signal}\n` +
            `# pid:   ${proc.pid}\n` +
            `# bin:   ${this.sidecarBin || "python"}\n` +
            `# port:  ${this.port}\n` +
            `\n----- stderr tail -----\n`;
          fs.writeFileSync(dump, header + this._stderrTailString(8000), "utf-8");
          // Prune to the 5 most recent crash dumps.
          try {
            const files = fs.readdirSync(dir)
              .filter((f) => f.startsWith("sidecar-crash-"))
              .sort()
              .reverse();
            for (const old of files.slice(5)) {
              try { fs.unlinkSync(path.join(dir, old)); } catch {}
            }
          } catch {}
          this.log(`[minicpm-chat] crash dump → ${dump}`);
        } catch (err) {
          this.log(`[minicpm-chat] failed to write crash dump: ${err && err.message}`);
        }
      }
      if (this.proc === proc) this.proc = null;
    });

    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (!this.proc) {
        const err = new Error(`Python process exited prematurely. stderr tail:\n${this._stderrTailString(1500)}`);
        err.minicpmI18nKey = "chatSidecarPyExited";
        err.minicpmI18nParams = { tail: this._stderrTailString(1500) };
        throw err;
      }
      const health = await httpJson("GET", `${this.baseUrl()}/api/health`, null, 1500).catch(() => null);
      if (health && health.status === 200 && health.json && health.json.ok === true) {
        if (this.modelPresent(initialModelDir)) {
          if (health.json.startup_error) {
            this.stop();
            throw new Error(`llama-server failed to start: ${health.json.startup_error}`);
          }
          if (
            health.json.alive === true ||
            (health.json.llama_server && health.json.llama_server.status === "ok")
          ) {
            return { status: "started" };
          }
        } else {
          return { status: "started" };
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    this.stop();
    const err = new Error("Timed out waiting for Python service (90s)");
    err.minicpmI18nKey = "chatSidecarTimeout";
    throw err;
  }

  stop() {
    if (!this.proc) return;
    const proc = this.proc;
    const pid = proc.pid;

    if (process.platform === "win32" && pid) {
      // PyInstaller --onefile spawns a bootloader (the pid we get back from
      // child_process.spawn) which then launches the actual Python process
      // as a separate child. Windows doesn't put them in the same job
      // object, so a plain `proc.kill("SIGTERM")` only terminates the
      // bootloader — the Python child stays alive holding the gateway
      // socket on :18765, which then blocks every subsequent respawn with
      // EADDRINUSE / "llama-server not running". Use taskkill /T to walk
      // the process tree and kill the bootloader + every descendant
      // (Python, llama-server, ...) in one shot.
      try {
        execFile("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true }, () => {});
      } catch {
        try { proc.kill("SIGKILL"); } catch {}
      }
      return;
    }

    try { proc.kill("SIGTERM"); } catch {}
    setTimeout(() => {
      if (this.proc === proc) { try { proc.kill("SIGKILL"); } catch {} }
    }, 2000).unref();
  }

  async stopAndWait(timeoutMs = 5000) {
    const proc = this.proc;
    this.stop();

    const waitForProcExit = async () => {
      if (!proc || proc.exitCode != null || proc.signalCode != null) return true;
      return new Promise((resolve) => {
        let done = false;
        let timer = null;
        const finish = (exited) => {
          if (done) return;
          done = true;
          try { proc.removeListener("exit", onExit); } catch {}
          if (timer) clearTimeout(timer);
          resolve(exited);
        };
        const onExit = () => finish(true);
        proc.once("exit", onExit);
        timer = setTimeout(() => finish(false), timeoutMs);
        if (timer && typeof timer.unref === "function") timer.unref();
      });
    };

    const waitForHealthDown = async (deadline) => {
      let misses = 0;
      while (Date.now() < deadline) {
        const r = await httpJson("GET", `${this.baseUrl()}/api/health`, null, 300).catch(() => null);
        if (r && r.status === 200 && r.json && r.json.ok === true) {
          misses = 0;
        } else {
          misses += 1;
          if (misses >= 2) return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      return false;
    };

    if (!(await waitForProcExit())) {
      throw new Error("Timed out waiting for sidecar process to exit");
    }
    if (!(await waitForHealthDown(Date.now() + timeoutMs))) {
      throw new Error("Timed out waiting for sidecar port to close");
    }
  }
}

// ── Bubble positioning ──────────────────────────────────────────────────────

function pickSide(petBounds, workArea, width, height, preferred = "auto") {
  const wb = workArea.x + workArea.width;
  const hb = workArea.y + workArea.height;
  const fitsRight = (petBounds.x + petBounds.width + BUBBLE_GAP + width) <= (wb - EDGE_MARGIN);
  const fitsLeft = (petBounds.x - BUBBLE_GAP - width) >= (workArea.x + EDGE_MARGIN);
  const fitsBelow = (petBounds.y + petBounds.height + BUBBLE_GAP + height) <= (hb - EDGE_MARGIN);
  const fitsAbove = (petBounds.y - BUBBLE_GAP - height) >= (workArea.y + EDGE_MARGIN);
  // Honor the user's preferred side when it fits; fall back to the
  // opposite if there's no room there. "auto" preserves the original
  // right-first ordering for backward compatibility.
  if (preferred === "left") {
    if (fitsLeft) return "left";
    if (fitsRight) return "right";
  } else if (preferred === "right") {
    if (fitsRight) return "right";
    if (fitsLeft) return "left";
  } else {
    if (fitsRight) return "right";
    if (fitsLeft) return "left";
  }
  if (fitsBelow) return "below";
  if (fitsAbove) return "above";
  return preferred === "left" ? "left" : "right";
}

function computeBubbleBoundsForSide(side, petBounds, workArea, width, height, opts = {}) {
  const cx = petBounds.x + petBounds.width / 2;
  const cy = petBounds.y + petBounds.height / 2;
  const wb = workArea.x + workArea.width;
  const hb = workArea.y + workArea.height;
  // verticalAnchor: "center" (default) — bubble grows from middle; "bottom" —
  // bubble's bottom edge stays put as it grows (used during continuous-chat
  // typing so the textarea position stays stable under the cursor).
  const vAnchor = opts.verticalAnchor || "center";
  const anchorBottomY = opts.anchorBottomY;
  // User-saved offsets (from drag-to-position in Settings). dx is signed
  // "further from pet"; dy is signed "downward from pet vertical center".
  const offsetDx = Number.isFinite(opts.offsetDx) ? opts.offsetDx : 0;
  const offsetDy = Number.isFinite(opts.offsetDy) ? opts.offsetDy : 0;

  let x, y;
  if (side === "left" || side === "right") {
    if (side === "left") x = petBounds.x - BUBBLE_GAP - width - offsetDx;
    else                 x = petBounds.x + petBounds.width + BUBBLE_GAP + offsetDx;
    if (vAnchor === "bottom" && Number.isFinite(anchorBottomY)) {
      y = anchorBottomY - height;
    } else {
      y = cy - height / 2 + offsetDy;
    }
  } else if (side === "above") {
    x = cx - width / 2 + offsetDx;
    y = petBounds.y - BUBBLE_GAP - height - offsetDy;
  } else { // below
    x = cx - width / 2 + offsetDx;
    y = petBounds.y + petBounds.height + BUBBLE_GAP + offsetDy;
  }
  x = Math.round(Math.max(workArea.x + EDGE_MARGIN, Math.min(x, wb - EDGE_MARGIN - width)));
  y = Math.round(Math.max(workArea.y + EDGE_MARGIN, Math.min(y, hb - EDGE_MARGIN - height)));
  return { x, y, width: Math.round(width), height: Math.round(height) };
}

// ── Window manager ──────────────────────────────────────────────────────────

module.exports = function initMinicpmChat(ctx) {
  const appRoot = path.resolve(__dirname, "..");
  const sidecarDir = locateSidecarSourceDir(appRoot);
  const sidecarBin = locateSidecarBinary(appRoot);
  const port = Number(process.env.MINICPM_PORT || DEFAULT_PORT);
  const host = process.env.MINICPM_HOST || DEFAULT_HOST;
  const log = (msg) => { try { console.log(msg); } catch {} };
  const screenCapture = createScreenCaptureService({ desktopCapturer, systemPreferences });

  // ── i18n bridge ──────────────────────────────────────────────────────
  // ctx.getLang() returns the *effective* UI language. Used to translate
  // sidecar errors (raised with a `minicpmI18nKey` annotation) and to
  // provide the chat renderer with its initial dictionary + classifier
  // few-shots over IPC.
  const minicpmI18n = require("./shared/i18n/minicpm-i18n");
  const getLang = () => {
    try {
      if (ctx && typeof ctx.getLang === "function") {
        const v = ctx.getLang();
        if (typeof v === "string" && v) return v;
      }
    } catch {}
    return "en";
  };
  const tr = minicpmI18n.makeTranslator(getLang);
  function localizeError(err) {
    if (!err) return "";
    if (err.minicpmI18nKey) {
      return tr(err.minicpmI18nKey, err.minicpmI18nParams || {});
    }
    return err.message || String(err);
  }

  if (sidecarBin) log(`[minicpm-chat] using packaged sidecar binary: ${sidecarBin}`);

  // Resolve <userData>/logs/ once so every consumer can point at the
  // same directory (sidecar stream + crash dumps + Settings "open log
  // folder" button).
  function getLogsDir() {
    try { return path.join(app.getPath("userData"), "logs"); }
    catch { return path.join(os.tmpdir(), "minicpm-logs"); }
  }
  const logsDir = getLogsDir();
  try { fs.mkdirSync(logsDir, { recursive: true }); } catch {}
  const sidecarLogPath = path.join(logsDir, "sidecar.log");
  const chatHistoryDir = (() => {
    try { return path.join(app.getPath("userData"), "chat-history"); }
    catch { return path.join(os.tmpdir(), "minicpm-chat-history"); }
  })();
  const diaryDir = (() => {
    try { return path.join(app.getPath("userData"), "daily-diaries"); }
    catch { return path.join(os.tmpdir(), "minicpm-daily-diaries"); }
  })();
  const diaryStatePath = path.join(diaryDir, ".state.json");
  const memoryNotesDir = (() => {
    try { return path.join(app.getPath("userData"), "memory-notes"); }
    catch { return path.join(os.tmpdir(), "minicpm-memory-notes"); }
  })();
  function appendChatHistory(entry) {
    if (!entry || (entry.role !== "user" && entry.role !== "assistant")) return { ok: false, error: "Invalid chat entry" };
    const content = typeof entry.content === "string" ? entry.content.trim() : "";
    if (!content) return { ok: true, skipped: true };
    try {
      fs.mkdirSync(chatHistoryDir, { recursive: true });
      const now = new Date();
      const requestedDay = typeof entry.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) ? entry.date : "";
      const day = requestedDay || [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
      const line = JSON.stringify({ timestamp: now.toISOString(), role: entry.role, content }) + "\n";
      fs.appendFileSync(path.join(chatHistoryDir, `${day}.jsonl`), line, "utf8");
      return { ok: true, dir: chatHistoryDir };
    } catch (err) {
      return { ok: false, error: String(err && err.message || err) };
    }
  }
  function appendMemoryNote(content) {
    const text = typeof content === "string" ? content.trim() : "";
    if (!text) return { ok: false, error: "Note is empty" };
    try {
      fs.mkdirSync(memoryNotesDir, { recursive: true });
      const now = new Date();
      const day = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
      fs.appendFileSync(path.join(memoryNotesDir, `${day}.jsonl`), JSON.stringify({ timestamp: now.toISOString(), content: text.slice(0, 4000) }) + "\n", "utf8");
      diaryMemoryCache.at = 0;
      return { ok: true };
    } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  }

  // Shared MiniCPM prefs path. This must be initialized before any boot-time
  // adapter/model helpers call readMinicpmPrefsRaw().
  const PARAMS_PATH = (() => {
    try { return path.join(app.getPath("userData"), "minicpm-prefs.json"); }
    catch { return path.join(os.tmpdir(), "minicpm-prefs.json"); }
  })();
  const API_KEY_PATH = (() => {
    try { return path.join(app.getPath("userData"), "minicpm-api-key.bin"); }
    catch { return path.join(os.tmpdir(), "minicpm-api-key.bin"); }
  })();
  const apiKeyPathFor = (id) => {
    const safeId = String(id || "default").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "default";
    try { return path.join(app.getPath("userData"), `minicpm-api-key-${safeId}.bin`); }
    catch { return path.join(os.tmpdir(), `minicpm-api-key-${safeId}.bin`); }
  };

  // ── Adapter (LoRA) path resolution ────────────────────────────────────
  // Same shape as the model paths: <userData>/adapters/ in packaged
  // mode, <repo>/adapters/ in dev. The sidecar gateway scans this dir
  // for *.gguf files at boot and exposes them via /api/adapters; the
  // Settings tab lets the user pick which one is active.
  //
  // Bundled defaults live in <resources>/adapters/ (filled by
  // electron-builder extraResources). On first launch we copy any
  // *.gguf in there into the user dir so the file is editable by the
  // user (delete, rename) and visible in Finder via the same "open
  // adapter folder" shortcut.
  //
  // These helpers live here (before `new Sidecar(...)`) because the
  // seed + dir resolution must happen synchronously at boot, before
  // anything reads them. `const` has TDZ semantics so moving the
  // declarations earlier than their callers is mandatory; the model
  // helpers further down don't have this problem because nothing reads
  // them until IPC handlers fire.
  const ADAPTERS_SUBDIR = "adapters";
  function getDefaultAdapterDir() {
    if (app && app.isPackaged) {
      return path.join(getUserDataDir(), ADAPTERS_SUBDIR);
    }
    return path.resolve(appRoot, "..", ADAPTERS_SUBDIR);
  }
  function getBundledAdapterDir() {
    // process.resourcesPath only exists in packaged builds; dev builds
    // already point getDefaultAdapterDir at the repo so no seeding is
    // needed.
    try {
      if (app && app.isPackaged && process.resourcesPath) {
        return path.join(process.resourcesPath, ADAPTERS_SUBDIR);
      }
    } catch {}
    return null;
  }
  // Wrapper around the module-level pure function so we can unit-test
  // the copy walker without needing to mock Electron's `app` / `process`.
  function seedBundledAdapters() {
    const src = getBundledAdapterDir();
    if (!src) return;
    const dst = getDefaultAdapterDir();
    seedAdaptersFromBundle(src, dst, fs, log);
  }
  function getEffectiveAdapterDir() {
    if (process.env.MINICPM_ADAPTER_DIR) return process.env.MINICPM_ADAPTER_DIR;
    let raw = {};
    try { raw = readMinicpmPrefsRaw(); } catch {}
    if (typeof raw.adapter_dir === "string" && raw.adapter_dir.trim()) {
      return raw.adapter_dir.trim();
    }
    return getDefaultAdapterDir();
  }

  // ── Active adapter persistence ────────────────────────────────────────
  // We persist the user's choice of "currently active LoRA" so the next
  // sidecar spawn loads it directly via --lora (instead of preloading
  // every .gguf we find on disk just in case). Storage key is the
  // manifest entry's stable `id` (e.g. "preset:nekoqa" / "upload:...");
  // a path lookup at spawn time resolves it against the latest manifest,
  // so renames / moves don't break the link. `null` (or missing key)
  // means "start in pure Base mode — no LoRA loaded".
  function getActiveAdapterId() {
    let raw = {};
    try { raw = readMinicpmPrefsRaw(); } catch {}
    if (typeof raw.active_adapter_id === "string" && raw.active_adapter_id.trim()) {
      return raw.active_adapter_id.trim();
    }
    return null;
  }
  function setActiveAdapterId(id) {
    // null / "" clears the persisted choice → next launch boots Base.
    const next = (typeof id === "string" && id.trim()) ? id.trim() : null;
    mergeMinicpmPrefs({ active_adapter_id: next });
    return next;
  }
  function resolveActiveAdapterPath() {
    const id = getActiveAdapterId();
    if (!id) return null;
    const manifest = readAdapterManifest();
    const entry = (manifest.items || []).find((it) => it && it.id === id);
    if (!entry || !entry.path) return null;
    try {
      if (!fs.existsSync(entry.path)) return null;
    } catch { return null; }
    return entry.path;
  }

  // ── Adapter manifest (display names + aliases) ────────────────────────
  //
  // The gateway only knows about physical *.gguf files and a coarse
  // persona slug derived from filename hints. Everything user-facing —
  // friendly names like "猫娘 宝宝" and the alias list that powers chat
  // commands ("切到猫娘") — lives in this manifest, owned by the Electron
  // main process. Two consumers read it:
  //
  //   1. The Settings UI (via IPC) — for rendering chip labels and
  //      letting users rename / delete / upload entries.
  //   2. The sidecar (gateway) — we drop a copy as `.manifest.json` in
  //      the adapter dir so gateway can merge displayName/aliases into
  //      its `/api/adapters` response, which the chat bubble HTML
  //      reads directly (the chat web view has no preload bridge).
  //
  // Schema is documented in adapters/README.md.
  const ADAPTER_MANIFEST_FILE = "minicpm-adapters.json";
  // Mirror file the gateway reads on every /api/adapters call. Lives in
  // the adapter dir so a single watch / FS lookup is enough; the dot
  // prefix keeps it out of the *.gguf scan.
  const ADAPTER_MANIFEST_MIRROR = ".manifest.json";

  // Built-in presets that ship with the app. After the bundled .gguf
  // files have been copied into <userData>/adapters/ on first launch we
  // resolve `filenameHint` against the actual on-disk file and write a
  // manifest entry — so the user sees "猫娘 宝宝" the first time they
  // open Settings without any extra UI interaction.
  const DEFAULT_PRESET_ENTRIES = [
    {
      id: "preset:nekoqa",
      displayName: "猫娘",
      aliases: ["猫娘", "宝宝", "neko"],
      persona: "neko",
      filenameHint: "lora_nekoqa",
    },
  ];

  function adapterManifestPath() {
    return path.join(getUserDataDir(), ADAPTER_MANIFEST_FILE);
  }
  function emptyManifest() {
    return { version: 1, items: [] };
  }
  function readAdapterManifest() {
    const p = adapterManifestPath();
    try {
      if (!fs.existsSync(p)) return emptyManifest();
      return parseManifestJson(fs.readFileSync(p, "utf-8"));
    } catch (err) {
      log(`[minicpm] adapter manifest read failed: ${err && err.message}`);
      return emptyManifest();
    }
  }
  function writeAdapterManifest(obj) {
    const p = adapterManifestPath();
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(obj || emptyManifest(), null, 2), "utf-8");
      // Mirror to the adapter dir for the gateway to read. Strip the
      // `id` field (gateway doesn't need internal identifiers) and
      // re-key by path so the gateway can resolve in O(1).
      try {
        const dir = getEffectiveAdapterDir();
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          path.join(dir, ADAPTER_MANIFEST_MIRROR),
          JSON.stringify(obj || emptyManifest(), null, 2),
          "utf-8",
        );
      } catch (mirrorErr) {
        log(`[minicpm] adapter manifest mirror failed: ${mirrorErr && mirrorErr.message}`);
      }
      return true;
    } catch (err) {
      log(`[minicpm] adapter manifest write failed: ${err && err.message}`);
      return false;
    }
  }
  function upsertAdapterEntry(entry) {
    if (!entry || !entry.id) return null;
    const manifest = readAdapterManifest();
    manifest.items = manifestUpsertItem(manifest.items, entry);
    writeAdapterManifest(manifest);
    return manifest.items.find((it) => it.id === entry.id) || null;
  }
  function removeAdapterEntry(id) {
    const manifest = readAdapterManifest();
    const before = manifest.items.length;
    manifest.items = manifestRemoveItem(manifest.items, id);
    if (manifest.items.length === before) return false;
    writeAdapterManifest(manifest);
    return true;
  }
  // Walk the adapter dir for a .gguf whose filename includes `hint`
  // (case-insensitive). Returns the absolute path, or null. Used by
  // seedDefaultManifest to bind built-in presets to whichever file
  // electron-builder actually shipped (filenames carry timestamps so
  // we can't hardcode them).
  function findAdapterByHint(dir, hint) {
    if (!hint) return null;
    const needle = String(hint).toLowerCase();
    function walk(cur) {
      let entries;
      try { entries = fs.readdirSync(cur, { withFileTypes: true }); }
      catch { return null; }
      for (const e of entries) {
        const p = path.join(cur, e.name);
        if (e.isDirectory()) {
          const hit = walk(p);
          if (hit) return hit;
          continue;
        }
        if (!e.isFile()) continue;
        const lower = e.name.toLowerCase();
        if (!lower.endsWith(".gguf")) continue;
        // Match against both filename and the immediate parent dir name
        // so a hint like "lora_nekoqa" hits the file even when the
        // .gguf itself is named generically (adapter_model.f16.gguf).
        const parent = path.basename(path.dirname(p)).toLowerCase();
        if (lower.includes(needle) || parent.includes(needle)) return p;
      }
      return null;
    }
    return walk(dir);
  }
  // First-run helper: if the user has no manifest yet, build one from
  // DEFAULT_PRESET_ENTRIES by resolving each preset's filenameHint
  // against the adapter dir. Skips presets whose backing .gguf isn't
  // there (e.g. the user deleted it before first launch).
  //
  // Idempotent: only writes when the manifest is missing or empty;
  // subsequent launches see the user's choices and don't touch them.
  function seedDefaultManifest() {
    const existing = readAdapterManifest();
    if (existing.items && existing.items.length > 0) return;
    const dir = getEffectiveAdapterDir();
    const items = [];
    for (const preset of DEFAULT_PRESET_ENTRIES) {
      const matched = findAdapterByHint(dir, preset.filenameHint);
      if (!matched) {
        log(`[minicpm] preset ${preset.id} has no matching .gguf in ${dir}, skipping seed`);
        continue;
      }
      items.push({
        id: preset.id,
        path: matched,
        displayName: preset.displayName,
        aliases: Array.isArray(preset.aliases) ? [...preset.aliases] : [],
        persona: preset.persona || "default",
        source: "bundled",
        createdAt: new Date().toISOString(),
      });
    }
    writeAdapterManifest({ version: 1, items });
  }

  // Repair pass: bundled-preset entries whose `path` no longer exists
  // (because the user moved their dev checkout, reinstalled the app
  // under a different userData, etc.) get re-bound to whatever .gguf
  // their `filenameHint` resolves to in the current adapter dir. User-
  // upload entries are NEVER auto-repaired — they're surfaced as
  // `missing: true` in the UI so the user can decide what to do.
  function repairBundledManifestPaths() {
    const manifest = readAdapterManifest();
    if (!manifest.items || manifest.items.length === 0) return;
    const dir = path.resolve(getEffectiveAdapterDir());
    let dirty = false;
    for (const entry of manifest.items) {
      if (!entry || entry.source !== "bundled") continue;
      let needsRepair = true;
      try {
        if (entry.path && fs.existsSync(entry.path)) {
          // Existence alone isn't enough: when the user switches between
          // dev (`<repo>/adapters/`) and packaged (`<userData>/adapters/`),
          // the previous run's path may still resolve on disk while the
          // gateway scans a different dir. Only treat the entry as
          // healthy when its path lives under the *current* effective
          // adapter dir — otherwise the IPC merge layer can't match it
          // up with what gateway returns and the chip falls into the
          // missing-file branch.
          const resolvedEntry = path.resolve(entry.path);
          if (resolvedEntry === dir || resolvedEntry.startsWith(dir + path.sep)) {
            needsRepair = false;
          }
        }
      } catch {}
      if (!needsRepair) continue;
      const preset = DEFAULT_PRESET_ENTRIES.find((p) => p.id === entry.id);
      if (!preset || !preset.filenameHint) continue;
      const found = findAdapterByHint(dir, preset.filenameHint);
      if (!found) {
        log(`[minicpm] bundled preset ${entry.id} path '${entry.path}' missing in ${dir}`);
        continue;
      }
      log(`[minicpm] repaired ${entry.id} path: ${entry.path} -> ${found}`);
      entry.path = found;
      dirty = true;
    }
    if (dirty) writeAdapterManifest(manifest);
  }

  // Recursively list *.gguf under `rootDir` with mtime, skipping the
  // staging / backup dirs the gateway also ignores (server.py). Feeds
  // the pure planBundledReconcile().
  function listAdapterGgufs(rootDir) {
    const out = [];
    function walk(cur) {
      let entries;
      try { entries = fs.readdirSync(cur, { withFileTypes: true }); }
      catch { return; }
      for (const e of entries) {
        const p = path.join(cur, e.name);
        if (e.isDirectory()) {
          if (e.name.endsWith(".bak") || e.name.endsWith(".update-staging")) continue;
          walk(p);
          continue;
        }
        if (!e.isFile() || !e.name.toLowerCase().endsWith(".gguf")) continue;
        let mtimeMs = 0;
        try { mtimeMs = fs.statSync(p).mtimeMs; } catch {}
        out.push({ path: p, name: e.name, mtimeMs });
      }
    }
    walk(rootDir);
    return out;
  }

  // Reconcile bundled presets after seed + repair: when a newer copy of a
  // preset's adapter has been seeded alongside an older one, re-point the
  // manifest at the newest and delete the stale copies, so Settings stops
  // showing a duplicate persona chip (one stuck on the raw .gguf name).
  // Only touches files matching a preset hint that no user-upload entry
  // claims; the kept copy and the adapter root are never delete targets.
  function reconcileBundledDuplicates() {
    const dir = path.resolve(getEffectiveAdapterDir());
    const scanned = listAdapterGgufs(dir);
    const plan = planBundledReconcile({
      scanned,
      presets: DEFAULT_PRESET_ENTRIES,
      manifestItems: readAdapterManifest().items,
    });
    for (const r of plan.repoint) {
      upsertAdapterEntry({ id: r.id, path: r.path });
      log(`[minicpm] reconcile re-pointed ${r.id} -> ${r.path}`);
    }
    for (const filePath of plan.superseded) {
      const { kind, target } = safeDeleteTargetFor(filePath, dir);
      if (kind === "skip" || !target) {
        log(`[minicpm] reconcile skipped unsafe delete target: ${filePath}`);
        continue;
      }
      try {
        fs.rmSync(target, { recursive: true, force: true });
        log(`[minicpm] reconcile removed superseded ${kind}: ${target}`);
      } catch (err) {
        log(`[minicpm] reconcile delete failed for ${target}: ${err && err.message}`);
      }
    }
  }

  // Inference runtimes and adapters are user-managed. Keep the legacy
  // object inert during the transition; no directories are created and no
  // model or LoRA discovery runs at application startup.
  const adapterDir = null;
  const sidecar = new Sidecar({
    sidecarDir, sidecarBin, appRoot, port, host, log,
    logFile: sidecarLogPath,
    adapterDir,
    modelPresent: (dir) => isModelPresent(dir),
  });
  // Refresh `sidecar.activeAdapterPath` from prefs every time we're about
  // to spawn. Lets the user pick a persona, restart the sidecar from
  // Settings, and have the new choice take effect — without needing to
  // wire Sidecar.start() into closure-only helpers.
  function refreshActiveAdapterPath() {
    try {
      sidecar.activeAdapterPath = resolveActiveAdapterPath();
    } catch (err) {
      sidecar.activeAdapterPath = null;
      log(`[minicpm] resolveActiveAdapterPath failed: ${err && err.message}`);
    }
    return sidecar.activeAdapterPath;
  }

  let bubble = null;
  let workspace = null;
  let workspaceSenderId = null;
  let workspacePetWasHidden = false;
  let shuttingDown = false;
  let activeSide = "right";
  // Updated from /api/health after the sidecar comes online — drives the
  // narrator's voice (default vs neko etc.).
  let activePersona = "default";
  // Tracked "is the bubble currently shown to the user" flag. We can't rely
  // on bubble.isVisible() with macOS panel windows because showInactive() +
  // panel quirks make it return true even after a hide().
  let bubbleShown = false;
  // When set, bubble resizes pin their bottom edge to this Y so the
  // textarea stays put while the bubble grows upward. Cleared on
  // open/transition. Renderer sets this via the "resize" IPC.
  let chatAnchorBottomY = null;
  // Cached "is there a new model on the remote?" status. Refreshed on
  // launch, after every apply, and whenever the user manually checks.
  let updateStatus = null; // { available, local_revision, remote_revision, ... }

  // ── Chat generation parameters ────────────────────────────────────────
  // Persisted to <userData>/minicpm-prefs.json so they survive restart.
  // Values are validated/clamped on every set; the chat bubble fetches
  // them on each submit, the Settings tab reads/writes via IPC.
  //
  // Several unrelated settings share this file (chat params, `model_dir`,
  // `narration_enabled`, ...). Every writer MUST go through
  // `mergeMinicpmPrefs()` — a naive `JSON.stringify(chatParams)` would erase
  // `model_dir` the next time the user toggled "thinking", etc.
  const DEFAULT_CHAT_PARAMS = {
    max_new_tokens: 768,
    temperature: 0.6,
    top_p: 0.95,
    top_k: 0,                  // 0 = disabled
    repetition_penalty: 1.05,
    thinking: false,           // default off (LoRA usually wasn't trained on <think>)
  };
  const CHAT_PARAM_KEYS = Object.keys(DEFAULT_CHAT_PARAMS);

  function readMinicpmPrefsRaw() {
    try {
      if (!fs.existsSync(PARAMS_PATH)) return {};
      const parsed = JSON.parse(fs.readFileSync(PARAMS_PATH, "utf-8"));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (err) {
      log(`[minicpm] prefs read failed: ${err && err.message}`);
      return {};
    }
  }

  function writeMinicpmPrefsRaw(raw) {
    try {
      fs.writeFileSync(PARAMS_PATH, JSON.stringify(raw, null, 2), "utf-8");
      return true;
    } catch (err) {
      log(`[minicpm] prefs save failed: ${err && err.message}`);
      return false;
    }
  }

  // Read-modify-write merge so each setting only touches its own keys.
  // Passing `undefined` for a key removes it from the persisted file.
  function mergeMinicpmPrefs(partial) {
    if (!partial || typeof partial !== "object") return false;
    const current = readMinicpmPrefsRaw();
    for (const key of Object.keys(partial)) {
      const next = partial[key];
      if (next === undefined) delete current[key];
      else current[key] = next;
    }
    return writeMinicpmPrefsRaw(current);
  }

  // Remote API settings intentionally keep the secret out of JSON prefs.
  // The renderer only ever receives `apiKeyConfigured`, never the key itself.
  const DEFAULT_API_PERSONA = "You are a friendly desktop pet and companion. Speak naturally and helpfully. Do not claim to be Codex, OpenAI, or any other product or model unless the user explicitly asks which API is configured.";
  const DEFAULT_INFERENCE_CONFIG = { inference_mode: "api", api_endpoint: "", api_model: "", api_persona: DEFAULT_API_PERSONA, diary_enabled: true, diary_time: "22:00", mood_duration_minutes: 15, api_key_configured: false };
  function getInferenceConfig() {
    const raw = readMinicpmPrefsRaw();
    const profiles = Array.isArray(raw.api_profiles) && raw.api_profiles.length ? raw.api_profiles : [{ id: "default", name: "默认模型服务", endpoint: raw.api_endpoint || "", model: raw.api_model || "", keyConfigured: !!raw.api_key_configured }];
    const activeId = profiles.some((p) => p && p.id === raw.active_api_profile_id) ? raw.active_api_profile_id : profiles[0].id;
    const active = profiles.find((p) => p && p.id === activeId) || profiles[0];
    return {
      // TsukuMate no longer owns or launches a model runtime. Both localhost
      // and remote endpoints use the same OpenAI-compatible transport.
      inference_mode: "api",
      api_endpoint: typeof active.endpoint === "string" ? active.endpoint : "",
      api_model: typeof active.model === "string" ? active.model : "",
      api_profiles: profiles.map((p) => ({ id: p.id, name: p.name, endpoint: p.endpoint, model: p.model, keyConfigured: !!p.keyConfigured })),
      active_api_profile_id: activeId,
      api_persona: typeof raw.api_persona === "string" && raw.api_persona.trim() ? raw.api_persona.trim() : DEFAULT_API_PERSONA,
      diary_enabled: raw.diary_enabled !== false,
      diary_time: /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.diary_time || "") ? raw.diary_time : "22:00",
      mood_duration_minutes: normalizeMoodDurationMinutes(raw.mood_duration_minutes),
      api_key_configured: !!active.keyConfigured,
    };
  }
  function isApiMode() { return true; }
  function saveApiProfiles(input) {
    const raw = readMinicpmPrefsRaw();
    const source = Array.isArray(input && input.profiles) ? input.profiles : [];
    const seen = new Set();
    const profiles = source.slice(0, 12).map((item, index) => {
      const id = String(item && item.id || `api-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
      if (!id || seen.has(id)) throw new Error("API profile id is invalid or duplicated");
      seen.add(id);
      const checked = validateApiConfig({ endpoint: item && item.endpoint, model: item && item.model });
      const name = String(item && item.name || checked.model).trim().slice(0, 64) || checked.model;
      if (typeof item.api_key === "string" && item.api_key.trim()) writeApiKey(item.api_key.trim(), id);
      return { id, name, endpoint: checked.endpoint, model: checked.model, keyConfigured: !!(readApiKey(id) || (id === "default" && readApiKey())) };
    });
    if (!profiles.length) throw new Error("At least one API profile is required");
    const activeId = profiles.some((p) => p.id === input.activeId) ? input.activeId : profiles[0].id;
    const active = profiles.find((p) => p.id === activeId);
    // Local compatible services commonly do not require authentication.
    mergeMinicpmPrefs({ inference_mode: "api", api_profiles: profiles, active_api_profile_id: activeId, api_endpoint: active.endpoint, api_model: active.model, api_key_configured: active.keyConfigured });
    return getInferenceConfig();
  }
  function readApiKey(id) {
    try {
      const keyPath = id ? apiKeyPathFor(id) : API_KEY_PATH;
      if (!safeStorage || !safeStorage.isEncryptionAvailable() || !fs.existsSync(keyPath)) return null;
      const value = safeStorage.decryptString(fs.readFileSync(keyPath));
      return value || null;
    } catch { return null; }
  }
  function writeApiKey(value, id) {
    if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
      throw new Error("System encryption is unavailable; API key was not saved");
    }
    fs.writeFileSync(id ? apiKeyPathFor(id) : API_KEY_PATH, safeStorage.encryptString(value));
  }
  function getRemoteRuntimeConfig() {
    const config = getInferenceConfig();
    const checked = validateApiConfig({ endpoint: config.api_endpoint, model: config.api_model });
    const apiKey = readApiKey(config.active_api_profile_id) || readApiKey() || "";
    return { ...checked, apiKey, api_persona: getActivePersona().prompt };
  }
  async function setInferenceConfig(input) {
    const current = getInferenceConfig();
    const mode = "api";
    const moodDurationMinutes = normalizeMoodDurationMinutes(input && input.mood_duration_minutes != null ? input.mood_duration_minutes : current.mood_duration_minutes);
    let next = { ...current, inference_mode: mode, mood_duration_minutes: moodDurationMinutes };
    if (mode === "api") {
      const checked = validateApiConfig({ endpoint: input && input.api_endpoint, model: input && input.api_model });
      const persona = typeof input.api_persona === "string" ? input.api_persona.trim() : current.api_persona;
      const diaryTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(input && input.diary_time || "") ? input.diary_time : current.diary_time;
      next = { ...next, api_endpoint: checked.endpoint, api_model: checked.model, api_persona: persona.slice(0, 4000) || DEFAULT_API_PERSONA, diary_enabled: !(input && input.diary_enabled === false), diary_time: diaryTime, mood_duration_minutes: moodDurationMinutes };
      if (typeof input.api_key === "string" && input.api_key.trim()) {
        writeApiKey(input.api_key.trim(), current.active_api_profile_id);
        next.api_key_configured = true;
      }
    }
    mergeMinicpmPrefs(next);
    try { ctx.setChatEmotion && ctx.setChatEmotion({ durationOnly: true, moodDurationMinutes }); } catch {}
    return getInferenceConfig();
  }
  function clearApiKey() {
    try { fs.unlinkSync(API_KEY_PATH); } catch {}
    mergeMinicpmPrefs({ api_key_configured: false });
    return getInferenceConfig();
  }
  function getPersonaProfiles() {
    const raw = readMinicpmPrefsRaw();
    const profiles = normalizeProfiles(raw.persona_profiles, raw.api_persona);
    const active = selectActiveProfile(profiles, raw.active_persona_id || (raw.api_persona ? "legacy" : ""));
    return { profiles, activeId: active.id };
  }
  function savePersonaProfiles(input) {
    const profiles = normalizeProfiles(input && input.profiles);
    const active = selectActiveProfile(profiles, input && input.activeId);
    if (!mergeMinicpmPrefs({ persona_profiles: profiles, active_persona_id: active.id })) {
      throw new Error("Could not save persona profiles");
    }
    return { profiles, activeId: active.id };
  }
  function getActivePersona() {
    const config = getPersonaProfiles();
    return selectActiveProfile(config.profiles, config.activeId);
  }
  function getAppleMusicConfig() {
    const raw = readMinicpmPrefsRaw();
    return {
      playlist: typeof raw.apple_music_playlist === "string" ? raw.apple_music_playlist.trim().slice(0, 160) : "",
    };
  }
  function setAppleMusicConfig(input) {
    const playlist = input && typeof input.playlist === "string"
      ? input.playlist.trim().slice(0, 160)
      : "";
    if (!mergeMinicpmPrefs({ apple_music_playlist: playlist })) {
      throw new Error("Could not save Apple Music settings");
    }
    return getAppleMusicConfig();
  }
  const remoteRequests = new Map();
  let remoteRequestSeq = 0;
  let emotionRequestSeq = 0;
  let activeEmotionEventId = "";
  let emotionController = null;
  let emotionStatusRefreshTimer = null;
  let emotionStatus = {
    phase: "idle",
    emotion: "calm",
    blend: normalizeEmotionBlend("calm", "fallback"),
    moodAction: "preserve",
    reaction: null,
    mood: null,
    updatedAt: null,
  };
  const screenCaptures = new Map();
  let screenCaptureSeq = 0;

  function isChatBubbleSender(sender) {
    return !!(bubble && !bubble.isDestroyed() && sender === bubble.webContents);
  }

  function isWorkspaceSender(sender) {
    return !!(workspace && !workspace.isDestroyed() && sender === workspace.webContents);
  }

  function isChatSurfaceSender(sender) {
    return isChatBubbleSender(sender) || isWorkspaceSender(sender);
  }

  function publishEmotionStatus(next) {
    const phases = ["idle", "classifying", "provisional", "detected", "heuristic", "fallback", "disabled"];
    const blend = normalizeEmotionBlend(next && (next.blend || next.emotion), next && next.phase === "detected" ? "api" : "fallback");
    let runtime = null;
    try { runtime = ctx.getChatEmotion && ctx.getChatEmotion(); } catch {}
    emotionStatus = {
      phase: phases.includes(next && next.phase) ? next.phase : "idle",
      // Keep the legacy field for old renderers and tests while the complete
      // blend travels beside it.
      emotion: EMOTIONS.includes(blend.primary) ? blend.primary : "calm",
      blend,
      moodAction: next && next.moodAction || emotionStatus.moodAction || "preserve",
      reaction: runtime && runtime.reaction || null,
      mood: runtime && runtime.mood || null,
      activeLayer: runtime && runtime.activeLayer || "calm",
      remainingMoodMs: runtime && Number.isFinite(runtime.remainingMoodMs) ? runtime.remainingMoodMs : 0,
      updatedAt: Number.isFinite(next && next.updatedAt) ? next.updatedAt : Date.now(),
    };
    if (bubble && !bubble.isDestroyed()) {
      try { bubble.webContents.send("minicpm:emotion-status", emotionStatus); } catch {}
    }
    if (emotionStatusRefreshTimer) clearTimeout(emotionStatusRefreshTimer);
    emotionStatusRefreshTimer = null;
    const reactionRemaining = runtime && runtime.reaction ? runtime.reaction.expiresAt - Date.now() : 0;
    const moodRemaining = runtime && runtime.mood && runtime.mood.expiresAt ? runtime.mood.expiresAt - Date.now() : 0;
    const refreshIn = reactionRemaining > 0 ? reactionRemaining + 25 : (moodRemaining > 0 ? Math.min(60_000, moodRemaining + 25) : 0);
    if (refreshIn > 0) {
      emotionStatusRefreshTimer = setTimeout(() => {
        emotionStatusRefreshTimer = null;
        publishEmotionStatus({ ...emotionStatus, updatedAt: Date.now() });
      }, refreshIn);
    }
    return { ...emotionStatus };
  }

  function screenCaptureNeedsPermission(error) {
    // `getMediaAccessStatus("screen")` can transiently report
    // "not-determined" after a TCC change even when Electron has already
    // been enabled in System Settings. Only the capture service's explicit
    // denied/restricted result is authoritative here.
    return !!(error && error.code === "SCREEN_CAPTURE_PERMISSION");
  }

  function screenCaptureErrorMessage(error) {
    const permissionMissing = screenCaptureNeedsPermission(error);
    if (permissionMissing) return tr("chatScreenPermissionRequired");
    if (error && error.code === "SCREEN_CAPTURE_INVALID_SOURCE") return tr("chatScreenSourceUnavailable");
    return tr("chatScreenCaptureFailed");
  }

  function discardScreenCapture(token, senderId) {
    const item = screenCaptures.get(String(token || ""));
    if (!item || (senderId != null && item.senderId !== senderId)) return false;
    if (item.timer) clearTimeout(item.timer);
    screenCaptures.delete(String(token));
    return true;
  }

  function discardScreenCapturesForSender(senderId) {
    for (const [token, item] of screenCaptures) {
      if (item.senderId === senderId) discardScreenCapture(token, senderId);
    }
  }

  function storeScreenCapture(senderId, capture) {
    const token = `screen-${Date.now()}-${++screenCaptureSeq}`;
    const item = { senderId, dataUrl: capture.dataUrl, timer: null };
    // A selected image is short-lived even if the user leaves the chat open.
    item.timer = setTimeout(() => discardScreenCapture(token, senderId), 5 * 60 * 1000);
    screenCaptures.set(token, item);
    return { token, previewDataUrl: capture.previewDataUrl };
  }

  function takeScreenCapture(token, senderId) {
    const item = screenCaptures.get(String(token || ""));
    if (!item || item.senderId !== senderId) return null;
    const dataUrl = item.dataUrl;
    discardScreenCapture(token, senderId);
    return dataUrl;
  }

  function withScreenImage(messages, imageDataUrl) {
    const normalized = Array.isArray(messages) ? messages.slice() : [];
    if (!imageDataUrl) return normalized;
    for (let index = normalized.length - 1; index >= 0; index -= 1) {
      const message = normalized[index];
      if (!message || message.role !== "user") continue;
      const existing = Array.isArray(message.content)
        ? message.content.slice()
        : [{ type: "text", text: String(message.content || "") }];
      normalized[index] = {
        ...message,
        content: [...existing, { type: "image_url", image_url: { url: imageDataUrl } }],
      };
      return normalized;
    }
    throw new Error("A screen capture must be attached to a user message");
  }

  let diaryMemoryCache = { at: 0, text: "" };
  function getDiaryMemory() {
    if (Date.now() - diaryMemoryCache.at < 300000) return diaryMemoryCache.text;
    let text = "";
    try {
      const files = fs.readdirSync(diaryDir).filter((n) => /^\d{4}-\d{2}-\d{2}\.md$/.test(n)).sort().slice(-3);
      text = files.map((n) => fs.readFileSync(path.join(diaryDir, n), "utf8").slice(0, 800)).join("\n\n");
      const notes = fs.existsSync(memoryNotesDir) ? fs.readdirSync(memoryNotesDir).filter((n) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(n)).sort().slice(-3).flatMap((n) => fs.readFileSync(path.join(memoryNotesDir, n), "utf8").trim().split("\n").map((line) => { try { return JSON.parse(line).content; } catch { return ""; } })) : [];
      if (notes.length) text += `\n\nExplicit memory notes:\n${notes.filter(Boolean).slice(-12).map((n) => `- ${n}`).join("\n")}`;
      text = text.slice(0, 2200);
    } catch {}
    diaryMemoryCache = { at: Date.now(), text };
    return text;
  }
  async function remoteCompletion(options, onEvent, signal) {
    const cfg = getRemoteRuntimeConfig();
    const hasScreenImage = typeof options.screenImageDataUrl === "string" && options.screenImageDataUrl.startsWith("data:image/");
    if (hasScreenImage) {
      // Deliberately log only the presence and byte count — never the image
      // data itself, user text, or API credentials.
      log(`[screen-capture] attaching image to remote chat (${options.screenImageDataUrl.length} data-url chars)`);
    }
    const body = makeChatBody({
      model: cfg.model,
      messages: withScreenImage(options.messages, options.screenImageDataUrl),
      system: [cfg.api_persona, buildTimeContext(), hasScreenImage ? "The latest user message includes a screen capture. Analyze the image when answering; do not say that you cannot see it unless the image itself is unavailable." : "", options.includeMemory === false ? "" : (getDiaryMemory() ? `Recent diary memories (use only when relevant):\n${getDiaryMemory()}` : ""), options.system || ""].filter(Boolean).join("\n\n"),
      stream: !!options.stream,
      maxTokens: options.max_tokens || options.max_new_tokens,
      temperature: options.temperature,
      topP: options.top_p,
    });
    return requestOpenAi({ endpoint: cfg.endpoint, apiKey: cfg.apiKey, body, signal, onEvent });
  }

  // This request is intentionally isolated from the conversational stream:
  // it has no diary/history side effects, is never sent to the renderer, and
  // cannot delay the actual reply.  Sequence checking prevents a late answer
  // from an older prompt changing the pet after the user has moved on.
  async function classifyChatEmotion(messages, suppliedEventId) {
    const latest = [...(Array.isArray(messages) ? messages : [])].reverse()
      .find((message) => message && message.role === "user");
    const text = latest && typeof latest.content === "string" ? latest.content.trim().slice(0, 1600) : "";
    if (!text) {
      const calm = normalizeEmotionBlend("calm", "fallback");
      publishEmotionStatus({ phase: "fallback", blend: calm });
      return calm;
    }
    const requestId = ++emotionRequestSeq;
    const eventId = String(suppliedEventId || `emotion-${Date.now()}-${requestId}`).replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 96);
    activeEmotionEventId = eventId;
    if (emotionController) emotionController.abort();
    const controller = new AbortController();
    emotionController = controller;
    // Capture the old lasting mood before the local provisional event is
    // applied. Otherwise an explicit local resolve would erase the context
    // the API needs to confirm that the user was actually comforted.
    let priorMoodSummary = { primary: "calm" };
    try {
      const value = ctx.getChatEmotion && ctx.getChatEmotion();
      const mood = value && value.mood;
      if (mood && mood.blend && mood.blend.primary !== "calm") {
        priorMoodSummary = {
          primary: mood.blend.primary,
          secondary: mood.blend.secondary,
          intensity: mood.blend.intensity,
          remainingMinutes: Math.max(0, Math.ceil((mood.expiresAt - Date.now()) / 60000)),
        };
      }
    } catch {}
    // React synchronously before either network request produces a token.
    // The API classifier runs in parallel and corrects this provisional mood.
    const provisional = inferEmotionBlendFromText(text);
    const provisionalMoodAction = inferMoodActionFromText(text, provisional);
    const moodDurationMinutes = getInferenceConfig().mood_duration_minutes;
    try { ctx.setChatEmotion && ctx.setChatEmotion({ eventId, blend: provisional, moodAction: provisionalMoodAction, moodDurationMinutes }); } catch {}
    if (!isApiMode()) {
      publishEmotionStatus({ phase: provisional.primary === "calm" ? "fallback" : "heuristic", blend: provisional, moodAction: provisionalMoodAction });
      return provisional;
    }
    publishEmotionStatus({ phase: "provisional", blend: provisional, moodAction: provisionalMoodAction });
    const timeout = setTimeout(() => controller.abort(), 3000);
    let blend = provisional;
    let source = provisional.primary === "calm" ? "fallback" : "heuristic";
    let streamed = "";
    let apiDecision = null;
    try {
      const cfg = getRemoteRuntimeConfig();
      const body = makeChatBody({
        model: cfg.model,
        stream: true,
        temperature: 0,
        topP: 1,
        maxTokens: 128,
        messages: [{ role: "user", content: text }],
        system: [
          "Classify the immediate emotional response a gentle desktop pet should show to the user's latest message.",
          "Return one compact JSON object and nothing else.",
          'Schema: {"primary":"calm|focused|happy|shy|surprised|sleepy|sad|annoyed","secondary":"optional different non-calm label","primaryWeight":0.0,"secondaryWeight":0.0,"intensity":0.2,"moodAction":"preserve|establish|reinforce|ease|resolve|replace"}.',
          "Use at most two emotions. Weights must sum to 1. Use secondary only when it is materially present. Intensity must be from 0.2 to 1.",
          `Current lasting mood summary before this message: ${JSON.stringify(priorMoodSummary)}.`,
          "Mood action defaults to preserve. Preserve an existing mood unless the message clearly strengthens it, eases it, resolves it, or changes it. Establish only when calm and the message has a strong lasting feeling. Resolve only when the user clearly says they recovered, feel better, or were successfully comforted.",
          "Task words alone mean focused; explicit feelings override task words. Mixed positive and negative feelings are allowed. Do not explain your reasoning.",
        ].join(" "),
      });
      await requestOpenAi({
        endpoint: cfg.endpoint,
        apiKey: cfg.apiKey,
        body,
        signal: controller.signal,
        onEvent: (frame) => {
          if (!frame || frame.event !== "delta" || !frame.content || apiDecision) return;
          streamed = `${streamed}${frame.content}`.slice(-512);
          const parsed = parseEmotionDecisionResponse(streamed);
          if (!parsed) return;
          apiDecision = parsed;
          // The complete compact JSON has arrived; stop any provider tail.
          controller.abort();
        },
      });
    } catch {
      // Expected when we abort immediately after receiving a valid label, and
      // harmless when the provider times out: the provisional reaction stays.
    } finally {
      clearTimeout(timeout);
      if (emotionController === controller) emotionController = null;
    }
    let moodAction = provisionalMoodAction;
    if (apiDecision) { blend = apiDecision.blend; moodAction = apiDecision.moodAction; source = "detected"; }
    if (requestId === emotionRequestSeq) {
      try { ctx.setChatEmotion && ctx.setChatEmotion({ eventId, blend, moodAction, moodDurationMinutes }); } catch {}
      publishEmotionStatus({ phase: source, blend, moodAction });
    }
    return blend;
  }
  function localDay(now = new Date()) {
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  }
  async function generateDailyDiary(day = localDay(), force = false) {
    const config = getInferenceConfig();
    if (!isApiMode() || !config.diary_enabled) return { ok: false, skipped: true };
    const outputPath = path.join(diaryDir, `${day}.md`);
    if (!force && fs.existsSync(outputPath)) return { ok: true, skipped: true };
    let raw = "";
    try { raw = fs.readFileSync(path.join(chatHistoryDir, `${day}.jsonl`), "utf8"); } catch {}
    if (!raw.trim()) return { ok: true, skipped: true };
    const result = await remoteCompletion({
      messages: [{ role: "user", content: `Create a concise daily diary in Markdown from these chat records. Preserve durable preferences, commitments, and important context. Do not invent facts.\n\n${raw.slice(0, 14000)}` }],
      stream: false, max_tokens: 500, temperature: 0.3, top_p: 0.9, includeMemory: false,
    });
    const content = String(result && result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content || "").trim();
    if (!content) return { ok: false, error: "Empty diary response" };
    fs.mkdirSync(diaryDir, { recursive: true });
    fs.writeFileSync(outputPath, `# ${day}\n\n${content}\n`, "utf8");
    fs.writeFileSync(diaryStatePath, JSON.stringify({ generated_day: day, generated_at: new Date().toISOString() }, null, 2), "utf8");
    diaryMemoryCache.at = 0;
    return { ok: true, day };
  }
  async function catchUpDailyDiary() {
    if (!isApiMode()) return;
    let candidates = [];
    try {
      const today = localDay();
      candidates = fs.readdirSync(chatHistoryDir)
        .filter((n) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(n))
        .map((n) => n.slice(0, -6))
        .filter((day) => day < today && !fs.existsSync(path.join(diaryDir, `${day}.md`)))
        .sort();
    } catch {}
    // One catch-up per launch avoids a burst of API calls after a long break.
    const day = candidates.pop();
    if (day) await generateDailyDiary(day);
  }
  let diaryTimer = null;
  function scheduleDailyDiary() {
    if (diaryTimer) clearInterval(diaryTimer);
    diaryTimer = setInterval(() => {
      const config = getInferenceConfig();
      if (config.diary_enabled && new Date().toTimeString().slice(0, 5) === config.diary_time) {
        void generateDailyDiary().catch((err) => log(`[diary] failed: ${err && err.message || err}`));
      }
    }, 60_000);
  }

  // Bootstrap chatParams restricted to known keys so unrelated sibling
  // fields (model_dir / narration_enabled / ...) can't leak into the in-
  // memory chatParams and accidentally get echoed back on the next save.
  let chatParams = { ...DEFAULT_CHAT_PARAMS };
  {
    const raw = readMinicpmPrefsRaw();
    for (const key of CHAT_PARAM_KEYS) {
      if (Object.prototype.hasOwnProperty.call(raw, key)) chatParams[key] = raw[key];
    }
  }
  function clampChatParams(input) {
    const out = { ...chatParams };
    if (!input || typeof input !== "object") return out;
    if (Number.isFinite(input.max_new_tokens))
      out.max_new_tokens = Math.max(16, Math.min(4096, Math.floor(input.max_new_tokens)));
    if (Number.isFinite(input.temperature))
      out.temperature = Math.max(0, Math.min(2, Number(input.temperature)));
    if (Number.isFinite(input.top_p))
      out.top_p = Math.max(0.05, Math.min(1, Number(input.top_p)));
    if (Number.isFinite(input.top_k))
      out.top_k = Math.max(0, Math.min(200, Math.floor(input.top_k)));
    if (Number.isFinite(input.repetition_penalty))
      out.repetition_penalty = Math.max(1, Math.min(2, Number(input.repetition_penalty)));
    if (typeof input.thinking === "boolean") out.thinking = input.thinking;
    return out;
  }
  // Re-clamp bootstrap so a corrupt persisted value (e.g. max_new_tokens
  // outside range) doesn't ride along into runtime.
  chatParams = clampChatParams(chatParams);
  function setChatParams(input) {
    chatParams = clampChatParams(input);
    mergeMinicpmPrefs(chatParams);
    return chatParams;
  }
  function getChatParams() { return { ...chatParams }; }

  // ── Model path resolution ─────────────────────────────────────────────
  // Production: <userData>/models/<model>.gguf (downloaded by Onboarding).
  // Dev: <repo>/models/<model>.gguf (developer convenience).
  // Users can override via Settings → MiniCPM → 本地模型路径 (writes
  // minicpm-prefs.json model_dir field), or MINICPM_MODEL_DIR env at launch.
  //
  // Legacy v0.7.x onboarding wrote a HuggingFace directory path here. We
  // accept either form: if the configured path is a directory, we scan
  // it for a *.gguf inside; if it's a file, we use it as-is.
  const MODELS_SUBDIR = "models";
  function getUserDataDir() {
    try { return app.getPath("userData"); } catch { return os.tmpdir(); }
  }
  function getDefaultModelDir() {
    if (app && app.isPackaged) {
      return path.join(getUserDataDir(), MODELS_SUBDIR);
    }
    return path.resolve(appRoot, "..", MODELS_SUBDIR);
  }
  function _firstGgufIn(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      // Direct hit first
      const here = entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".gguf"))
        .map((e) => path.join(dir, e.name));
      if (here.length) return here[0];
      // One level deep (Onboarding may have nested by repo name)
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const sub = path.join(dir, e.name);
        try {
          const inner = fs.readdirSync(sub)
            .filter((n) => n.toLowerCase().endsWith(".gguf"));
          if (inner.length) return path.join(sub, inner[0]);
        } catch {}
      }
    } catch {}
    return null;
  }
  function getEffectiveModelDir() {
    if (process.env.MINICPM_MODEL_DIR) return process.env.MINICPM_MODEL_DIR;
    const raw = readMinicpmPrefsRaw();
    if (typeof raw.model_dir === "string" && raw.model_dir.trim()) {
      return raw.model_dir.trim();
    }
    return getDefaultModelDir();
  }
  function setEffectiveModelDir(dir) {
    const next = (typeof dir === "string" && dir.trim()) ? dir.trim() : undefined;
    mergeMinicpmPrefs({ model_dir: next });
    return getEffectiveModelDir();
  }
  function isModelPresent(dir) {
    const target = dir || getEffectiveModelDir();
    try {
      const st = fs.statSync(target);
      if (st.isFile()) return target.toLowerCase().endsWith(".gguf");
      if (st.isDirectory()) return _firstGgufIn(target) !== null;
    } catch {}
    return false;
  }
  function resolveCurrentGgufPath(healthJson) {
    const candidates = [];
    if (healthJson && healthJson.model_dir) candidates.push(healthJson.model_dir);
    candidates.push(getEffectiveModelDir());
    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        const st = fs.statSync(candidate);
        if (st.isFile() && candidate.toLowerCase().endsWith(".gguf")) return candidate;
        if (st.isDirectory()) {
          const gguf = _firstGgufIn(candidate);
          if (gguf) return gguf;
        }
      } catch {}
    }
    return null;
  }

  // ── Process tree RSS (Settings → 资源占用) ───────────────────────────
  async function listAllProcesses() {
    if (isWin) {
      const ps =
        "$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8; " +
        "Get-CimInstance Win32_Process | " +
        "Select-Object ProcessId,ParentProcessId,WorkingSetSize,Name,CommandLine | " +
        "ConvertTo-Json -Compress";
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-Command", ps],
        { maxBuffer: 12 * 1024 * 1024, windowsHide: true },
      );
      const parsed = JSON.parse(stdout || "[]");
      const arr = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
      return arr.map((p) => ({
        pid: Number(p.ProcessId),
        ppid: Number(p.ParentProcessId),
        rss: Math.round(Number(p.WorkingSetSize || 0) / 1024),
        cpu: 0,
        cmd: String(p.CommandLine || p.Name || ""),
      })).filter((p) => Number.isFinite(p.pid) && p.pid > 0);
    }
    const { stdout } = await execFileAsync(
      "ps",
      ["-axo", "pid=,ppid=,rss=,pcpu=,command="],
      { maxBuffer: 12 * 1024 * 1024 },
    );
    return stdout.trim().split("\n").map((line) => {
      const trimmed = line.trim();
      const m = trimmed.match(/^(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(.*)$/);
      if (!m) return null;
      return {
        pid: Number(m[1]),
        ppid: Number(m[2]),
        rss: Number(m[3]),
        cpu: parseFloat(m[4]) || 0,
        cmd: m[5] || "",
      };
    }).filter(Boolean);
  }
  function collectProcessTree(rootPid, allProcs) {
    const byPpid = new Map();
    for (const proc of allProcs) {
      if (!byPpid.has(proc.ppid)) byPpid.set(proc.ppid, []);
      byPpid.get(proc.ppid).push(proc);
    }
    const tree = [];
    const queue = [rootPid];
    const seen = new Set();
    while (queue.length) {
      const pid = queue.shift();
      if (seen.has(pid)) continue;
      seen.add(pid);
      const proc = allProcs.find((p) => p.pid === pid);
      if (proc) tree.push(proc);
      for (const child of byPpid.get(pid) || []) queue.push(child.pid);
    }
    return tree;
  }

  // ── Bubble position (side preference + drag offset) ───────────────────
  // Persisted alongside chat params in the same JSON file. The Settings
  // panel can switch the user into "edit mode" — the bubble becomes
  // window-draggable and shows sample text — and on save we capture the
  // (dx, dy) offset relative to the default placement for the chosen side.
  //
  // Schema:
  //   side: "left" | "right" | "auto"
  //   dx:   signed pixels, positive = further from the pet
  //   dy:   signed pixels, positive = downward from pet center
  //
  const BUBBLE_POS_PATH = (() => {
    try { return path.join(app.getPath("userData"), "minicpm-bubble-pos.json"); }
    catch { return path.join(os.tmpdir(), "minicpm-bubble-pos.json"); }
  })();
  // Default tuned by hand-positioning next to the actual pet sprite —
  // sits a touch closer to the body and slightly below the head so the
  // tail points at the cat's mouth instead of forehead.
  const DEFAULT_BUBBLE_POS = { side: "left", dx: -45, dy: 45 };
  let bubblePos = { ...DEFAULT_BUBBLE_POS };
  try {
    if (fs.existsSync(BUBBLE_POS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(BUBBLE_POS_PATH, "utf-8"));
      if (raw && typeof raw === "object") bubblePos = { ...DEFAULT_BUBBLE_POS, ...raw };
    }
  } catch (err) { log(`[minicpm] bubble-pos load failed: ${err && err.message}`); }
  function clampBubblePos(input) {
    const out = { ...bubblePos };
    if (!input || typeof input !== "object") return out;
    if (input.side === "left" || input.side === "right" || input.side === "auto") out.side = input.side;
    if (Number.isFinite(input.dx)) out.dx = Math.max(-2000, Math.min(2000, Math.floor(input.dx)));
    if (Number.isFinite(input.dy)) out.dy = Math.max(-2000, Math.min(2000, Math.floor(input.dy)));
    return out;
  }
  function setBubblePos(input) {
    bubblePos = clampBubblePos(input);
    try { fs.writeFileSync(BUBBLE_POS_PATH, JSON.stringify(bubblePos, null, 2), "utf-8"); }
    catch (err) { log(`[minicpm] bubble-pos save failed: ${err && err.message}`); }
    return bubblePos;
  }
  function getBubblePos() { return { ...bubblePos }; }
  // True while the Settings panel has the bubble in "drag-to-position"
  // mode. Position writes (and the auto-hide / dwell logic) are paused
  // while this is true.
  let bubbleEditing = false;

  // ── Narration (model reacts to coding-agent events) ──────────────────────
  // Persisted under `narration_enabled` in minicpm-prefs.json so the user's
  // choice survives restart. Default true keeps the previous dev behaviour
  // when the key is missing (first launch after upgrade, fresh install).
  let narrationEnabled = (() => {
    const raw = readMinicpmPrefsRaw();
    return typeof raw.narration_enabled === "boolean" ? raw.narration_enabled : true;
  })();
  const NARRATE_THROTTLE_MS = 10_000;     // gap between any two narrations
  const SESSION_DEDUP_MS = 5_000;         // ignore repeats for the same session
  const QUEUED_EVENT_MAX_AGE_MS = 60_000; // drop stale queued events after chat ends
  // Events worth narrating. Anything else is dropped.
  const NARRATE_EVENTS = new Set(["Stop", "StopFailure", "Notification"]);
  // Skip when the event came from us (the chat sidecar pushes states too).
  const NARRATE_IGNORE_SESSION_PREFIX = "minicpm-";

  let lastNarrateAt = 0;
  let lastSessionAt = new Map(); // session_id -> timestamp
  // FIFO queue of events to narrate sequentially. Multiple windows
  // (different sessions) finishing close together each get their turn
  // instead of being deduplicated away. Max length keeps us from
  // chaining narrations forever if user steps away.
  const QUEUE_MAX = 5;
  let queuedEvents = [];        // [{ data, queuedAt }, ...]
  let narrating = false;

  function getPetBoundsSafe() {
    // Prefer the hit-rect (visible sprite) over the pet window — the
    // window has large transparent margins, anchoring to it makes the
    // bubble float far from the actual character.
    try {
      const hit = ctx.getPetHitRect && ctx.getPetHitRect();
      if (hit && Number.isFinite(hit.width) && hit.width > 0) {
        return { x: Math.round(hit.x), y: Math.round(hit.y), width: Math.round(hit.width), height: Math.round(hit.height) };
      }
    } catch {}
    try { return ctx.getPetWindowBounds && ctx.getPetWindowBounds(); } catch { return null; }
  }

  function getWorkAreaForPet(pb) {
    if (typeof ctx.getNearestWorkArea === "function" && pb) {
      try { return ctx.getNearestWorkArea(pb.x + pb.width / 2, pb.y + pb.height / 2); } catch {}
    }
    return screen.getPrimaryDisplay().workArea;
  }

  function chooseAndApplyBounds(width, height, { keepSide = false } = {}) {
    if (!bubble || bubble.isDestroyed()) return;
    const pb = getPetBoundsSafe();
    const wa = pb ? getWorkAreaForPet(pb) : screen.getPrimaryDisplay().workArea;
    if (pb) {
      // When the pet has moved (drag end / repos call) we re-pick the
      // best side so the bubble doesn't end up clamped over the pet's
      // sprite. `keepSide` is used during the same logical "show" so
      // size changes (e.g. ask → speak) don't flip sides mid-conversation.
      if (!keepSide || !activeSide) activeSide = pickSide(pb, wa, width, height, bubblePos.side);
      const opts = chatAnchorBottomY !== null
        ? { verticalAnchor: "bottom", anchorBottomY: chatAnchorBottomY }
        : {};
      opts.offsetDx = bubblePos.dx;
      opts.offsetDy = bubblePos.dy;
      const bounds = computeBubbleBoundsForSide(activeSide, pb, wa, width, height, opts);
      bubble.setBounds(bounds);
    } else {
      bubble.setBounds({
        x: Math.round((wa.width - width) / 2),
        y: Math.round((wa.height - height) / 2),
        width, height,
      });
    }
  }

  function reposition() {
    if (!bubble || bubble.isDestroyed() || !bubble.isVisible()) return;
    const { width, height } = bubble.getBounds();
    // During pet drag we keep recomputing on every move tick; let the
    // bubble re-pick side as the pet crosses regions so it never overlaps.
    chooseAndApplyBounds(width, height, { keepSide: false });
  }

  // Pet-drag awareness: hide the bubble while user is dragging the pet
  // (continuous reposition during drag is jittery and visually noisy);
  // restore it cleanly after the drop with a fresh side pick.
  let petDragging = false;
  let bubbleHiddenForDrag = false;
  function setPetDragging(v) {
    const wasDragging = petDragging;
    petDragging = !!v;
    if (!bubble || bubble.isDestroyed()) return;
    if (petDragging && !wasDragging && bubble.isVisible()) {
      // Drag started → fade away, remember to restore on drop.
      bubbleHiddenForDrag = true;
      try { bubble.hide(); } catch {}
    } else if (!petDragging && wasDragging && bubbleHiddenForDrag) {
      // Drag ended → re-show on the now-best side.
      bubbleHiddenForDrag = false;
      const { width, height } = bubble.getBounds();
      chooseAndApplyBounds(width, height, { keepSide: false });
      try { bubble.showInactive(); } catch {}
    }
  }

  function createBubble() {
    const pb = getPetBoundsSafe() || { x: 200, y: 200, width: 280, height: 280 };
    const wa = getWorkAreaForPet(pb);
    activeSide = pickSide(pb, wa, ASK_WIDTH, ASK_HEIGHT, bubblePos.side);
    const initial = computeBubbleBoundsForSide(activeSide, pb, wa, ASK_WIDTH, ASK_HEIGHT, {
      offsetDx: bubblePos.dx, offsetDy: bubblePos.dy,
    });

    bubble = new BrowserWindow({
      ...initial,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      show: false,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: true,
      ...(isLinux ? { type: LINUX_WINDOW_TYPE } : {}),
      ...(isMac ? { type: "panel" } : {}),
      webPreferences: {
        preload: path.join(PRELOAD_ROOT, "preload-minicpm-chat.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    if (isWin) bubble.setAlwaysOnTop(true, WIN_TOPMOST_LEVEL);
    if (isMac) {
      try { bubble.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}
    }
    bubble.setMenuBarVisibility(false);
    // Bypass any cached HTML so code changes always take effect.
    bubble.webContents.session.clearCache();
    bubble.loadFile(path.join(__dirname, "minicpm-chat.html"));

    bubble.webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown" && input.key === "Escape") {
        // Renderer treats Esc itself; this is just a safety net.
        try { bubble.hide(); } catch {}
        event.preventDefault();
      }
    });
    bubble.on("closed", () => {
      try { discardScreenCapturesForSender(bubble.webContents.id); } catch {}
      bubble = null;
    });

    return bubble;
  }

  function ensureBubble() {
    if (!bubble || bubble.isDestroyed()) createBubble();
    return bubble;
  }

  async function open() {
    ensureBubble();
    // Re-pick the side based on the current pet position each time we open.
    const pb = getPetBoundsSafe();
    const wa = pb ? getWorkAreaForPet(pb) : screen.getPrimaryDisplay().workArea;
    activeSide = pb ? pickSide(pb, wa, ASK_WIDTH, ASK_HEIGHT, bubblePos.side) : (bubblePos.side === "left" ? "left" : "right");
    if (pb) {
      bubble.setBounds(computeBubbleBoundsForSide(activeSide, pb, wa, ASK_WIDTH, ASK_HEIGHT, {
        offsetDx: bubblePos.dx, offsetDy: bubblePos.dy,
      }));
    }
    if (!bubble.isVisible()) bubble.show();
    bubble.focus();
    bubbleShown = true;
    bubble.webContents.send("minicpm:cmd-open", { side: activeSide });
    // Fire a 1-token warmup so the model weights are paged back into RAM
    // by the time the user finishes typing. Throttled — repeated opens
    // within 30s don't re-warm (model is still hot).
    void maybeWarmup();
  }

  // ── Warmup ping ────────────────────────────────────────────────────────
  // macOS pages out the model's memory after the sidecar has been idle
  // for a few minutes; the first request then takes 1-3s instead of
  // 0.1s. We fire `/api/warmup` on every bubble open. The endpoint runs
  // a 1-token greedy forward (~50-200ms hot, ~1-2s cold) which faults
  // the weights back in so the user's actual chat call is fast.
  let lastWarmupAt = 0;
  const WARMUP_GAP_MS = 30_000;  // 30s — covers fast re-opens / multi-turn chat
  async function maybeWarmup() {
    if (isApiMode()) return;
    const now = Date.now();
    if (now - lastWarmupAt < WARMUP_GAP_MS) return;
    lastWarmupAt = now;
    try {
      // 5s timeout — plenty for cold start, won't pile up if sidecar is slow.
      await httpJson("POST", `${sidecar.baseUrl()}/api/warmup`, {}, 5000);
    } catch (err) {
      log(`[minicpm] warmup ping failed: ${err && err.message || err}`);
    }
  }

  function toggle() {
    if (bubble && !bubble.isDestroyed() && bubble.isVisible()) {
      bubble.webContents.send("minicpm:cmd-dismiss");
      return;
    }
    open();
  }

  function dismiss() {
    if (bubble && !bubble.isDestroyed()) bubble.webContents.send("minicpm:cmd-dismiss");
  }

  function toggleThinking() {
    // The renderer owns the flag; we just nudge it to flip and toast.
    // If the bubble doesn't exist yet, ensure it does so the listener attaches.
    ensureBubble();
    bubble.webContents.send("minicpm:cmd-toggle-thinking");
  }

  function shutdown() {
    shuttingDown = true;
    if (diaryTimer) clearInterval(diaryTimer);
    if (emotionController) emotionController.abort();
    emotionController = null;
    if (emotionStatusRefreshTimer) clearTimeout(emotionStatusRefreshTimer);
    emotionStatusRefreshTimer = null;
    sidecar.stop();
    if (bubble && !bubble.isDestroyed()) bubble.destroy();
    bubble = null;
    if (workspace && !workspace.isDestroyed()) workspace.destroy();
    workspace = null;
  }

  // ── Narration logic ─────────────────────────────────────────────────────
  // Score how "rich" an event is for narration. Higher is better.
  // We use this to pick the best of multiple events that fire for the
  // same logical conversation (Cursor + Claude Code hooks both fire on
  // Cursor's stop, but only the cursor-agent variant has session_title
  // and last_summary populated by the hook's transcript parser).
  function eventRichness(data) {
    let s = 0;
    if (typeof data.session_title === "string" && data.session_title.trim()) s += 10;
    if (typeof data.last_summary === "string" && data.last_summary.trim()) s += 10;
    if (typeof data.assistant_last_output === "string" && data.assistant_last_output.trim()) s += 10;
    if (data.agent_id === "cursor-agent") s += 1;  // tie-breaker
    return s;
  }

  // Per-session merge buffer: when an event arrives, hold it for
  // EVENT_MERGE_MS waiting for a sibling event for the same session
  // (e.g., Cursor's claude-code companion). Whichever has the richer
  // context wins. Without this, the claude-code event arrives ~ms
  // earlier and gets dispatched with empty title/summary, giving us
  // generic "主人刚写完一轮代码" prompts.
  const EVENT_MERGE_MS = 700;
  const eventBuffers = new Map();  // sessionId → { data, score, timer }

  function onStateEvent(data) {
    if (!narrationEnabled) return;
    if (bubbleEditing) return;  // Don't intrude while the user is positioning the bubble.
    if (!data || typeof data !== "object") return;
    const event = String(data.event || "");
    const sessionId = String(data.session_id || "");
    if (!NARRATE_EVENTS.has(event)) return;
    if (sessionId.startsWith(NARRATE_IGNORE_SESSION_PREFIX)) return;

    const now = Date.now();
    // Per-session "already dispatched" gate (5s after final commit).
    const last = lastSessionAt.get(sessionId);
    if (last && (now - last) < SESSION_DEDUP_MS) {
      log(`[narrator] drop: session ${sessionId.slice(0,8)} dedup ${now - last}ms`);
      return;
    }

    const score = eventRichness(data);
    const buf = eventBuffers.get(sessionId);
    if (buf) {
      // Already buffered — keep whichever has more context.
      if (score > buf.score) {
        log(`[narrator] merge: session ${sessionId.slice(0,8)} replace agent=${buf.data.agent_id}→${data.agent_id} (score ${buf.score}→${score})`);
        buf.data = data;
        buf.score = score;
      } else {
        log(`[narrator] merge: session ${sessionId.slice(0,8)} keep agent=${buf.data.agent_id} (score ${buf.score} ≥ ${score})`);
      }
      return;
    }

    // First event for this session — start the merge window.
    log(`[narrator] buffer: event=${event} session=${sessionId.slice(0,8)} agent=${data.agent_id} score=${score} (waiting ${EVENT_MERGE_MS}ms for siblings)`);
    eventBuffers.set(sessionId, {
      data,
      score,
      timer: setTimeout(() => commitBufferedEvent(sessionId), EVENT_MERGE_MS),
    });
  }

  function commitBufferedEvent(sessionId) {
    const buf = eventBuffers.get(sessionId);
    if (!buf) return;
    eventBuffers.delete(sessionId);
    const data = buf.data;
    const event = String(data.event || "");
    const now = Date.now();
    lastSessionAt.set(sessionId, now);

    if (bubbleShown) {
      enqueueEvent(data, now, "bubble-visible");
      return;
    }
    if ((now - lastNarrateAt) < NARRATE_THROTTLE_MS) {
      enqueueEvent(data, now, "throttled");
      return;
    }
    if (narrating) {
      enqueueEvent(data, now, "narrating");
      return;
    }
    log(`[narrator] accept event=${event} session=${sessionId.slice(0,8)} agent=${data.agent_id} score=${buf.score}`);
    void dispatchNarration(data);
  }

  function enqueueEvent(data, now, reason) {
    // De-dupe against anything already in the queue with the same session.
    queuedEvents = queuedEvents.filter(q => String(q.data.session_id || "") !== String(data.session_id || ""));
    queuedEvents.push({ data, queuedAt: now });
    while (queuedEvents.length > QUEUE_MAX) queuedEvents.shift();  // drop oldest
    log(`[narrator] enqueue (${reason}): event=${data.event} session=${String(data.session_id||"").slice(0,8)} queue=${queuedEvents.length}/${QUEUE_MAX}`);
  }

  function buildNarrationPrompt(data) {
    const cwdName = (() => {
      const c = String(data.cwd || "");
      const parts = c.split("/").filter(Boolean);
      return parts.length ? parts[parts.length - 1] : "";
    })();
    const niceCwd = cwdName && !cwdName.startsWith("tmp.") ? cwdName : "";
    const isCursor = data.agent_id === "cursor-agent";
    // Two pieces of context populated by the hook script:
    //   title       : conversation topic (first user message)
    //   summary     : what AI did/said in the last reply (truncated)
    const title = typeof data.session_title === "string" && data.session_title.trim()
      ? data.session_title.trim()
      : "";
    const rawSummary = typeof data.last_summary === "string" && data.last_summary.trim()
      ? data.last_summary.trim()
      : (typeof data.assistant_last_output === "string" && data.assistant_last_output.trim()
          ? data.assistant_last_output.trim()
          : "");
    // Cap the summary so system prompt + user prompt + generation stay
    // within the model's 4096-token context window.  System prompt ≈ 700
    // tokens, event template ≈ 75, max_new_tokens = 50 → budget for
    // summary text ≈ 3200 tokens.  At ~1.5 tokens/CJK char (worst case)
    // that's ~2100 chars; use 800 to leave a comfortable margin.
    const SUMMARY_CHAR_LIMIT = 800;
    const summary = rawSummary.length > SUMMARY_CHAR_LIMIT
      ? rawSummary.slice(0, SUMMARY_CHAR_LIMIT) + "…"
      : rawSummary;

    // Build the event description in the user's UI language. The
    // narration system prompt + situation templates live in
    // `minicpm-i18n.js` so non-Chinese users get prompts the model can
    // actually narrate in.
    const lang = getLang();
    const narration = minicpmI18n.getNarration(lang);
    const subject = title
      ? minicpmI18n.makeTranslator(() => lang, minicpmI18n.NARRATION)("subjectQuoted", { title })
      : (niceCwd
          ? minicpmI18n.makeTranslator(() => lang, minicpmI18n.NARRATION)("subjectFromCwd", { cwd: niceCwd })
          : "");
    const tnar = minicpmI18n.makeTranslator(() => lang, minicpmI18n.NARRATION);
    let situation;
    if (data.event === "StopFailure") {
      situation = subject
        ? tnar("eventStopFailureWithSubject", { subject })
        : tnar("eventStopFailureNoSubject");
    } else if (data.event === "Notification") {
      situation = subject
        ? tnar("eventNotificationWithSubject", { subject })
        : tnar("eventNotificationNoSubject");
    } else {
      situation = subject
        ? tnar("eventStopWithSubject", { subject })
        : tnar("eventStopNoSubject");
    }
    if (summary) {
      situation += tnar("eventLastSaid", { summary });
    }

    // Narration always runs the base model (`disable_adapter: true`) so
    // the persona LoRA doesn't bias output toward cuteness over info
    // density.
    return {
      system: narration.systemPrompt,
      user: `事件:${situation}\n回复:`,
    };
  }

  async function dispatchNarration(data) {
    narrating = true;
    lastNarrateAt = Date.now();
    try {
      const prompt = buildNarrationPrompt(data);
      log(`[narrator] dispatch event=${data.event} agent=${data.agent_id} prompt=${JSON.stringify(prompt.user)}`);
      let text = "";
      if (isApiMode()) {
        const result = await remoteCompletion({
          messages: [{ role: "user", content: prompt.user }], system: prompt.system,
          stream: false, max_tokens: 50, temperature: 0.7, top_p: 0.9,
        });
        text = String(result && result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content || "").trim();
      } else {
        const r = await httpJson("POST", `${sidecar.baseUrl()}/api/chat`, {
          messages: [{ role: "user", content: prompt.user }], system: prompt.system,
          stream: false, max_new_tokens: 50, thinking: false, temperature: 0.7,
          top_p: 0.9, repetition_penalty: 1.15, silent: true, disable_adapter: true,
        }, 30000);
        text = (r.json && (r.json.content || "")).trim();
      }
      // Strip "回复：" prefix the few-shot format may leak.
      text = text.replace(/^(回复[:：]\s*)/, "");
      // First line only — multi-line responses become "thoughts" we don't
      // want to drop into a small bubble.
      text = text.split(/\r?\n/)[0].trim();
      // Strip surrounding quote characters (some models love quoting the reply).
      text = text.replace(/^[「『"']+|[」』"']+$/g, "").trim();
      // Cap to first sentence + ≤50 chars total. Rich enough to convey a
      // concrete result, short enough to fit the bubble at one glance.
      const firstStop = text.search(/[。！？!?]/);
      if (firstStop > 0 && firstStop < text.length - 1) text = text.slice(0, firstStop + 1);
      if (text.length > 50) text = text.slice(0, 49) + "…";
      if (!text) {
        log("[narrator] empty reply, skipping");
        return;
      }
      log(`[narrator] reply: ${text}`);
      ensureBubble();
      reposition();
      bubble.webContents.send("minicpm:narrate", { text, kind: data.event, agent: data.agent_id });
      bubble.showInactive();
      bubbleShown = true;
      // Drive the dwell + hide from the main process so it doesn't rely on
      // the renderer's setTimeout (Chromium can throttle timers in hidden
      // panel windows on macOS, which leaves the bubble pinned).
      const dwellMs = Math.max(4000, Math.min(9000, 2400 + text.length * 130));
      setTimeout(() => {
        if (!bubble || bubble.isDestroyed()) return;
        try { bubble.hide(); } catch {}
        bubbleShown = false;
        log(`[narrator] hidden after dwell=${dwellMs}ms`);
        // Replay any queued event that arrived while we were narrating.
        flushQueuedEventIfStale();
      }, dwellMs + 220);
    } catch (err) {
      log(`[narrator] failed: ${err && err.message || err}`);
    } finally {
      narrating = false;
      // Fire next queued event after a short breather (still respects
      // throttle/bubble-visible checks via onStateEvent → eventBuffers).
      // Drop stale entries while we're at it.
      pruneStaleQueue();
      const q = queuedEvents.shift();
      if (q) {
        setTimeout(() => onStateEvent(q.data), 1500);
      }
    }
  }

  function setNarrationEnabled(value) {
    const next = !!value;
    if (narrationEnabled !== next) {
      narrationEnabled = next;
      mergeMinicpmPrefs({ narration_enabled: narrationEnabled });
    }
    return narrationEnabled;
  }
  function isNarrationEnabled() { return narrationEnabled; }

  function pruneStaleQueue() {
    const now = Date.now();
    queuedEvents = queuedEvents.filter(q => (now - q.queuedAt) < QUEUED_EVENT_MAX_AGE_MS);
  }

  // When the user closes the chat bubble, drain the queue (oldest first,
  // staggered) so the conversations they missed each get a turn.
  function flushQueuedEventIfStale() {
    pruneStaleQueue();
    const q = queuedEvents.shift();
    if (!q) return;
    onStateEvent(q.data);
  }

  // Eagerly start the Python sidecar in the background so the model and
  // MPS kernels are ready by the time the user clicks the pet. Also probes
  // for a newer model revision once the sidecar is healthy.
  async function warmup() {
    if (isApiMode()) return;
    try {
      log("[minicpm-chat] warming up sidecar in background…");
      // Pass the user-effective model dir so the sidecar's `--model` flag
      // tracks Settings changes / Onboarding downloads without restart.
      const r = await sidecar.ensureRunning(getEffectiveModelDir());
      log(`[minicpm-chat] sidecar warmup ${r.status}`);
      void refreshUpdateStatus();
      void refreshPersona();
    } catch (err) {
      log(`[minicpm-chat] sidecar warmup failed: ${err && err.message || err}`);
    }
  }

  async function refreshUpdateStatus() {
    const status = await sidecar.checkUpdate();
    if (!status) return null;
    updateStatus = status;
    log(`[minicpm-chat] update check: local=${status.local_revision || "?"} remote=${status.remote_revision || "?"} available=${status.available}`);
    if (status.available && bubble && !bubble.isDestroyed()) {
      bubble.webContents.send("minicpm:update-status", status);
    }
    return status;
  }

  async function refreshPersona() {
    try {
      const r = await httpJson("GET", `${sidecar.baseUrl()}/api/health`, null, 1500);
      if (r.json && r.json.persona) {
        if (r.json.persona !== activePersona) {
          activePersona = r.json.persona;
          log(`[minicpm-chat] persona = ${activePersona}${r.json.adapter ? " (adapter: " + r.json.adapter + ")" : ""}`);
        }
      }
    } catch {}
  }

  function getUpdateStatus() { return updateStatus; }

  async function applyUpdate(onProgress) {
    // Stream SSE progress back so callers can drive a UI.
    return new Promise((resolve) => {
      const u = new URL(`${sidecar.baseUrl()}/api/update-apply`);
      const req = http.request({
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname,
        method: "POST",
        headers: { "content-type": "application/json", "content-length": 0 },
        timeout: 0,
      }, (res) => {
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          buf += chunk;
          let idx;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            if (!block.startsWith("data:")) continue;
            try {
              const ev = JSON.parse(block.slice(5).trim());
              try { onProgress && onProgress(ev); } catch {}
            } catch {}
          }
        });
        res.on("end", () => resolve({ ok: true }));
      });
      req.on("error", (err) => resolve({ ok: false, error: err.message }));
      req.end();
    });
  }

  // ── Context menu (right-click on bubble) ───────────────────────────────

  async function openContextMenu() {
    const m = await sidecar.listModels();
    const items = [];
    if (m && Array.isArray(m.items) && m.items.length) {
      for (const item of m.items) {
        items.push({
          label: item.name,
          type: "checkbox",
          checked: item.path === m.current,
          click: async () => {
            if (item.path === m.current) return;
            bubble.webContents.send("minicpm:cmd-dismiss");
            await sidecar.loadModel(item.path);
            // Re-open in ask mode after model swap so the user can ask the
            // newly loaded model right away.
            await open();
          },
        });
      }
    } else {
      items.push({ label: "(未发现模型)", enabled: false });
    }
    items.push({ type: "separator" });

    const updLabel = updateStatus
      ? (updateStatus.available
          ? `● 新版本可用: ${updateStatus.remote_revision} → 立即更新`
          : `已是最新 (${updateStatus.local_revision || "?"})`)
      : "检查模型更新";
    items.push({
      label: updLabel,
      enabled: !(updateStatus && updateStatus.busy),
      click: async () => {
        if (updateStatus && updateStatus.available) {
          // Trigger apply with progress, surfacing through the bubble.
          if (bubble && !bubble.isDestroyed()) {
            bubble.webContents.send("minicpm:update-applying", { phase: "start" });
          }
          await applyUpdate((ev) => {
            if (bubble && !bubble.isDestroyed()) {
              bubble.webContents.send("minicpm:update-applying", ev);
            }
          });
          await refreshUpdateStatus();
        } else {
          await refreshUpdateStatus();
          if (bubble && !bubble.isDestroyed()) {
            bubble.webContents.send("minicpm:update-status", updateStatus);
          }
        }
      },
    });

    items.push({ type: "separator" });
    items.push({
      label: `桌宠旁白 (Stop / 错误时吐槽)`,
      type: "checkbox",
      checked: narrationEnabled,
      click: (it) => { setNarrationEnabled(!!it.checked); },
    });
    items.push({ type: "separator" });
    items.push({
      label: "清空对话历史",
      click: () => { if (bubble && !bubble.isDestroyed()) bubble.webContents.send("minicpm:cmd-reset"); },
    });
    items.push({
      label: "关闭气泡",
      click: () => dismiss(),
    });

    const menu = Menu.buildFromTemplate(items);
    if (bubble && !bubble.isDestroyed()) menu.popup({ window: bubble });
  }

  // ── Full chat workspace ───────────────────────────────────────────────
  const DATE_ID_RE = /^\d{4}-\d{2}-\d{2}$/;
  let sharedSession = { date: localDay(), messages: [], generating: false, requestId: null };
  let sharedSessionController = null;
  let workspaceConnectionState = "configured";

  function readHistoryLines(day) {
    if (!DATE_ID_RE.test(String(day || ""))) return [];
    let raw = "";
    try { raw = fs.readFileSync(path.join(chatHistoryDir, `${day}.jsonl`), "utf8"); } catch { return []; }
    return raw.split(/\r?\n/).filter(Boolean);
  }

  function readHistoryPage(day, before, requestedLimit = 100) {
    const lines = readHistoryLines(day);
    return paginateHistoryLines(day, lines, before, requestedLimit);
  }

  function readHistoryContext(day) {
    const lines = readHistoryLines(day);
    const start = Math.max(0, lines.length - 240);
    return parseHistoryLines(day, lines.slice(start), start);
  }

  sharedSession.messages = readHistoryContext(sharedSession.date);

  function publicSharedSession() {
    return {
      date: sharedSession.date,
      generating: sharedSession.generating,
      connectionState: workspaceConnectionState,
      // Rendering starts with the latest page; the model still keeps the
      // larger 240-message context and older display pages load on demand.
      messages: sharedSession.messages.slice(-100).map((message) => ({ ...message })),
    };
  }

  function broadcastSharedSession() {
    const snapshot = publicSharedSession();
    if (workspace && !workspace.isDestroyed()) workspace.webContents.send("chat-workspace:session", snapshot);
    if (bubble && !bubble.isDestroyed()) bubble.webContents.send("minicpm:shared-session", snapshot);
  }

  function listDatedFiles(directory, extension) {
    try {
      return fs.readdirSync(directory)
        .filter((name) => DATE_ID_RE.test(name.slice(0, -extension.length)) && name.endsWith(extension))
        .map((name) => name.slice(0, -extension.length)).sort().reverse();
    } catch { return []; }
  }

  function getWorkspaceBounds() {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const area = display.workArea;
    const width = Math.max(960, Math.round(area.width * 0.82));
    const height = Math.max(680, Math.round(area.height * 0.82));
    return {
      x: Math.round(area.x + (area.width - width) / 2),
      y: Math.round(area.y + (area.height - height) / 2),
      width: Math.min(width, area.width), height: Math.min(height, area.height),
    };
  }

  function adaptWorkspaceLive2dConfig(input) {
    const config = input && typeof input === "object" ? input : {};
    const live2d = config.live2d && typeof config.live2d === "object" ? config.live2d : null;
    if (!live2d) return config;
    return {
      ...config,
      live2d: {
        ...live2d,
        // Desktop transforms are intentionally not reused in the workspace.
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        workspaceScale: Number.isFinite(live2d.workspaceScale) ? live2d.workspaceScale : 1,
        workspaceOffsetY: Number.isFinite(live2d.workspaceOffsetY) ? live2d.workspaceOffsetY : 0,
        workspaceFraming: "head-to-knees",
      },
    };
  }

  function ensureWorkspace() {
    if (workspace && !workspace.isDestroyed()) return workspace;
    const desktopThemeConfig = typeof ctx.getPetRendererConfig === "function" ? ctx.getPetRendererConfig() : {};
    const themeConfig = adaptWorkspaceLive2dConfig(desktopThemeConfig);
    workspace = new BrowserWindow({
      ...getWorkspaceBounds(), minWidth: 900, minHeight: 620, show: false,
      title: "TsukuMate 对话", backgroundColor: "#101115", autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(PRELOAD_ROOT, "preload-chat-workspace.js"),
        contextIsolation: true, nodeIntegration: false, sandbox: true,
        additionalArguments: [`--theme-config=${JSON.stringify(themeConfig)}`],
      },
    });
    workspace.loadFile(path.join(__dirname, "chat-workspace.html"));
    workspaceSenderId = workspace.webContents.id;
    workspace.webContents.once("did-finish-load", () => {
      broadcastSharedSession();
      try { workspace.webContents.send("theme-config", themeConfig); } catch {}
      try { workspace.webContents.send("state-change", typeof ctx.getCurrentState === "function" ? ctx.getCurrentState() : "idle"); } catch {}
      try { workspace.webContents.send("chat-emotion", ctx.getChatEmotion && ctx.getChatEmotion()); } catch {}
    });
    workspace.on("closed", () => {
      try { if (workspaceSenderId != null) discardScreenCapturesForSender(workspaceSenderId); } catch {}
      workspaceSenderId = null;
      workspace = null;
      if (!shuttingDown && !workspacePetWasHidden && typeof ctx.setPetHidden === "function") ctx.setPetHidden(false);
      workspacePetWasHidden = false;
    });
    return workspace;
  }

  function openWorkspace() {
    if (workspace && !workspace.isDestroyed()) { workspace.show(); workspace.focus(); return true; }
    workspacePetWasHidden = typeof ctx.isPetHidden === "function" ? !!ctx.isPetHidden() : false;
    if (quickWorkspaceHideBubble()) void 0;
    if (typeof ctx.hideQuickLauncher === "function") ctx.hideQuickLauncher();
    if (typeof ctx.setPetHidden === "function") ctx.setPetHidden(true);
    const target = ensureWorkspace(); target.show(); target.focus();
    return true;
  }

  function quickWorkspaceHideBubble() {
    if (!bubble || bubble.isDestroyed() || !bubble.isVisible()) return false;
    try { bubble.hide(); } catch {}
    bubbleShown = false;
    return true;
  }

  async function sendWorkspaceMessage(text, screenCaptureToken, senderId) {
    const clean = String(text || "").trim().slice(0, 16000);
    if (!clean) return { ok: false, error: "消息不能为空" };
    if (sharedSession.generating) return { ok: false, error: "上一条回复仍在生成" };
    const screenImageDataUrl = screenCaptureToken ? takeScreenCapture(screenCaptureToken, senderId) : null;
    if (screenCaptureToken && !screenImageDataUrl) return { ok: false, error: tr("chatScreenCaptureExpired") };
    const user = { id: `user-${Date.now()}`, role: "user", content: clean, timestamp: new Date().toISOString() };
    const assistant = { id: `assistant-${Date.now()}`, role: "assistant", content: "", timestamp: new Date().toISOString(), streaming: true };
    sharedSession.messages.push(user, assistant);
    if (sharedSession.messages.length > 240) sharedSession.messages.splice(0, sharedSession.messages.length - 240);
    sharedSession.generating = true;
    appendChatHistory({ ...user, date: sharedSession.date });
    broadcastSharedSession();
    const controller = new AbortController(); sharedSessionController = controller;
    void classifyChatEmotion(sharedSession.messages, user.id).catch(() => {});
    setImmediate(async () => {
      try {
        await remoteCompletion({ messages: sharedSession.messages.filter((m) => !m.streaming).map(({ role, content }) => ({ role, content })), screenImageDataUrl, stream: true }, (frame) => {
          if (frame && frame.event === "delta") {
            assistant.content += String(frame.content || frame.reasoning_content || "");
            broadcastSharedSession();
          }
        }, controller.signal);
        assistant.streaming = false;
        workspaceConnectionState = "available";
        if (assistant.content.trim()) appendChatHistory({ ...assistant, date: sharedSession.date });
      } catch (error) {
        assistant.streaming = false;
        assistant.error = true;
        workspaceConnectionState = "error";
        assistant.content = assistant.content || `请求失败：${localizeError(error)}`;
      } finally {
        sharedSession.generating = false; sharedSessionController = null; broadcastSharedSession();
      }
    });
    return { ok: true };
  }

  // ── IPC ───────────────────────────────────────────────────────────────

  const handlers = {
    "chat-workspace:get-session": async (event) => isWorkspaceSender(event.sender) ? publicSharedSession() : null,
    "chat-workspace:get-connection-status": async (event) => {
      if (!isWorkspaceSender(event.sender)) return { configured: false, state: "error" };
      const config = getInferenceConfig();
      const configured = !!(config.api_endpoint && config.api_model);
      return { configured, state: configured ? workspaceConnectionState : "unconfigured" };
    },
    "chat-workspace:send": async (event, payload = {}) => isWorkspaceSender(event.sender)
      ? sendWorkspaceMessage(payload.text, payload.screenCaptureToken, event.sender.id)
      : { ok: false, error: "Invalid workspace sender" },
    "chat-workspace:cancel": async (event) => {
      if (!isWorkspaceSender(event.sender)) return { ok: false };
      if (sharedSessionController) sharedSessionController.abort();
      return { ok: true };
    },
    "chat-workspace:screen-list": async (event) => {
      if (!isWorkspaceSender(event.sender)) return { ok: false, error: "Invalid workspace sender" };
      try { return { ok: true, sources: await screenCapture.list() }; }
      catch (error) { return { ok: false, error: screenCaptureErrorMessage(error), permissionRequired: screenCaptureNeedsPermission(error) }; }
    },
    "chat-workspace:screen-take": async (event, payload = {}) => {
      if (!isWorkspaceSender(event.sender)) return { ok: false, error: "Invalid workspace sender" };
      try { return { ok: true, ...storeScreenCapture(event.sender.id, await screenCapture.capture(payload.sourceId)) }; }
      catch (error) { return { ok: false, error: screenCaptureErrorMessage(error), permissionRequired: screenCaptureNeedsPermission(error) }; }
    },
    "chat-workspace:screen-discard": async (event, payload = {}) => ({
      ok: isWorkspaceSender(event.sender) && discardScreenCapture(payload.token, event.sender.id),
    }),
    "chat-workspace:screen-settings": async (event) => {
      if (!isWorkspaceSender(event.sender) || !isMac) return { ok: false };
      try {
        await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
        return { ok: true };
      } catch { return { ok: false }; }
    },
    "chat-workspace:reload-live2d": async (event) => {
      if (!isWorkspaceSender(event.sender)) return { ok: false };
      const base = typeof ctx.getPetRendererConfig === "function" ? ctx.getPetRendererConfig() : {};
      const config = adaptWorkspaceLive2dConfig(base);
      if (config.live2d) config.live2d = { ...config.live2d, reloadToken: Date.now() };
      event.sender.send("theme-config", config);
      return { ok: true };
    },
    "chat-workspace:list-history": async (event) => isWorkspaceSender(event.sender)
      ? { ok: true, dates: Array.from(new Set([sharedSession.date, localDay(), ...listDatedFiles(chatHistoryDir, ".jsonl")])).sort().reverse() }
      : { ok: false, dates: [] },
    "chat-workspace:load-history": async (event, payload = {}) => {
      if (!isWorkspaceSender(event.sender) || !DATE_ID_RE.test(String(payload.date || ""))) return { ok: false, error: "Invalid date" };
      const switchingDate = payload.date !== sharedSession.date && (payload.before == null || payload.before === "");
      if (switchingDate && sharedSession.generating) return { ok: false, error: "请先停止当前回复" };
      if (switchingDate) {
        sharedSession = { date: payload.date, messages: readHistoryContext(payload.date), generating: false, requestId: null };
        broadcastSharedSession();
      }
      return { ok: true, date: payload.date, ...readHistoryPage(payload.date, payload.before, payload.limit) };
    },
    "chat-workspace:list-diaries": async (event) => isWorkspaceSender(event.sender)
      ? { ok: true, dates: Array.from(new Set([localDay(), ...listDatedFiles(diaryDir, ".md")])).sort().reverse() }
      : { ok: false, dates: [] },
    "chat-workspace:load-diary": async (event, payload = {}) => {
      if (!isWorkspaceSender(event.sender) || !DATE_ID_RE.test(String(payload.date || ""))) return { ok: false, error: "Invalid date" };
      try { return { ok: true, date: payload.date, content: fs.readFileSync(path.join(diaryDir, `${payload.date}.md`), "utf8") }; }
      catch (error) {
        if (error && error.code === "ENOENT") return { ok: true, date: payload.date, content: `# ${payload.date}\n\n` };
        return { ok: false, error: String(error && error.message || error) };
      }
    },
    "chat-workspace:save-diary": async (event, payload = {}) => {
      if (!isWorkspaceSender(event.sender) || !DATE_ID_RE.test(String(payload.date || ""))) return { ok: false, error: "Invalid date" };
      const content = typeof payload.content === "string" ? payload.content.slice(0, 200000) : "";
      try {
        fs.mkdirSync(diaryDir, { recursive: true });
        const target = path.join(diaryDir, `${payload.date}.md`); const temp = `${target}.tmp-${process.pid}`;
        fs.writeFileSync(temp, content, "utf8"); fs.renameSync(temp, target); diaryMemoryCache.at = 0;
        return { ok: true };
      } catch (error) { return { ok: false, error: String(error && error.message || error) }; }
    },
    "chat-workspace:generate-diary": async (event, payload = {}) => {
      if (!isWorkspaceSender(event.sender) || !DATE_ID_RE.test(String(payload.date || ""))) return { ok: false, error: "Invalid date" };
      try { return await generateDailyDiary(payload.date, true); }
      catch (error) { return { ok: false, error: localizeError(error) }; }
    },
    "chat-workspace:open-diary-folder": async (event) => {
      if (!isWorkspaceSender(event.sender)) return { ok: false };
      fs.mkdirSync(diaryDir, { recursive: true }); const error = await shell.openPath(diaryDir);
      return error ? { ok: false, error } : { ok: true };
    },
    "minicpm:status": async () => {
      const config = getInferenceConfig();
      return {
        bridgeDir,
        url: config.api_endpoint,
        healthy: !!(config.api_endpoint && config.api_model),
        remote: true,
      };
    },
    "minicpm:emotion-status": async (event) => {
      if (!isChatSurfaceSender(event.sender)) return { phase: "idle", emotion: "calm", blend: normalizeEmotionBlend("calm"), updatedAt: null };
      return { ...emotionStatus };
    },
    "minicpm:emotion-classify-local": async (event, payload = {}) => {
      if (!isChatSurfaceSender(event.sender)) return { ok: false, error: "Emotion classification is only available from the chat window" };
      const text = typeof payload.text === "string" ? payload.text.trim().slice(0, 1600) : "";
      const blend = inferEmotionBlendFromText(text);
      const moodAction = inferMoodActionFromText(text, blend);
      const eventId = String(payload.event_id || `emotion-${Date.now()}-${++emotionRequestSeq}`).replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 96);
      if (eventId !== activeEmotionEventId) {
        activeEmotionEventId = eventId;
        emotionRequestSeq += 1;
        if (emotionController) emotionController.abort();
        emotionController = null;
      }
      try { ctx.setChatEmotion && ctx.setChatEmotion({ eventId, blend, moodAction, moodDurationMinutes: getInferenceConfig().mood_duration_minutes }); } catch {}
      publishEmotionStatus({ phase: blend.primary === "calm" ? "fallback" : (isApiMode() ? "provisional" : "heuristic"), blend, moodAction });
      return { ok: true, eventId, blend, moodAction };
    },
    "minicpm:start": async (_evt, opts = {}) => {
      try {
        getRemoteRuntimeConfig();
        return { ok: true, status: "service-ready", remote: true };
      } catch (err) {
        return { ok: false, error: localizeError(err) };
      }
    },
    "minicpm:remote-chat-start": async (event, payload = {}) => {
      if (!isApiMode()) return { ok: false, error: "Remote API mode is not enabled" };
      if (!isChatBubbleSender(event.sender)) return { ok: false, error: "Screen chat is only available from the chat window" };
      const screenImageDataUrl = payload.screen_capture_token
        ? takeScreenCapture(payload.screen_capture_token, event.sender.id)
        : null;
      if (payload.screen_capture_token && !screenImageDataUrl) {
        return { ok: false, error: tr("chatScreenCaptureExpired") };
      }
      const id = `remote-${Date.now()}-${++remoteRequestSeq}`;
      const controller = new AbortController();
      remoteRequests.set(id, controller);
      const sender = event.sender;
      let mirroredAssistant = null;
      if (isChatBubbleSender(sender)) {
        sharedSession = {
          date: localDay(), generating: true, requestId: id,
          messages: (Array.isArray(payload.messages) ? payload.messages : []).filter((message) => message && ["user", "assistant"].includes(message.role)).map((message, index) => ({
            id: `bubble-${Date.now()}-${index}`, role: message.role,
            content: typeof message.content === "string" ? message.content : "", timestamp: new Date().toISOString(),
          })),
        };
        mirroredAssistant = { id: `bubble-assistant-${Date.now()}`, role: "assistant", content: "", timestamp: new Date().toISOString(), streaming: true };
        sharedSession.messages.push(mirroredAssistant); broadcastSharedSession();
      }
      // Fire and forget: emotional feedback is auxiliary and never holds up
      // the response stream or creates a chat/history entry.
      void classifyChatEmotion(payload.messages, payload.emotion_event_id).catch(() => {});
      setImmediate(async () => {
        try {
          await remoteCompletion({ ...payload, screenImageDataUrl }, (frame) => {
            if (mirroredAssistant && frame && frame.event === "delta") {
              mirroredAssistant.content += String(frame.content || frame.reasoning_content || "");
              broadcastSharedSession();
            }
            if (!sender.isDestroyed()) sender.send("minicpm:remote-chat-event", { id, ...frame });
          }, controller.signal);
          if (mirroredAssistant) mirroredAssistant.streaming = false;
          workspaceConnectionState = "available";
          if (!sender.isDestroyed()) sender.send("minicpm:remote-chat-event", { id, event: "end" });
        } catch (err) {
          workspaceConnectionState = "error";
          if (mirroredAssistant) { mirroredAssistant.streaming = false; mirroredAssistant.error = true; mirroredAssistant.content = mirroredAssistant.content || `请求失败：${localizeError(err)}`; }
          if (!sender.isDestroyed()) sender.send("minicpm:remote-chat-event", { id, event: "error", message: localizeError(err) });
        } finally { if (mirroredAssistant) { sharedSession.generating = false; broadcastSharedSession(); } remoteRequests.delete(id); }
      });
      return { ok: true, id };
    },
    "minicpm:remote-chat-cancel": async (_event, payload = {}) => {
      const ctrl = remoteRequests.get(payload.id);
      if (ctrl) ctrl.abort();
      return { ok: true };
    },
    "minicpm:screen-capture-list": async (event) => {
      if (!isApiMode()) return { ok: false, error: tr("chatScreenUnavailableLocal") };
      if (!isChatBubbleSender(event.sender)) return { ok: false, error: "Screen chat is only available from the chat window" };
      try {
        return { ok: true, sources: await screenCapture.list() };
      } catch (error) {
        return { ok: false, error: screenCaptureErrorMessage(error), permissionRequired: screenCaptureNeedsPermission(error) };
      }
    },
    "minicpm:screen-capture-take": async (event, payload = {}) => {
      if (!isApiMode()) return { ok: false, error: tr("chatScreenUnavailableLocal") };
      if (!isChatBubbleSender(event.sender)) return { ok: false, error: "Screen chat is only available from the chat window" };
      try {
        const capture = await screenCapture.capture(payload.sourceId);
        return { ok: true, ...storeScreenCapture(event.sender.id, capture) };
      } catch (error) {
        return { ok: false, error: screenCaptureErrorMessage(error), permissionRequired: screenCaptureNeedsPermission(error) };
      }
    },
    "minicpm:screen-capture-discard": async (event, payload = {}) => ({
      ok: isChatBubbleSender(event.sender) && discardScreenCapture(payload.token, event.sender.id),
    }),
    "minicpm:screen-capture-open-settings": async () => {
      if (!isMac) return { ok: false };
      try {
        await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
        return { ok: true };
      } catch { return { ok: false }; }
    },
    "minicpm:save-chat-history": async (_event, entry) => appendChatHistory(entry),
    "minicpm:save-memory-note": async (_event, entry) => appendMemoryNote(entry && entry.content),
    "minicpm:get-time-context": async () => buildTimeContext(),
    "minicpm:get-chat-context": async () => [getActivePersona().prompt, buildTimeContext()].join("\n\n"),
    "minicpm:music-control": async (_event, entry) => runAppleMusicCommand(
      { text: entry && entry.text },
      { playlistName: getAppleMusicConfig().playlist }
    ),
    "minicpm:get-i18n": async () => {
      const lang = getLang();
      return minicpmI18n.getMinicpmI18nPayload(lang);
    },
    "minicpm:resize": (_evt, { width, height } = {}) => {
      width = Math.max(MIN_WIDTH, Math.min(SPEAK_MAX_WIDTH, Math.round(Number(width) || ASK_WIDTH)));
      height = Math.max(MIN_HEIGHT, Math.min(SPEAK_MAX_HEIGHT, Math.round(Number(height) || ASK_HEIGHT)));
      chooseAndApplyBounds(width, height);
      return { ok: true, width, height };
    },
    "minicpm:set-chat-anchor": (_evt, { bottomY } = {}) => {
      // Renderer enters/exits "anchor-bottom while typing" mode. Pass null
      // to clear and go back to default center anchor.
      chatAnchorBottomY = (typeof bottomY === "number" && Number.isFinite(bottomY)) ? bottomY : null;
      return { ok: true };
    },
    "minicpm:hide-window": () => {
      if (bubble && !bubble.isDestroyed() && bubble.isVisible()) bubble.hide();
      bubbleShown = false;
      // Bubble closed → if a coding-agent event was queued during chat,
      // replay it now (subject to the 60s freshness window).
      setTimeout(() => flushQueuedEventIfStale(), 600);
      return { ok: true };
    },
    "minicpm:update-status": async () => {
      // Returns the cached status + triggers a fresh background refresh.
      void refreshUpdateStatus();
      return updateStatus || { available: false };
    },
    "minicpm:update-apply": async () => {
      // Stream progress events back to the renderer in real time so the UI
      // can paint the progress bar; resolve the invoke once the apply is
      // finished.
      const result = await applyUpdate((ev) => {
        if (bubble && !bubble.isDestroyed()) {
          bubble.webContents.send("minicpm:update-applying", ev);
        }
      });
      await refreshUpdateStatus();
      return { ...result, status: updateStatus };
    },
    "minicpm:focus-window": () => {
      // Bring bubble to the front AND give it keyboard focus. Used when
      // we transition back to ask mode after a reply so the user can
      // type immediately without re-clicking the pet.
      if (bubble && !bubble.isDestroyed()) {
        try {
          if (!bubble.isVisible()) bubble.show();
          else bubble.show(); // also raises macOS panel to key window
          bubble.focus();
          bubbleShown = true;
        } catch (err) { log(`[minicpm-chat] focus failed: ${err.message}`); }
      }
      return { ok: true };
    },
    "minicpm:show-window": () => {
      bubbleShown = true;
      if (bubble && !bubble.isDestroyed() && !bubble.isVisible()) {
        // Re-pick the side based on current pet position before showing,
        // so the bubble pops back next to the pet even if it moved while
        // the bubble was hidden.
        const pb = ctx.getPetWindowBounds && ctx.getPetWindowBounds();
        const wa = pb ? (ctx.getNearestWorkArea
          ? ctx.getNearestWorkArea(pb.x + pb.width / 2, pb.y + pb.height / 2)
          : screen.getPrimaryDisplay().workArea) : null;
        if (pb && wa) {
          const { width, height } = bubble.getBounds();
          activeSide = pickSide(pb, wa, width, height, bubblePos.side);
          bubble.setBounds(computeBubbleBoundsForSide(activeSide, pb, wa, width, height, {
            offsetDx: bubblePos.dx, offsetDy: bubblePos.dy,
          }));
        }
        bubble.showInactive();
      }
      return { ok: true };
    },
  };
  for (const [ch, fn] of Object.entries(handlers)) {
    try { ipcMain.removeHandler(ch); } catch {}
    ipcMain.handle(ch, fn);
  }

  ipcMain.removeAllListeners("minicpm:open-context-menu");
  ipcMain.on("minicpm:open-context-menu", () => { void openContextMenu(); });

  try { ipcMain.removeHandler("minicpm:get-chat-params"); } catch {}
  ipcMain.handle("minicpm:get-chat-params", async () => getChatParams());

  // ── Settings-window facing IPC ────────────────────────────────────────
  // Surface the MiniCPM panel state to the main Settings window.
  const settingsHandlers = {
    "minicpm-settings:get-status": async () => {
      if (isApiMode()) {
        const config = getInferenceConfig();
        return {
          remote: true, healthy: !!(config.api_endpoint && config.api_model), sidecarReady: false, llamaReady: false,
          narration: narrationEnabled, api: config,
        };
      }
      // /api/health internally chains a call into llama-server's /health, so
      // a too-tight timeout falsely paints a live sidecar as "offline" the
      // moment llama is briefly busy (KV flush after a chat, model swap,
      // adapter load, etc). 5s keeps the probe still cheap but resilient to
      // that micro-jitter.
      const health = await httpJson("GET", `${sidecar.baseUrl()}/api/health`, null, 5000).catch(() => null);
      const llamaReady = !!(health && health.json && (
        health.json.alive === true ||
        (health.json.llama_server && health.json.llama_server.status === "ok")
      ));
      const requireLlama = isModelPresent();
      const sidecarReady = !!(health && health.json && health.json.ok);
      return {
        sidecarUrl: sidecar.baseUrl(),
        healthy: !!(sidecarReady && (!requireLlama || llamaReady)),
        sidecarReady,
        llamaReady,
        health: health ? health.json : null,
        narration: narrationEnabled,
      };
    },
    "minicpm-settings:get-inference-config": async () => getInferenceConfig(),
    "minicpm-settings:save-api-profiles": async (_evt, payload) => {
      try { return { ok: true, config: saveApiProfiles(payload || {}) }; }
      catch (err) { return { ok: false, error: localizeError(err) }; }
    },
    "minicpm-settings:get-persona-profiles": async () => getPersonaProfiles(),
    "minicpm-settings:save-persona-profiles": async (_evt, payload) => {
      try { return { ok: true, ...savePersonaProfiles(payload || {}) }; }
      catch (err) { return { ok: false, error: localizeError(err) }; }
    },
    "minicpm-settings:set-inference-config": async (_evt, payload) => {
      try { return { ok: true, config: await setInferenceConfig(payload || {}) }; }
      catch (err) { return { ok: false, error: localizeError(err) }; }
    },
    "minicpm-settings:get-apple-music-config": async () => getAppleMusicConfig(),
    "minicpm-settings:set-apple-music-config": async (_evt, payload) => {
      try { return { ok: true, config: setAppleMusicConfig(payload || {}) }; }
      catch (err) { return { ok: false, error: localizeError(err) }; }
    },
    "minicpm-settings:clear-api-key": async () => ({ ok: true, config: clearApiKey() }),
    "minicpm-settings:test-api": async () => {
      try {
        const result = await remoteCompletion({
          messages: [{ role: "user", content: "ping" }], stream: false,
          max_tokens: 1, temperature: 0, top_p: 1,
        });
        return { ok: !!result };
      } catch (err) { return { ok: false, error: localizeError(err) }; }
    },
    "minicpm-settings:list-adapters": async () => {
      // Gateway is the source of truth for the *physical* adapter set
      // (which files exist, persona slug, current active). The manifest
      // adds product-layer metadata (displayName, aliases, source,
      // entry id). We join by absolute path so renames + uploads in
      // the same dir resolve correctly.
      const r = await httpJson("GET", `${sidecar.baseUrl()}/api/adapters`, null, 2000).catch(() => null);
      const remote = r && r.json ? r.json : { items: [], current: null, current_name: null };
      const manifest = readAdapterManifest();
      const byPath = new Map();
      for (const item of manifest.items || []) {
        if (!item || !item.path) continue;
        try { byPath.set(path.resolve(item.path), item); }
        catch { byPath.set(item.path, item); }
      }
      const remoteItems = Array.isArray(remote.items) ? remote.items : [];
      const merged = remoteItems.map((g) => {
        let entry = null;
        try { entry = byPath.get(path.resolve(g.path)) || null; }
        catch { entry = null; }
        return {
          ...g,
          id: entry && entry.id ? entry.id : `external:${g.path}`,
          displayName: entry && entry.displayName ? entry.displayName : g.name,
          aliases: entry && Array.isArray(entry.aliases) ? entry.aliases : [],
          source: entry && entry.source ? entry.source : "external",
        };
      });
      // Surface manifest entries whose .gguf went missing too, so the
      // user can clean them up from the UI rather than wondering why
      // their preset vanished.
      const remoteSet = new Set();
      for (const g of remoteItems) {
        try { remoteSet.add(path.resolve(g.path)); } catch { remoteSet.add(g.path); }
      }
      for (const entry of manifest.items || []) {
        if (!entry || !entry.path) continue;
        const key = (() => { try { return path.resolve(entry.path); } catch { return entry.path; } })();
        if (remoteSet.has(key)) continue;
        merged.push({
          name: path.basename(entry.path),
          path: entry.path,
          persona: entry.persona || "default",
          id: entry.id,
          displayName: entry.displayName || path.basename(entry.path),
          aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
          source: entry.source || "external",
          missing: true,
        });
      }
      return {
        ...remote,
        items: merged,
      };
    },
    "minicpm-settings:load-adapter": async (_evt, payload) => {
      const requested = (payload && payload.path) || null;
      // Short-circuit when the requested adapter is already active —
      // skip the load-adapter call entirely (it's a few-hundred-ms op
      // even when no-op) and don't wipe chat history.
      const cur = await httpJson("GET", `${sidecar.baseUrl()}/api/health`, null, 1500).catch(() => null);
      const currentAdapter = cur && cur.json ? (cur.json.adapter || null) : undefined;
      const sameAdapter = currentAdapter !== undefined && (
        (requested === null && !currentAdapter) ||
        (requested && currentAdapter && requested === currentAdapter)
      );
      if (sameAdapter) {
        const personaName = cur.json.persona && cur.json.persona !== "default" ? cur.json.persona : null;
        const adapterName = (currentAdapter && String(currentAdapter).split("/").pop()) || null;
        let text;
        if (!currentAdapter) text = "已经是 base 模型了。";
        else if (personaName) text = `已经在 LoRA · ${personaName} 了。`;
        else text = `已经加载着 LoRA · ${adapterName || "?"} 了。`;
        try {
          ensureBubble();
          reposition();
          if (!bubble.isVisible()) bubble.showInactive();
          bubbleShown = true;
          bubble.webContents.send("minicpm:cmd-reply", { text, ok: true });
        } catch (err) {
          log(`[minicpm] adapter no-op notify failed: ${err && err.message}`);
        }
        return { ok: true, noop: true, adapter: currentAdapter, persona: cur.json.persona };
      }

      const r = await httpJson("POST", `${sidecar.baseUrl()}/api/load-adapter`, payload || {}, 90000).catch(() => null);
      const data = r ? r.json : null;
      // Persist the user's choice so the next sidecar spawn loads
      // exactly this LoRA via --lora (or no --lora at all when
      // path is null). We resolve the manifest entry by path so the
      // stored id stays in sync even after rename / re-import.
      if (data && data.ok) {
        try {
          if (!requested) {
            setActiveAdapterId(null);
          } else {
            const manifest = readAdapterManifest();
            const entry = (manifest.items || []).find((it) => {
              try { return it && it.path && path.resolve(it.path) === path.resolve(requested); }
              catch { return false; }
            });
            setActiveAdapterId(entry ? entry.id : null);
          }
          refreshActiveAdapterPath();
        } catch (err) {
          log(`[minicpm] persist active adapter failed: ${err && err.message}`);
        }
        // Mirror the in-chat command UX: pop a fade-out reply bubble next
        // to the pet announcing the swap, and tell the renderer to wipe
        // its conversation history so the new persona starts clean.
        const personaName = data.persona && data.persona !== "default" ? data.persona : null;
        const adapterName = (data.adapter && String(data.adapter).split("/").pop()) || null;
        let text;
        if (!data.adapter) text = "已切换回 base 模型，对话历史已清空。";
        else if (personaName) text = `已切换到 LoRA · ${personaName}，对话历史已清空。`;
        else text = `已加载 LoRA · ${adapterName || "?"}，对话历史已清空。`;
        try {
          ensureBubble();
          reposition();
          if (!bubble.isVisible()) bubble.showInactive();
          bubbleShown = true;
          bubble.webContents.send("minicpm:cmd-reply", { text, ok: true, resetHistory: true });
        } catch (err) {
          log(`[minicpm] adapter swap notify failed: ${err && err.message}`);
        }
      }
      return data;
    },
    "minicpm-settings:check-update": async () => {
      const r = await httpJson("GET", `${sidecar.baseUrl()}/api/update-check`, null, 5000).catch(() => null);
      return r ? r.json : null;
    },
    "minicpm-settings:apply-update": async () => {
      // Reuse the same update path the bubble menu uses; results in events
      // streamed via the chat bubble (if open).
      try {
        const result = await applyUpdate(() => {});
        await refreshUpdateStatus();
        return { ...result, status: updateStatus };
      } catch (err) {
        return { ok: false, error: String(err && err.message || err) };
      }
    },
    "minicpm-settings:set-narration": async (_evt, payload) => {
      setNarrationEnabled(!!(payload && payload.enabled));
      return { ok: true, enabled: narrationEnabled };
    },

    // ── Accelerator / device manual override ────────────────────────────
    "minicpm-settings:list-devices": async () => {
      const r = await httpJson("GET", `${sidecar.baseUrl()}/api/devices`, null, 2000).catch(() => null);
      return r ? r.json : null;
    },
    "minicpm-settings:set-device": async (_evt, payload) => {
      const device = (payload && payload.device) || "";
      if (device === "vulkan" && process.platform !== "win32") {
        return { ok: false, device, error: "Vulkan backend is only configurable on Windows" };
      }
      // Persist for the next sidecar spawn even if /api/set-device is
      // unreachable (sidecar may have crashed). MINICPM_DEVICE is the
      // single source of truth our server.py reads at start.
      process.env.MINICPM_DEVICE = device;
      try {
        await httpJson("POST", `${sidecar.baseUrl()}/api/set-device`, { device }, 1500);
      } catch {}
      return { ok: true, device, note: "下次 sidecar 重启时生效" };
    },
    "minicpm-settings:set-device-and-restart": async (_evt, payload) => {
      const device = (payload && payload.device) || "";
      if (device === "vulkan" && process.platform !== "win32") {
        return { ok: false, device, error: "Vulkan backend is only configurable on Windows" };
      }
      const previousDevice = process.env.MINICPM_DEVICE || "";
      process.env.MINICPM_DEVICE = device;
      try {
        await sidecar.stopAndWait();
      } catch (stopErr) {
        process.env.MINICPM_DEVICE = previousDevice;
        return { ok: false, device, phase: "stop", error: localizeError(stopErr) };
      }
      try {
        const r = await sidecar.ensureRunning(getEffectiveModelDir());
        return { ok: true, device, status: r && r.status };
      } catch (err) {
        if (process.platform === "win32" && device === "vulkan") {
          const originalError = localizeError(err);
          process.env.MINICPM_DEVICE = "cpu";
          try {
            await sidecar.stopAndWait();
          } catch (fallbackStopErr) {
            return {
              ok: false,
              device,
              phase: "fallback-stop",
              error: `${originalError}; CPU fallback cleanup failed: ${localizeError(fallbackStopErr)}`,
            };
          }
          try {
            const r = await sidecar.ensureRunning(getEffectiveModelDir());
            log(`[minicpm-chat] Vulkan backend failed; fell back to CPU: ${originalError}`);
            return { ok: false, fallback: "cpu", device: "cpu", status: r && r.status, error: originalError };
          } catch (fallbackErr) {
            return { ok: false, fallback: "cpu", device: "cpu", error: localizeError(fallbackErr) };
          }
        }
        return { ok: false, device, error: localizeError(err) };
      }
    },
    "minicpm-settings:restart-sidecar": async () => {
      try {
        await sidecar.stopAndWait();
        const r = await sidecar.ensureRunning(getEffectiveModelDir());
        return { ok: true, status: r && r.status };
      } catch (err) {
        return { ok: false, error: String(err && err.message || err) };
      }
    },

    // ── Local model directory override ──────────────────────────────────
    "minicpm-settings:get-model-dir": async () => ({
      current: getEffectiveModelDir(),
      default: getDefaultModelDir(),
      present: isModelPresent(),
    }),
    "minicpm-settings:pick-model-dir": async () => {
      const { dialog } = require("electron");
      const ret = await dialog.showOpenDialog({
        title: "选择本地 MiniCPM 模型 (.gguf 文件或包含 .gguf 的目录)",
        properties: ["openFile", "openDirectory"],
        filters: [{ name: "GGUF model", extensions: ["gguf"] }],
        message: "可以是单个 .gguf 文件，或包含 .gguf 的目录",
      });
      if (ret.canceled || !ret.filePaths.length) return { ok: false, canceled: true };
      const picked = ret.filePaths[0];
      let target = picked;
      try {
        const st = fs.statSync(picked);
        if (st.isDirectory()) {
          const entries = fs.readdirSync(picked)
            .filter((n) => n.toLowerCase().endsWith(".gguf"));
          if (!entries.length) {
            return { ok: false, error: `所选目录不包含 .gguf：\n${picked}` };
          }
          target = path.join(picked, entries[0]);
        } else if (!picked.toLowerCase().endsWith(".gguf")) {
          return { ok: false, error: `请选择 .gguf 文件：\n${picked}` };
        }
      } catch (err) {
        return { ok: false, error: String(err && err.message || err) };
      }
      setEffectiveModelDir(target);
      // Persisting the prefs only takes effect on the next sidecar spawn —
      // hot-swap via /api/load-model so the running llama-server actually
      // picks up the new .gguf without a manual restart. swap_model on the
      // gateway stops + respawns llama-server with the new --model and
      // blocks until the /health probe returns 200, so a successful
      // resolution here means the new model is already serving requests.
      let reloadError = null;
      try {
        const r = await sidecar.loadModel(target);
        if (r && r.error) reloadError = String(r.error);
      } catch (err) {
        reloadError = String(err && err.message || err);
      }
      return { ok: true, modelDir: target, reloaded: !reloadError, reloadError };
    },
    "minicpm-settings:open-model-dir": async () => {
      const health = await httpJson("GET", `${sidecar.baseUrl()}/api/health`, null, 1500).catch(() => null);
      const gguf = resolveCurrentGgufPath(health ? health.json : null);
      if (gguf) {
        try {
          shell.showItemInFolder(gguf);
          return { ok: true, path: gguf, highlighted: true };
        } catch (err) {
          return { ok: false, error: String(err && err.message || err) };
        }
      }
      const dir = getEffectiveModelDir();
      try {
        fs.mkdirSync(dir, { recursive: true });
        const err = await shell.openPath(dir);
        if (err) return { ok: false, error: err };
        return { ok: true, dir, highlighted: false };
      } catch (err) {
        return { ok: false, error: String(err && err.message || err) };
      }
    },

    // ── Adapter (LoRA) directory ────────────────────────────────────────
    // Same shape as the model dir handlers: read the effective path,
    // open it in Finder/Explorer (creating it if missing), and let the
    // Settings tab refresh after the user drops new .gguf files in.
    "minicpm-settings:get-adapter-dir": async () => ({
      current: getEffectiveAdapterDir(),
      default: getDefaultAdapterDir(),
    }),
    "minicpm-settings:open-adapter-dir": async () => {
      const dir = getEffectiveAdapterDir();
      try {
        fs.mkdirSync(dir, { recursive: true });
        const err = await shell.openPath(dir);
        if (err) return { ok: false, error: err };
        return { ok: true, dir };
      } catch (err) {
        return { ok: false, error: String(err && err.message || err) };
      }
    },

    // ── Adapter manifest CRUD ───────────────────────────────────────────
    // The Settings UI reads the merged list via `list-adapters` (which
    // joins gateway items with manifest metadata) and mutates the
    // manifest through these handlers. After every mutation we also
    // refresh the gateway's mirror (handled inside writeAdapterManifest)
    // so chat-bubble keyword routing — which goes straight to the
    // sidecar HTTP API — sees the updated displayName / aliases on the
    // next /api/adapters call.

    "minicpm-settings:get-adapter-manifest": async () => readAdapterManifest(),

    "minicpm-settings:upload-adapter": async (_evt, payload) => {
      const { dialog } = require("electron");
      const ret = await dialog.showOpenDialog({
        title: "选择 LoRA 适配器 (.gguf)",
        properties: ["openFile"],
        filters: [{ name: "GGUF adapter", extensions: ["gguf"] }],
        message: "选一个 GGUF 格式的 LoRA 适配器文件；会被复制到本应用的 adapters 目录。",
      });
      if (ret.canceled || !ret.filePaths.length) {
        return { ok: false, canceled: true };
      }
      const src = ret.filePaths[0];
      const lower = src.toLowerCase();
      if (!lower.endsWith(".gguf")) {
        return { ok: false, error: `必须是 .gguf 文件：${src}` };
      }
      let srcStat;
      try { srcStat = fs.statSync(src); }
      catch (err) { return { ok: false, error: `读不到所选文件：${err && err.message}` }; }
      if (!srcStat.isFile()) {
        return { ok: false, error: `不是普通文件：${src}` };
      }
      const ts = Date.now();
      const safeBasename = path.basename(src).replace(/[^A-Za-z0-9._-]+/g, "_");
      const uploadsDir = path.join(getEffectiveAdapterDir(), "uploads");
      const destName = `${ts}_${safeBasename}`;
      const dest = path.join(uploadsDir, destName);
      try { fs.mkdirSync(uploadsDir, { recursive: true }); }
      catch (err) { return { ok: false, error: `无法创建 uploads 目录：${err && err.message}` }; }
      try {
        fs.copyFileSync(src, dest);
      } catch (err) {
        return { ok: false, error: `复制文件失败：${err && err.message}` };
      }
      const displayName = (payload && typeof payload.displayName === "string" && payload.displayName.trim())
        ? payload.displayName.trim()
        : path.basename(src, ".gguf");
      const aliases = Array.isArray(payload && payload.aliases)
        ? payload.aliases.map((s) => String(s || "").trim()).filter(Boolean)
        : [];
      const entry = upsertAdapterEntry({
        id: `upload:${ts}`,
        path: dest,
        displayName,
        aliases,
        persona: "custom",
        source: "user-upload",
      });
      return { ok: true, item: entry };
    },

    "minicpm-settings:rename-adapter": async (_evt, payload) => {
      if (!payload || typeof payload.id !== "string") {
        return { ok: false, error: "id is required" };
      }
      const manifest = readAdapterManifest();
      const idx = manifest.items.findIndex((it) => it && it.id === payload.id);
      if (idx < 0) return { ok: false, error: `adapter not found: ${payload.id}` };
      const patch = {};
      if (typeof payload.displayName === "string") patch.displayName = payload.displayName.trim() || manifest.items[idx].displayName;
      if (Array.isArray(payload.aliases)) {
        patch.aliases = payload.aliases.map((s) => String(s || "").trim()).filter(Boolean);
      }
      const merged = upsertAdapterEntry({ ...manifest.items[idx], ...patch });
      return { ok: true, item: merged };
    },

    "minicpm-settings:remove-adapter": async (_evt, payload) => {
      if (!payload || typeof payload.id !== "string") {
        return { ok: false, error: "id is required" };
      }
      const manifest = readAdapterManifest();
      const target = manifest.items.find((it) => it && it.id === payload.id);
      if (!target) return { ok: false, error: `adapter not found: ${payload.id}` };
      if (target.source !== "user-upload") {
        return { ok: false, error: "只能删除自行上传的 LoRA，预置项请保留。" };
      }
      // If the user just removed the currently active adapter, unload
      // it on the sidecar side first so llama-server's per-request
      // `lora` array doesn't reference a path we're about to unlink.
      try {
        const health = await httpJson("GET", `${sidecar.baseUrl()}/api/health`, null, 1500).catch(() => null);
        const currentPath = health && health.json && health.json.adapter ? String(health.json.adapter) : null;
        if (currentPath && target.path && path.resolve(currentPath) === path.resolve(target.path)) {
          await httpJson("POST", `${sidecar.baseUrl()}/api/load-adapter`, { path: null }, 30000).catch(() => null);
        }
      } catch {}
      if (payload.deleteFile && target.path) {
        try { fs.unlinkSync(target.path); }
        catch (err) { log(`[minicpm] adapter file unlink failed: ${err && err.message}`); }
      }
      removeAdapterEntry(payload.id);
      return { ok: true, id: payload.id };
    },
    "minicpm-settings:get-resources": async () => {
      const root = sidecar.proc && sidecar.proc.pid;
      if (!root) return { ok: false, reason: "no-sidecar" };
      try {
        const all = await listAllProcesses();
        const tree = collectProcessTree(root, all);
        const total_rss_kb = tree.reduce((sum, p) => sum + (p.rss || 0), 0);
        const total_cpu = tree.reduce((sum, p) => sum + (p.cpu || 0), 0);
        const health = await httpJson("GET", `${sidecar.baseUrl()}/api/health`, null, 1500).catch(() => null);
        const h = health && health.json ? health.json : {};
        const gguf_path = resolveCurrentGgufPath(h);
        let gguf_size = null;
        if (gguf_path) {
          try { gguf_size = fs.statSync(gguf_path).size; } catch {}
        }
        const llama = tree.find((p) => /llama-server/i.test(p.cmd));
        const ctx_size = Number(process.env.MINICPM_CTX) || 4096;
        const mmap_kb = gguf_size ? Math.round(gguf_size / 1024) : null;
        const private_kb = mmap_kb != null
          ? Math.max(0, total_rss_kb - mmap_kb)
          : total_rss_kb;
        return {
          ok: true,
          total_rss_kb,
          total_cpu,
          private_kb,
          mmap_kb,
          gguf_size,
          gguf_path,
          ctx_size,
          accel: h.accel || h.device || null,
          backend: h.backend || null,
          llama_alive: !!(h.alive || (h.llama_server && h.llama_server.status === "ok")),
          processes: tree.map((p) => ({
            pid: p.pid,
            rss: p.rss,
            cpu: p.cpu,
            cmd: p.cmd.slice(0, 160),
          })),
          llama_pid: llama ? llama.pid : null,
        };
      } catch (err) {
        return { ok: false, error: String(err && err.message || err) };
      }
    },
    "minicpm-settings:reset-model-dir": async () => {
      setEffectiveModelDir(null);
      return { ok: true, modelDir: getDefaultModelDir() };
    },

    // ── Onboarding rerun (dev / recovery) ───────────────────────────────
    "minicpm-settings:rerun-onboarding": async () => {
      // Delete the sentinel and tell main.js to relaunch. main.js will
      // see shouldShow()===true on next boot and open the wizard.
      try {
        const sentinelPath = path.join(app.getPath("userData"), "minicpm-onboarding.json");
        if (fs.existsSync(sentinelPath)) fs.unlinkSync(sentinelPath);
      } catch (err) {
        return { ok: false, error: String(err && err.message || err) };
      }
      // Don't call app.relaunch() here directly — the renderer expects an
      // explicit "yes I want to restart" confirmation. The handler just
      // marks the file; the Settings UI shows a "重启应用" button afterwards.
      return { ok: true };
    },
    "minicpm-settings:relaunch-app": async () => {
      // Hard-restart so the new sentinel state takes effect cleanly.
      setTimeout(() => {
        app.relaunch();
        app.quit();
      }, 100);
      return { ok: true };
    },

    // ── Logs (sidecar.log + crash dumps) ────────────────────────────────
    "minicpm-settings:get-logs-info": async () => {
      const entries = [];
      try {
        for (const name of fs.readdirSync(logsDir)) {
          try {
            const st = fs.statSync(path.join(logsDir, name));
            entries.push({
              name,
              size: st.size,
              mtime: st.mtime.toISOString(),
            });
          } catch {}
        }
      } catch {}
      entries.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
      return {
        dir: logsDir,
        sidecarLog: sidecarLogPath,
        entries,
      };
    },
    "minicpm-settings:open-logs-dir": async () => {
      const { shell } = require("electron");
      try { fs.mkdirSync(logsDir, { recursive: true }); } catch {}
      try {
        const err = await shell.openPath(logsDir);
        if (err) return { ok: false, error: err };
        return { ok: true, dir: logsDir };
      } catch (err) {
        return { ok: false, error: String(err && err.message || err) };
      }
    },
    "minicpm-settings:open-chat-history-dir": async () => {
      try { fs.mkdirSync(chatHistoryDir, { recursive: true }); } catch {}
      try {
        const err = await shell.openPath(chatHistoryDir);
        if (err) return { ok: false, error: err };
        return { ok: true, dir: chatHistoryDir };
      } catch (err) {
        return { ok: false, error: String(err && err.message || err) };
      }
    },
    "minicpm-settings:open-diary-dir": async () => {
      try { fs.mkdirSync(diaryDir, { recursive: true }); } catch {}
      const err = await shell.openPath(diaryDir);
      return err ? { ok: false, error: err } : { ok: true, dir: diaryDir };
    },
    "minicpm-settings:generate-diary": async () => {
      try { return await generateDailyDiary(localDay(), true); }
      catch (err) { return { ok: false, error: String(err && err.message || err) }; }
    },

    "minicpm-settings:get-chat-params": async () => ({
      params: getChatParams(),
      defaults: { ...DEFAULT_CHAT_PARAMS },
    }),
    "minicpm-settings:set-chat-params": async (_evt, payload) => ({
      ok: true,
      params: setChatParams(payload && payload.params),
    }),
    "minicpm-settings:reset-chat-params": async () => ({
      ok: true,
      params: setChatParams(DEFAULT_CHAT_PARAMS),
    }),

    "minicpm-settings:get-bubble-pos": async () => ({
      pos: getBubblePos(),
      defaults: { ...DEFAULT_BUBBLE_POS },
      editing: bubbleEditing,
    }),
    "minicpm-settings:set-bubble-pos": async (_evt, payload) => {
      const next = setBubblePos(payload && payload.pos);
      // Reposition immediately if the bubble is currently open so the
      // change is visible without forcing the user to reopen it.
      try { reposition(); } catch {}
      return { ok: true, pos: next };
    },
    "minicpm-settings:reset-bubble-pos": async () => {
      const next = setBubblePos(DEFAULT_BUBBLE_POS);
      try { reposition(); } catch {}
      return { ok: true, pos: next };
    },
    // Drag-to-position flow:
    //   1. Settings calls "enter-bubble-edit". We open the bubble next
    //      to the pet, swap it into a draggable sample, and pause any
    //      narration / auto-hide while the user fiddles with it.
    //   2. User drags the OS window around (the renderer applies
    //      -webkit-app-region: drag to the whole body in edit mode).
    //   3. Settings calls "exit-bubble-edit" with `save: true` to
    //      capture the final offset, or `save: false` to discard.
    "minicpm-settings:enter-bubble-edit": async () => {
      try {
        ensureBubble();
        bubbleEditing = true;
        // Apply the saved side preference so what the user is editing
        // matches what they'll see at runtime.
        const pb = getPetBoundsSafe();
        const wa = pb ? getWorkAreaForPet(pb) : screen.getPrimaryDisplay().workArea;
        if (pb) {
          activeSide = pickSide(pb, wa, ASK_WIDTH, ASK_HEIGHT, bubblePos.side);
          bubble.setBounds(computeBubbleBoundsForSide(activeSide, pb, wa, ASK_WIDTH, ASK_HEIGHT, {
            offsetDx: bubblePos.dx, offsetDy: bubblePos.dy,
          }));
        }
        if (!bubble.isVisible()) bubble.showInactive();
        bubbleShown = true;
        bubble.webContents.send("minicpm:edit-mode", { enabled: true, side: activeSide });
        return { ok: true, side: activeSide };
      } catch (err) {
        bubbleEditing = false;
        return { ok: false, error: String(err && err.message || err) };
      }
    },
    "minicpm-settings:exit-bubble-edit": async (_evt, payload) => {
      const save = !!(payload && payload.save);
      let savedPos = getBubblePos();
      try {
        if (save && bubble && !bubble.isDestroyed()) {
          const pb = getPetBoundsSafe();
          const wa = pb ? getWorkAreaForPet(pb) : screen.getPrimaryDisplay().workArea;
          const actual = bubble.getBounds();
          if (pb && wa) {
            // Compute defaults at offset 0 to derive the user's drag delta.
            const def = computeBubbleBoundsForSide(activeSide, pb, wa, actual.width, actual.height, {
              offsetDx: 0, offsetDy: 0,
            });
            let dx = 0;
            if (activeSide === "left") dx = def.x - actual.x;
            else if (activeSide === "right") dx = actual.x - def.x;
            else dx = actual.x - def.x;
            const dy = actual.y - def.y;
            savedPos = setBubblePos({ ...bubblePos, dx, dy });
          }
        }
      } finally {
        bubbleEditing = false;
        try {
          if (bubble && !bubble.isDestroyed()) {
            bubble.webContents.send("minicpm:edit-mode", { enabled: false });
            bubble.hide();
            bubbleShown = false;
          }
        } catch {}
      }
      return { ok: true, saved: save, pos: savedPos };
    },
  };
  for (const [ch, fn] of Object.entries(settingsHandlers)) {
    try { ipcMain.removeHandler(ch); } catch {}
    ipcMain.handle(ch, fn);
  }
  scheduleDailyDiary();
  setTimeout(() => { void catchUpDailyDiary().catch((err) => log(`[diary] catch-up failed: ${err && err.message || err}`)); }, 2000);

  function sendI18n() {
    if (!bubble || bubble.isDestroyed()) return;
    try {
      bubble.webContents.send(
        "minicpm:lang-change",
        minicpmI18n.getMinicpmI18nPayload(getLang())
      );
    } catch {}
  }

  return {
    open,
    openWorkspace,
    isWorkspaceOpen: () => !!(workspace && !workspace.isDestroyed()),
    focusWorkspace: () => { if (workspace && !workspace.isDestroyed()) { if (workspace.isMinimized()) workspace.restore(); workspace.show(); workspace.focus(); return true; } return false; },
    sendWorkspaceEvent: (channel, ...args) => {
      if (!workspace || workspace.isDestroyed()) return;
      if (channel === "theme-config") {
        workspace.webContents.send(channel, adaptWorkspaceLive2dConfig(args[0]));
        return;
      }
      workspace.webContents.send(channel, ...args);
    },
    toggle,
    dismiss,
    toggleThinking,
    warmup,
    onStateEvent,
    setNarrationEnabled,
    isNarrationEnabled,
    setPetDragging,
    isOpen: () => bubbleShown && !!(bubble && !bubble.isDestroyed()),
    reposition,
    shutdown,
    sendI18n,
    getBridgeDir: () => bridgeDir,
    getLogsDir: () => logsDir,
    isApiMode,
  };
};
