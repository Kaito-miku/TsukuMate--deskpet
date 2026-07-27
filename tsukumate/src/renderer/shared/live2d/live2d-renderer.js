// Browser-side Live2D bridge.  The model and Cubism Core are served only from
// the loopback allow-list created by main; this renderer never sees API keys.
// PIXI needs this official compatibility patch under Electron's strict CSP.
import "@pixi/unsafe-eval";

const stage = document.getElementById("live2d-stage");
const sprite = document.getElementById("clawd");
const petContainer = document.getElementById("pet-container");
let renderer = null;
let runtime = null;
let engineModule = null;
let frame = null;
let startedAt = 0;
let previousAt = 0;
let configuredModelUrl = null;
let loadingModelUrl = null;
let active = false;
let latestChatBlend = { primary: "calm", primaryWeight: 1, secondaryWeight: 0, intensity: 0.2 };
let latestChatLayer = "calm";
let currentState = "idle";

function report(stage, message = "") {
  try { window.electronAPI && window.electronAPI.reportLive2dStatus({ stage, message: String(message) }); } catch {}
}

const EMOTIONS = new Set(["calm", "focused", "happy", "shy", "surprised", "sleepy", "sad", "annoyed"]);
const STATE_EMOTION = {
  idle: "calm", thinking: "focused", working: "focused", juggling: "focused",
  attention: "happy", error: "sad", sleeping: "sleepy", dozing: "sleepy",
  notification: "surprised", mini_alert: "surprised",
};

