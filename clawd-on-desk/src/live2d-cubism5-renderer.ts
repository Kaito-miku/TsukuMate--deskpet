/*
 * Cubism 5 renderer bridge.
 * Official Cubism Framework/sample classes are bundled from the SDK the user
 * installed locally; their original Live2D Open Software notices are retained
 * inside the generated bundle by esbuild.
 */
import { CubismFramework, LogLevel, Option } from "@framework/live2dcubismframework";
import { LAppSubdelegate } from "../../CubismSdkForWeb-5-r.5/Samples/TypeScript/Demo/src/lappsubdelegate";
import { LAppModel } from "../../CubismSdkForWeb-5-r.5/Samples/TypeScript/Demo/src/lappmodel";
import { LAppPal } from "../../CubismSdkForWeb-5-r.5/Samples/TypeScript/Demo/src/lapppal";
import { SoullinkRuntime, motionStylePresets } from "@soullink-emotion/engine";

const stage = document.getElementById("live2d-stage") as HTMLElement;
const container = document.getElementById("pet-container") as HTMLElement;
let canvas: HTMLCanvasElement | null = null;
let subdelegate: any = null;
let model: any = null;
let runtime: any = null;
let raf = 0;
let generation = 0;
let startedAt = 0;
let previousAt = 0;
let currentConfig: any = null;
let emotion = "calm";
let pendingMotion: string | null = null;
let pendingMotionTimer = 0;
let pendingMotionRetries = 0;

function applyView(config: any) {
  const scale = Number.isFinite(config && config.scale) ? config.scale : 1;
  const x = Number.isFinite(config && config.offsetX) ? config.offsetX : 0;
  const y = Number.isFinite(config && config.offsetY) ? config.offsetY : 0;
  stage.style.transformOrigin = "50% 50%";
  stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function report(stageName: string, message = "") {
  try { (window as any).electronAPI.reportLive2dStatus({ stage: stageName, message }); } catch {}
}

function loadScript(url: string): Promise<void> {
  if ((window as any).Live2DCubismCore) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.onload = () => (window as any).Live2DCubismCore ? resolve() : reject(new Error("Cubism Core global is missing"));
    script.onerror = () => reject(new Error("Failed to load Cubism 5 Core"));
    document.head.appendChild(script);
  });
}

function makeProfile(modelUrl: string) {
  return {
    modelId: "cubism5-desktop", displayName: "Cubism 5 Desktop", version: "1", modelPath: modelUrl,
    parameterMap: {
      headX: { target: "ParamAngleX" }, headY: { target: "ParamAngleY" }, headZ: { target: "ParamAngleZ" },
      bodyX: { target: "ParamBodyAngleX" }, gazeX: { target: "ParamEyeBallX" }, gazeY: { target: "ParamEyeBallY" },
      eyeBlinkL: { target: "ParamEyeLOpen", scale: -1, offset: 1 }, eyeBlinkR: { target: "ParamEyeROpen", scale: -1, offset: 1 },
      mouthOpen: { target: "ParamMouthOpenY" }, mouthSmile: { target: "ParamMouthForm" }, breath: { target: "ParamBreath" },
    },
    idleConfig: { breath: [0.08, 0.18] }, neutralParams: {}, parameterSmoothing: {},
  } as any;
}

function applyParams(params: Record<string, number>) {
  const coreModel = model && model.getModel && model.getModel();
  if (!coreModel) return;
  for (const [id, value] of Object.entries(params || {})) {
    try { coreModel.setParameterValueById(id, value); } catch {}
  }
}

function stop() {
  generation++;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (pendingMotionTimer) window.clearTimeout(pendingMotionTimer);
  pendingMotionTimer = 0;
  pendingMotion = null;
  pendingMotionRetries = 0;
  try { subdelegate && subdelegate.release(); } catch {}
  subdelegate = null; model = null; runtime = null;
  if (canvas) canvas.remove();
  canvas = null;
  stage.style.display = "none";
  container.classList.remove("live2d-active");
}

