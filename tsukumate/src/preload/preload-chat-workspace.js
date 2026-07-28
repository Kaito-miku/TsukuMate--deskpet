"use strict";

const { contextBridge, ipcRenderer } = require("electron");
const whepPeers = new Map();
async function waitForIce(peer) { if (peer.iceGatheringState === "complete") return; await new Promise((resolve) => { const done = () => { if (peer.iceGatheringState === "complete") { peer.removeEventListener("icegatheringstatechange", done); resolve(); } }; peer.addEventListener("icegatheringstatechange", done); setTimeout(resolve, 1800); }); }
async function startWhepStream(streamId, elementId) {
  const target = document.getElementById(String(elementId || "")); if (!(target instanceof HTMLVideoElement)) return { ok: false, error: "找不到实时流播放器" };
  const config = await ipcRenderer.invoke("chat-workspace:get-a2ui-whep-config", { streamId }); if (!config?.ok) return config || { ok: false, error: "实时流不可用" };
  try { whepPeers.get(elementId)?.close(); const peer = new RTCPeerConnection(); whepPeers.set(elementId, peer); const stream = new MediaStream(); target.srcObject = stream; target.muted = true; target.playsInline = true;
    peer.ontrack = (event) => event.streams[0]?.getTracks().forEach((track) => { if (!stream.getTrackById(track.id)) stream.addTrack(track); });
    peer.addTransceiver("video", { direction: "recvonly" }); peer.addTransceiver("audio", { direction: "recvonly" }); const offer = await peer.createOffer(); await peer.setLocalDescription(offer); await waitForIce(peer);
    const response = await fetch(config.endpoint, { method: "POST", headers: { "content-type": "application/sdp", ...(config.token ? { authorization: `Bearer ${config.token}` } : {}) }, body: peer.localDescription?.sdp || "" });
    if (!response.ok) throw new Error(`WHEP 服务返回 ${response.status}`); await peer.setRemoteDescription({ type: "answer", sdp: await response.text() }); await target.play().catch(() => {}); return { ok: true };
  } catch (error) { whepPeers.get(elementId)?.close(); whepPeers.delete(elementId); return { ok: false, error: String(error?.message || error) }; }
}
function stopWhepStream(elementId) { const peer = whepPeers.get(String(elementId || "")); peer?.close(); whepPeers.delete(String(elementId || "")); const target = document.getElementById(String(elementId || "")); if (target instanceof HTMLVideoElement) target.srcObject = null; return { ok: true }; }

const themeArg = process.argv.find((value) => value.startsWith("--theme-config="));
contextBridge.exposeInMainWorld("themeConfig", themeArg ? JSON.parse(themeArg.slice(15)) : null);
const live2dStatusListeners = new Set();
let lastLive2dStatus = { phase: "loading", message: "正在加载 Live2D…" };

