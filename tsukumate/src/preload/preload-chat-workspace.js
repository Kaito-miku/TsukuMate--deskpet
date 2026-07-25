"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const themeArg = process.argv.find((value) => value.startsWith("--theme-config="));
contextBridge.exposeInMainWorld("themeConfig", themeArg ? JSON.parse(themeArg.slice(15)) : null);
const live2dStatusListeners = new Set();
let lastLive2dStatus = { phase: "loading", message: "正在加载 Live2D…" };

contextBridge.exposeInMainWorld("chatWorkspace", {
  getSession: () => ipcRenderer.invoke("chat-workspace:get-session"),
  getConnectionStatus: () => ipcRenderer.invoke("chat-workspace:get-connection-status"),
  send: (payload) => ipcRenderer.invoke("chat-workspace:send", payload || {}),
  cancel: () => ipcRenderer.invoke("chat-workspace:cancel"),
  listScreenSources: () => ipcRenderer.invoke("chat-workspace:screen-list"),
  captureScreen: (sourceId) => ipcRenderer.invoke("chat-workspace:screen-take", { sourceId }),
  discardScreenCapture: (token) => ipcRenderer.invoke("chat-workspace:screen-discard", { token }),
  openScreenRecordingSettings: () => ipcRenderer.invoke("chat-workspace:screen-settings"),
  reloadLive2d: () => ipcRenderer.invoke("chat-workspace:reload-live2d"),
  getLive2dStatus: () => ({ ...lastLive2dStatus }),
  listHistory: () => ipcRenderer.invoke("chat-workspace:list-history"),
  loadHistory: (date, options = {}) => ipcRenderer.invoke("chat-workspace:load-history", { date, before: options.before, limit: options.limit }),
  listDiaries: () => ipcRenderer.invoke("chat-workspace:list-diaries"),
  loadDiary: (date) => ipcRenderer.invoke("chat-workspace:load-diary", { date }),
  saveDiary: (date, content) => ipcRenderer.invoke("chat-workspace:save-diary", { date, content }),
  generateDiary: (date) => ipcRenderer.invoke("chat-workspace:generate-diary", { date }),
  openDiaryFolder: () => ipcRenderer.invoke("chat-workspace:open-diary-folder"),
  onSession: (callback) => {
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on("chat-workspace:session", listener);
    return () => ipcRenderer.removeListener("chat-workspace:session", listener);
  },
});

contextBridge.exposeInMainWorld("electronAPI", {
  onThemeConfig: (callback) => ipcRenderer.on("theme-config", (_event, value) => callback(value)),
  onStateChange: (callback) => ipcRenderer.on("state-change", (_event, state, svg) => callback(state, svg)),
  onChatEmotion: (callback) => ipcRenderer.on("chat-emotion", (_event, value) => callback(value)),
  onPlayClickReaction: (callback) => ipcRenderer.on("play-click-reaction", (_event, svg, duration) => callback(svg, duration)),
  onStartDragReaction: (callback) => ipcRenderer.on("start-drag-reaction", (_event, direction) => callback(direction)),
  onEndDragReaction: (callback) => ipcRenderer.on("end-drag-reaction", () => callback()),
  onLive2dStatus: (callback) => {
    live2dStatusListeners.add(callback);
    try { callback({ ...lastLive2dStatus }); } catch {}
    return () => live2dStatusListeners.delete(callback);
  },
  reportLive2dStatus: (payload) => {
    const stage = String(payload && (payload.phase || payload.stage) || "loading");
    const lifecycleEvent = ["cubism5-ready", "cubism5-error", "cubism5-disabled", "cubism5-recovering", "cubism5-loading"].includes(stage);
    const phase = !lifecycleEvent ? lastLive2dStatus.phase : stage === "cubism5-ready" ? "ready"
      : stage === "cubism5-error" ? "error"
        : stage === "cubism5-disabled" ? "disabled"
          : stage === "cubism5-recovering" ? "recovering" : "loading";
    const safe = { ...(payload || {}), phase };
    lastLive2dStatus = safe;
    for (const listener of live2dStatusListeners) { try { listener(safe); } catch {} }
    ipcRenderer.send("live2d-status", safe);
  },
});