function findParameter(parameters, candidates) {
  const names = Object.keys(parameters || {});
  for (const candidate of candidates) {
    const hit = names.find((name) => name.toLowerCase() === candidate.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

function rule(parameters, candidates, extra = {}) {
  const target = findParameter(parameters, candidates);
  return target ? { target, ...extra } : undefined;
}

function createProfile(modelUrl, parameters) {
  const parameterMap = {};
  const add = (key, candidates, extra) => { const mapped = rule(parameters, candidates, extra); if (mapped) parameterMap[key] = mapped; };
  add("headX", ["ParamAngleX"]); add("headY", ["ParamAngleY"]); add("headZ", ["ParamAngleZ"]);
  add("bodyX", ["ParamBodyAngleX"]); add("bodyY", ["ParamBodyAngleY"]); add("bodyZ", ["ParamBodyAngleZ"]);
  add("gazeX", ["ParamEyeBallX"]); add("gazeY", ["ParamEyeBallY"]);
  add("eyeOpen", ["ParamEyeLOpen", "ParamEyeROpen"]);
  add("eyeBlinkL", ["ParamEyeLOpen"], { scale: -1, offset: 1 });
  add("eyeBlinkR", ["ParamEyeROpen"], { scale: -1, offset: 1 });
  add("eyeSmile", ["ParamEyeLSmile", "ParamEyeRSmile", "ParamEyeSmile"]);
  add("mouthOpen", ["ParamMouthOpenY"]); add("mouthSmile", ["ParamMouthForm"]);
  add("browInnerUp", ["ParamBrowLY", "ParamBrowRY"]); add("browDown", ["ParamBrowLForm", "ParamBrowRForm"]);
  add("breath", ["ParamBreath"]);
  return {
    modelId: "desktop-live2d", displayName: "Desktop Live2D", version: "1", modelPath: modelUrl,
    parameterMap, idleConfig: { breath: [0.08, 0.18] }, neutralParams: {}, parameterSmoothing: {},
  };
}

async function enable(config) {
  if (!config || !config.enabled || !config.modelUrl || !config.coreUrl) {
    report("disabled", config && config.reason || "No configured model/core");
    return disable();
  }
  if (configuredModelUrl === config.modelUrl && (active || loadingModelUrl === config.modelUrl)) return;
  disable();
  configuredModelUrl = config.modelUrl;
  loadingModelUrl = config.modelUrl;
  report("loading", config.modelName || config.modelUrl);
  try {
    const [{ Live2DRenderer, createScriptTagCubismLoader }, engine] = await Promise.all([
      import("../../../../node_modules/@soullink-emotion/live2d-pixi/dist/index.js"),
      import("../../../../node_modules/@soullink-emotion/engine/dist/index.js"),
    ]);
    engineModule = engine;
    // PIXI measures its container in the constructor.  It must be visible
    // before construction or the initial model scale is calculated as zero.
    stage.style.display = "block";
    renderer = new Live2DRenderer(stage, { cubismLoader: createScriptTagCubismLoader(config.coreUrl) });
    const parameters = await renderer.load(config.modelUrl);
    const model = renderer.model;
    report("geometry", `stage=${stage.clientWidth}x${stage.clientHeight}, canvas=${renderer.app.view.width}x${renderer.app.view.height}, model=${Math.round(model && model.width || 0)}x${Math.round(model && model.height || 0)}, scale=${model && model.scale && model.scale.x}`);
    setTimeout(() => {
      let paintedAlpha = "unavailable";
      try {
        const pixels = renderer.app.renderer.extract.pixels();
        let count = 0;
        for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) count += 1;
        paintedAlpha = `${count}/${pixels.length / 4}`;
        if (count === 0) {
          report("fallback", "The loaded Cubism runtime produced a fully transparent frame; reverting to the sprite fallback.");
          disable();
          return;
        }
      } catch (error) { paintedAlpha = `error:${error && error.message}`; }
      report("render-state", `visible=${model && model.visible}, alpha=${model && model.alpha}, pos=${Math.round(model && model.x || 0)},${Math.round(model && model.y || 0)}, children=${renderer.app.stage.children.length}, textureValid=${!!(model && model.textures && model.textures[0] && model.textures[0].valid)}, renderable=${model && model.renderable}, paintedAlpha=${paintedAlpha}, stageZ=${getComputedStyle(stage).zIndex}`);
    }, 750);
    runtime = new engine.SoullinkRuntime({ profile: createProfile(config.modelUrl, parameters), motionStyle: engine.motionStylePresets.calm });
    startedAt = performance.now() / 1000;
    previousAt = startedAt;
    active = true;
    petContainer && petContainer.classList.add("live2d-active");
    sprite.style.visibility = "hidden";
    const tick = (milliseconds) => {
      if (!active || !runtime || !renderer) return;
      const now = milliseconds / 1000;
      const seconds = now - startedAt;
      const delta = Math.min(0.1, Math.max(0, now - previousAt));
      previousAt = now;
      const snapshot = runtime.update(seconds, delta);
      renderer.applyNativeAnimation(snapshot.nativeAnimation);
      renderer.setParameters(snapshot.live2dParams);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    report("ready", config.modelName || config.modelUrl);
  } catch (error) {
    console.warn("[live2d] loading failed; using sprite fallback", error && error.message);
    report("error", error && (error.stack || error.message) || String(error));
    disable();
  } finally {
    if (loadingModelUrl === config.modelUrl) loadingModelUrl = null;
  }
}

function disable() {
  active = false;
  configuredModelUrl = null;
  loadingModelUrl = null;
  if (frame) cancelAnimationFrame(frame);
  frame = null;
  try { renderer && renderer.destroy(); } catch {}
  renderer = null; runtime = null;
  if (stage) stage.style.display = "none";
  if (petContainer) petContainer.classList.remove("live2d-active");
  if (sprite) sprite.style.visibility = "";
}

function normalizeBlend(value) {
  const primary = typeof value === "string" ? value : value && value.primary;
  const safePrimary = EMOTIONS.has(primary) ? primary : "calm";
  const secondary = value && typeof value === "object" && EMOTIONS.has(value.secondary) && value.secondary !== safePrimary && value.secondary !== "calm"
    ? value.secondary : undefined;
  let primaryWeight = Number(value && typeof value === "object" ? value.primaryWeight : 1);
  let secondaryWeight = Number(value && typeof value === "object" ? value.secondaryWeight : 0);
  if (!secondary) { primaryWeight = 1; secondaryWeight = 0; }
  else {
    if (!Number.isFinite(primaryWeight) || primaryWeight <= 0) primaryWeight = 0.7;
    if (!Number.isFinite(secondaryWeight) || secondaryWeight <= 0) secondaryWeight = 0.3;
    const total = primaryWeight + secondaryWeight;
    primaryWeight /= total; secondaryWeight /= total;
  }
  const rawIntensity = Number(value && typeof value === "object" ? value.intensity : undefined);
  const intensity = Number.isFinite(rawIntensity) ? Math.min(1, Math.max(0.2, rawIntensity)) : (safePrimary === "calm" ? 0.2 : 0.75);
  return { primary: safePrimary, secondary, primaryWeight, secondaryWeight, intensity };
}

const VAD_PRESET = { calm: "calm", focused: "curious", happy: "happy", shy: "shy", surprised: "surprised", sleepy: "tired", sad: "sad", annoyed: "anger" };

function blendVAD(blend) {
  const presets = engineModule && engineModule.emotionVADPresets;
  if (!presets) return undefined;
  const primary = presets[VAD_PRESET[blend.primary] || "calm"] || presets.calm;
  if (!blend.secondary) return primary;
  const secondary = presets[VAD_PRESET[blend.secondary] || "calm"] || presets.calm;
  return {
    valence: primary.valence * blend.primaryWeight + secondary.valence * blend.secondaryWeight,
    arousal: primary.arousal * blend.primaryWeight + secondary.arousal * blend.secondaryWeight,
    dominance: primary.dominance * blend.primaryWeight + secondary.dominance * blend.secondaryWeight,
  };
}

function triggerEmotion(value) {
  if (!active || !runtime) return;
  const blend = normalizeBlend(value);
  const emotion = blend.primary;
  const now = performance.now() / 1000 - startedAt;
  runtime.triggerIntent(
    { emotion, naturalEmotion: emotion, intensity: blend.intensity, contextTags: ["desktop-pet"] },
    now,
    { vadTarget: blendVAD(blend) },
  );
}

window.live2dPet = {
  configure: enable,
  setState: (state) => {
    currentState = state || "idle";
    triggerEmotion(STATE_EMOTION[currentState] || latestChatBlend);
  },
  setEmotion: (value) => {
    latestChatLayer = value && typeof value === "object" && typeof value.activeLayer === "string" ? value.activeLayer : "reaction";
    latestChatBlend = normalizeBlend(value && typeof value === "object" && value.display ? value.display : value);
    if (!STATE_EMOTION[currentState]) triggerEmotion(latestChatBlend);
  },
  disable,
};
window.live2dPet.configure(window.themeConfig && window.themeConfig.live2d);

window.electronAPI.onThemeConfig((config) => window.live2dPet.configure(config && config.live2d));
window.electronAPI.onStateChange((state) => window.live2dPet.setState(state));
window.electronAPI.onChatEmotion((emotion) => window.live2dPet.setEmotion(emotion));