contextBridge.exposeInMainWorld("chatWorkspace", {
  getSession: () => ipcRenderer.invoke("chat-workspace:get-session"),
  getConnectionStatus: () => ipcRenderer.invoke("chat-workspace:get-connection-status"),
  send: (payload) => ipcRenderer.invoke("chat-workspace:send", payload || {}),
  cancel: () => ipcRenderer.invoke("chat-workspace:cancel"),
  createConversation: () => ipcRenderer.invoke("chat-workspace:create-conversation"),
  listConversations: () => ipcRenderer.invoke("chat-workspace:list-conversations"),
  deleteConversation: (id) => ipcRenderer.invoke("chat-workspace:delete-conversation", { id }),
  loadConversation: (id) => ipcRenderer.invoke("chat-workspace:load-conversation", { id }),
  clearContext: () => ipcRenderer.invoke("chat-workspace:clear-context"),
  updateTitle: (title) => ipcRenderer.invoke("chat-workspace:update-title", { title }),
  selectAttachments: () => ipcRenderer.invoke("chat-workspace:select-attachments"),
  pasteImage: (payload) => ipcRenderer.invoke("chat-workspace:paste-image", {
    dataUrl: String(payload?.dataUrl || ""),
    mimeType: String(payload?.mimeType || ""),
  }),
  discardAttachment: (id) => ipcRenderer.invoke("chat-workspace:discard-attachment", { id }),
  openAttachment: (id) => ipcRenderer.invoke("chat-workspace:open-attachment", { id }),
  getA2uiSource: (id, kind) => ipcRenderer.invoke("chat-workspace:get-a2ui-source", { id, kind }),
  performA2uiAction: (payload) => ipcRenderer.invoke("chat-workspace:perform-a2ui-action", payload || {}),
  addA2uiModels: () => ipcRenderer.invoke("chat-workspace:add-a2ui-models"),
  getA2uiModel: (id) => ipcRenderer.invoke("chat-workspace:get-a2ui-model", { id }),
  startA2uiStream: (streamId, elementId) => startWhepStream(streamId, elementId),
  stopA2uiStream: (elementId) => stopWhepStream(elementId),
  reloadLive2d: () => ipcRenderer.invoke("chat-workspace:reload-live2d"),
  getLive2dStatus: () => ({ ...lastLive2dStatus }),
  listHistory: () => ipcRenderer.invoke("chat-workspace:list-history"),
  loadHistory: (date, options = {}) => ipcRenderer.invoke("chat-workspace:load-history", { date, before: options.before, limit: options.limit }),
  listDiaries: () => ipcRenderer.invoke("chat-workspace:list-diaries"),
  loadDiary: (date) => ipcRenderer.invoke("chat-workspace:load-diary", { date }),
  saveDiary: (date, content) => ipcRenderer.invoke("chat-workspace:save-diary", { date, content }),
  generateDiary: (date) => ipcRenderer.invoke("chat-workspace:generate-diary", { date }),
  openDiaryFolder: () => ipcRenderer.invoke("chat-workspace:open-diary-folder"),
  listLearningNotes: () => ipcRenderer.invoke("chat-workspace:list-learning-notes"),
  getLearningNote: (id) => ipcRenderer.invoke("chat-workspace:get-learning-note", { id }),
  saveLearningNote: (note) => ipcRenderer.invoke("chat-workspace:save-learning-note", note || {}),
  noteFromMessage: (messageId) => ipcRenderer.invoke("chat-workspace:note-from-message", { messageId }),
  deleteLearningNote: (id) => ipcRenderer.invoke("chat-workspace:delete-learning-note", { id }),
  addLearningResources: () => ipcRenderer.invoke("chat-workspace:add-learning-resources"),
  listLearningResources: () => ipcRenderer.invoke("chat-workspace:list-learning-resources"),
  getLearningResource: (id) => ipcRenderer.invoke("chat-workspace:get-learning-resource", { id }),
  retryLearningResource: (id) => ipcRenderer.invoke("chat-workspace:retry-learning-resource", { id }),
  deleteLearningResource: (id) => ipcRenderer.invoke("chat-workspace:delete-learning-resource", { id }),
  listPractices: () => ipcRenderer.invoke("chat-workspace:list-practices"),
  getLearningSearchStatus: () => ipcRenderer.invoke("chat-workspace:get-learning-search-status"),
  getPractice: (id) => ipcRenderer.invoke("chat-workspace:get-practice", { id }),
  deletePractice: (id) => ipcRenderer.invoke("chat-workspace:delete-practice", { id }),
  generatePractice: (payload) => ipcRenderer.invoke("chat-workspace:generate-practice", payload || {}),
  selectPracticeImage: () => ipcRenderer.invoke("chat-workspace:select-practice-image"),
  submitPractice: (payload) => ipcRenderer.invoke("chat-workspace:submit-practice", payload || {}),
  submitPracticeBatch: (payload) => ipcRenderer.invoke("chat-workspace:submit-practice-batch", payload || {}),
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
