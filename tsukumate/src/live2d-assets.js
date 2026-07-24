"use strict";

// Live2D's browser loader follows model-relative texture/motion URLs.  A
// loopback-only server is safer and more reliable than exposing arbitrary
// file:// paths to the renderer, while still keeping every model local.
const fs = require("fs");
const http = require("http");
const path = require("path");

const MIME = {
  ".json": "application/json; charset=utf-8",
  ".moc3": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".js": "text/javascript; charset=utf-8",
};

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function findModels(root, maxDepth = 4) {
  const found = [];
  const walk = (directory, depth) => {
    if (depth > maxDepth) return;
    let entries = [];
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || ["node_modules", "dist", "build", "coverage"].includes(entry.name)) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.isFile() && entry.name.endsWith(".model3.json")) found.push(full);
    }
  };
  walk(root, 0);
  return found;
}

function findNamedFiles(root, filename, maxDepth = 4) {
  const found = [];
  const walk = (directory, depth) => {
    if (depth > maxDepth) return;
    let entries = [];
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || ["node_modules", "dist", "build", "coverage"].includes(entry.name)) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (entry.isFile() && entry.name === filename) found.push(full);
    }
  };
  walk(root, 0);
  return found;
}

function readMotionGroups(modelPath) {
  try {
    const modelJson = JSON.parse(fs.readFileSync(modelPath, "utf8"));
    const motions = modelJson && modelJson.FileReferences && modelJson.FileReferences.Motions;
    if (!motions || typeof motions !== "object") return [];
    return Object.entries(motions).map(([group, entries]) => ({
      group,
      count: Array.isArray(entries) ? entries.length : 0,
    }));
  } catch {
    return [];
  }
}

function createLive2dAssetService(options = {}) {
  const roots = [...new Set((options.modelRoots || []).filter(Boolean).map((dir) => path.resolve(dir)))];
  const coreCandidates = (options.coreCandidates || []).filter(Boolean).map((file) => path.resolve(file));
  let server = null;
  let port = null;
  let models = [];
  let discoveredCores = [];
  let current = null;
  let preferredModel = typeof options.preferredModel === "string" ? options.preferredModel : "";

  function scan() {
    models = roots.flatMap((root) => findModels(root).map((modelPath) => ({
      id: Buffer.from(modelPath).toString("base64url"),
      modelPath,
      root: path.dirname(modelPath),
      name: path.basename(modelPath, ".model3.json"),
      motions: readMotionGroups(modelPath),
    })));
    discoveredCores = roots.flatMap((root) => findNamedFiles(root, "live2dcubismcore.min.js"));
    // Prefer models the user placed themselves over the SDK's bundled demo
    // catalogue.  The latter remains a useful fallback for first-run tests.
    current = models.find((model) => model.id === preferredModel || model.name === preferredModel)
      || models.find((model) => !model.modelPath.includes(`${path.sep}CubismSdkForWeb-`)) || models[0] || null;
    return models.map(({ id, name, modelPath, motions }) => ({ id, name, modelPath, motions }));
  }

  function getCorePath() {
    const local = current && path.join(current.root, "live2dcubismcore.min.js");
    return [local, ...coreCandidates, ...discoveredCores].find((file) => {
      try { return !!file && fs.statSync(file).isFile(); } catch { return false; }
    }) || null;
  }

  function getShaderRoot() {
    const core = getCorePath();
    if (!core) return null;
    const candidate = path.resolve(path.dirname(core), "..", "Framework", "Shaders", "WebGL");
    try { return fs.statSync(candidate).isDirectory() ? candidate : null; } catch { return null; }
  }

  function urlFor(model, filename) {
    return `http://127.0.0.1:${port}/assets/${encodeURIComponent(model.id)}/${filename.split(path.sep).map(encodeURIComponent).join("/")}`;
  }

  function getRendererConfig() {
    if (!current || !port) return { enabled: false, models: models.map(({ id, name, motions }) => ({ id, name, motions })) };
    const corePath = getCorePath();
    return {
      enabled: !!corePath,
      reason: corePath ? null : "Live2D Cubism Core (live2dcubismcore.min.js) was not found next to the model or in the project live2d folder.",
      modelUrl: urlFor(current, path.basename(current.modelPath)),
      coreUrl: corePath ? urlFor({ ...current, id: "core", root: path.dirname(corePath) }, path.basename(corePath)) : null,
      shaderUrl: getShaderRoot() ? urlFor({ ...current, id: "shaders", root: getShaderRoot() }, "") : null,
      modelId: current.id,
      modelName: current.name,
      motions: current.motions,
      models: models.map(({ id, name, motions }) => ({ id, name, motions })),
    };
  }

  function serve(request, response) {
    const url = new URL(request.url, "http://127.0.0.1");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 3 || parts[0] !== "assets") { response.writeHead(404).end(); return; }
    const id = decodeURIComponent(parts[1]);
    const root = id === "core" ? (getCorePath() ? path.dirname(getCorePath()) : null)
      : id === "shaders" ? getShaderRoot()
        : models.find((item) => item.id === id)?.root;
    if (!root) { response.writeHead(404).end(); return; }
    const requested = path.resolve(root, ...parts.slice(2).map(decodeURIComponent));
    if (!isInside(root, requested) && requested !== root) { response.writeHead(403).end(); return; }
    let stat;
    try { stat = fs.statSync(requested); } catch { response.writeHead(404).end(); return; }
    if (!stat.isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, {
      "Content-Type": MIME[path.extname(requested).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
      // The pet renderer is a file:// Electron document.  PIXI loads the
      // model textures through <img>/fetch, which needs this header even
      // though the server is loopback-only and path allow-listed.
      "Access-Control-Allow-Origin": "*",
    });
    fs.createReadStream(requested).pipe(response);
  }

  async function start() {
    scan();
    if (server) return getRendererConfig();
    server = http.createServer(serve);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
    });
    port = server.address().port;
    return getRendererConfig();
  }

  function stop() {
    if (!server) return;
    const closing = server;
    server = null;
    port = null;
    try { closing.close(); } catch {}
  }

  function selectModel(idOrName) {
    preferredModel = String(idOrName || "");
    scan();
    return current ? { id: current.id, name: current.name } : null;
  }

  return { start, stop, scan, selectModel, getRendererConfig, getModels: () => scan() };
}

module.exports = { createLive2dAssetService, findModels, findNamedFiles, readMotionGroups };