async function configure(config: any) {
  if (!config || !config.enabled || !config.modelUrl || !config.coreUrl) { stop(); return; }
  applyView(config);
  if (currentConfig && currentConfig.modelUrl === config.modelUrl && model) { currentConfig = config; return; }
  stop();
  currentConfig = config;
  const token = generation;
  try {
    report("cubism5-loading", config.modelName || config.modelUrl);
    await loadScript(config.coreUrl);
    if (token !== generation) return;
    if (!CubismFramework.isStarted()) {
      const option = new Option();
      option.loggingLevel = LogLevel.LogLevel_Warning;
      option.logFunction = (message: string) => report("cubism5-log", message);
      CubismFramework.startUp(option);
      CubismFramework.initialize();
    }
    stage.style.display = "block";
    canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    stage.appendChild(canvas);
    subdelegate = new LAppSubdelegate();
    if (!subdelegate.initialize(canvas)) throw new Error("Cubism 5 WebGL initialization failed");
    // The official desktop sample clears to opaque black.  The pet window is
    // transparent, so use the same update pipeline with alpha=0.
    subdelegate.update = function() {
      const gl = this._glManager.getGl();
      if (gl.isContextLost()) return;
      if (this._needResize) { this.onResize(); this._needResize = false; }
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.clearDepth(1);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      this._view.render();
    };

    const manager: any = subdelegate.getLive2DManager();
    manager._models.length = 0;
    model = new LAppModel();
    model.setSubdelegate(subdelegate);
    // The SDK sample expects shaders beside its own demo HTML.  Our model is
    // served from a loopback asset server, so direct the official renderer to
    // that allow-listed Framework shader directory instead.
    if (config.shaderUrl) {
      model.doDraw = function() {
        const gl = this._subdelegate.getGl();
        const viewport = [0, 0, gl.canvas.width, gl.canvas.height];
        this.getRenderer().setRenderState(this._subdelegate.getFrameBuffer(), viewport);
        this.getRenderer().drawModel(config.shaderUrl);
      };
    }
    const url = new URL(config.modelUrl);
    const slash = url.pathname.lastIndexOf("/");
    const fileName = decodeURIComponent(url.pathname.slice(slash + 1));
    const modelDir = config.modelUrl.slice(0, config.modelUrl.lastIndexOf("/") + 1);
    model.loadAssets(modelDir, fileName);
    manager._models.push(model);

    runtime = new SoullinkRuntime({ profile: makeProfile(config.modelUrl), motionStyle: motionStylePresets.calm });
    const originalUpdate = model.update.bind(model);
    model.update = () => {
      originalUpdate();
      if (!runtime) return;
      const now = performance.now() / 1000;
      const snapshot = runtime.update(now - startedAt, Math.min(0.1, Math.max(0, now - previousAt)));
      previousAt = now;
      applyParams(snapshot.live2dParams);
    };
    startedAt = previousAt = performance.now() / 1000;
    container.classList.add("live2d-active");

    const loop = () => {
      if (token !== generation || !subdelegate) return;
      LAppPal.updateTime();
      subdelegate.update();
      raf = requestAnimationFrame(loop);
    };
    loop();

    const deadline = Date.now() + 10000;
    const readyCheck = () => {
      if (token !== generation) return;
      if (model && model.getModel && model.getModel()) {
        report("cubism5-ready", config.modelName || config.modelUrl);
        setEmotion(emotion);
      } else if (Date.now() < deadline) setTimeout(readyCheck, 100);
      else { report("cubism5-error", "Model setup timed out"); stop(); }
    };
    readyCheck();
  } catch (error: any) {
    report("cubism5-error", error && (error.stack || error.message) || String(error));
    stop();
  }
}

function setEmotion(next: string) {
  emotion = next || "calm";
  if (!runtime) return;
  const now = performance.now() / 1000 - startedAt;
  runtime.triggerIntent({ emotion, naturalEmotion: emotion, intensity: emotion === "calm" ? 0.25 : 0.75, contextTags: ["desktop-pet"] }, now);
  const motionByEmotion: Record<string, string> = { happy: "Tap", shy: "Tap@Body", surprised: "Flick", sad: "FlickDown", annoyed: "Flick@Body", focused: "Flick@Body" };
  if (motionByEmotion[emotion]) playMotion(motionByEmotion[emotion]);
}

function playMotion(group: string) {
  if (!model || typeof model.startRandomMotion !== "function") return;
  // LAppModel exposes the loaded motion cache before it exposes a formal
  // readiness event.  Queue interactions arriving during model startup so an
  // early AI emotion does not produce "Can't start motion" and disappear.
  const loaded = model._motions;
  const hasGroup = loaded && typeof loaded.keys === "function"
    && Array.from(loaded.keys()).some((key: any) => String(key).startsWith(`${group}_`));
  if (!hasGroup) {
    if (pendingMotion !== group) pendingMotionRetries = 0;
    pendingMotion = group;
    if (!pendingMotionTimer) {
      const retry = () => {
        pendingMotionTimer = 0;
        const next = pendingMotion;
        if (!next || !model) return;
        const entries = model._motions;
        const ready = entries && typeof entries.keys === "function"
          && Array.from(entries.keys()).some((key: any) => String(key).startsWith(`${next}_`));
        if (ready) {
          pendingMotion = null;
          pendingMotionRetries = 0;
          try { model.startRandomMotion(next, 2); } catch {}
        } else if (++pendingMotionRetries < 50) {
          pendingMotionTimer = window.setTimeout(retry, 100);
        } else {
          pendingMotion = null;
          pendingMotionRetries = 0;
        }
      };
      pendingMotionTimer = window.setTimeout(retry, 100);
    }
    return;
  }
  pendingMotion = null;
  pendingMotionRetries = 0;
  try { model.startRandomMotion(group, 2); } catch {}
}

const stateEmotion: Record<string, string> = { thinking: "focused", working: "focused", attention: "happy", error: "sad", sleeping: "sleepy", notification: "surprised" };
const api: any = (window as any).electronAPI;
api.onThemeConfig((cfg: any) => configure(cfg && cfg.live2d));
api.onStateChange((state: string) => setEmotion(stateEmotion[state] || "calm"));
api.onChatEmotion((next: string) => setEmotion(next));
api.onPlayClickReaction(() => playMotion("Tap"));
api.onStartDragReaction((direction: string) => {
  playMotion(direction === "left" || direction === "right" ? "Flick@Body" : "Flick");
  try { model && model.setDragging(direction === "left" ? -0.8 : direction === "right" ? 0.8 : 0, 0); } catch {}
});
api.onEndDragReaction(() => { try { model && model.setDragging(0, 0); } catch {} });
configure((window as any).themeConfig && (window as any).themeConfig.live2d);
