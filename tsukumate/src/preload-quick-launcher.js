"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("quickLauncher", {
  getState: () => ipcRenderer.invoke("quick-launcher:get-state"),
  openChat: () => ipcRenderer.invoke("quick-launcher:chat"),
  toggleDnd: () => ipcRenderer.invoke("quick-launcher:toggle-dnd"),
  openSettings: () => ipcRenderer.invoke("quick-launcher:settings"),
  close: () => ipcRenderer.invoke("quick-launcher:close"),
  onState: (callback) => ipcRenderer.on("quick-launcher:state", (_event, state) => callback(state)),
});
