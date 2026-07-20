"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("minicpm", {
  // Sidecar lifecycle
  start: (opts) => ipcRenderer.invoke("minicpm:start", opts),
  status: () => ipcRenderer.invoke("minicpm:status"),

  // Bubble window controls
  resize: (width, height) => ipcRenderer.invoke("minicpm:resize", { width, height }),
  setChatAnchor: (bottomY) => ipcRenderer.invoke("minicpm:set-chat-anchor", { bottomY }),
  hideWindow: () => ipcRenderer.invoke("minicpm:hide-window"),
  showWindow: () => ipcRenderer.invoke("minicpm:show-window"),
  focusWindow: () => ipcRenderer.invoke("minicpm:focus-window"),
  openContextMenu: () => ipcRenderer.send("minicpm:open-context-menu"),

  // Updater
  updateStatus: () => ipcRenderer.invoke("minicpm:update-status"),
  updateApply:  () => ipcRenderer.invoke("minicpm:update-apply"),

  // Chat generation parameters (shared with Settings tab)
  getChatParams: () => ipcRenderer.invoke("minicpm:get-chat-params"),
  saveChatHistory: (entry) => ipcRenderer.invoke("minicpm:save-chat-history", entry || {}),
  saveMemoryNote: (entry) => ipcRenderer.invoke("minicpm:save-memory-note", entry || {}),
  getTimeContext: () => ipcRenderer.invoke("minicpm:get-time-context"),
  getChatContext: () => ipcRenderer.invoke("minicpm:get-chat-context"),
  musicControl: (entry) => ipcRenderer.invoke("minicpm:music-control", entry || {}),
  remoteChat: async (payload, onEvent) => {
    const started = await ipcRenderer.invoke("minicpm:remote-chat-start", payload || {});
    if (!started || !started.ok) throw new Error((started && started.error) || "Could not start remote chat");
    const listener = (_event, frame) => {
      if (!frame || frame.id !== started.id) return;
      try { onEvent && onEvent(frame); } catch {}
      if (frame.event === "end" || frame.event === "error") ipcRenderer.removeListener("minicpm:remote-chat-event", listener);
    };
    ipcRenderer.on("minicpm:remote-chat-event", listener);
    return { id: started.id, cancel: () => ipcRenderer.invoke("minicpm:remote-chat-cancel", { id: started.id }) };
  },

  // Adapter (LoRA) load/unload — same IPC handler the Settings tab
  // uses, so chat-based switching ("切到猫娘") persists the user's
  // choice to prefs and shares the 90s timeout + bubble notification
  // pipeline. Pass `null` to unload.
  loadAdapter: (pathOrNull) => ipcRenderer.invoke("minicpm-settings:load-adapter", { path: pathOrNull }),

  // i18n: initial fetch + live updates
  getI18n: () => ipcRenderer.invoke("minicpm:get-i18n"),
  onLangChange: (cb) => {
    const listener = (_e, payload) => { try { cb(payload || {}); } catch {} };
    ipcRenderer.on("minicpm:lang-change", listener);
    return () => ipcRenderer.removeListener("minicpm:lang-change", listener);
  },

  // Messages from main → renderer
  onOpen:           (cb) => ipcRenderer.on("minicpm:cmd-open",            (_e, payload) => cb(payload || {})),
  onDismiss:        (cb) => ipcRenderer.on("minicpm:cmd-dismiss",         () => cb()),
  onReset:          (cb) => ipcRenderer.on("minicpm:cmd-reset",           () => cb()),
  onToggleThinking: (cb) => ipcRenderer.on("minicpm:cmd-toggle-thinking", () => cb()),
  onUpdateStatus:   (cb) => ipcRenderer.on("minicpm:update-status",       (_e, p) => cb(p || {})),
  onUpdateApplying: (cb) => ipcRenderer.on("minicpm:update-applying",     (_e, p) => cb(p || {})),
  onNarrate:        (cb) => ipcRenderer.on("minicpm:narrate",             (_e, p) => cb(p || {})),
  onCmdReply:       (cb) => ipcRenderer.on("minicpm:cmd-reply",           (_e, p) => cb(p || {})),
  onEditMode:       (cb) => ipcRenderer.on("minicpm:edit-mode",           (_e, p) => cb(p || {})),
});
