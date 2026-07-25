"use strict";

const path = require("path");
const { PRELOAD_ROOT } = require("./main/paths");

const WIDTH = 284;
const HEIGHT = 284;
const GAP = 14;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeQuickLauncherBounds(pet, workArea, size = { width: WIDTH, height: HEIGHT }) {
  if (!pet || !workArea) return null;
  const candidates = [
    { x: pet.x + pet.width + GAP, y: pet.y + Math.round((pet.height - size.height) / 2) },
    { x: pet.x - size.width - GAP, y: pet.y + Math.round((pet.height - size.height) / 2) },
    { x: pet.x + Math.round((pet.width - size.width) / 2), y: pet.y - size.height - GAP },
    { x: pet.x + Math.round((pet.width - size.width) / 2), y: pet.y + pet.height + GAP },
  ];
  const fits = (p) => p.x >= workArea.x && p.y >= workArea.y
    && p.x + size.width <= workArea.x + workArea.width
    && p.y + size.height <= workArea.y + workArea.height;
  const chosen = candidates.find(fits) || candidates[0];
  return {
    x: clamp(chosen.x, workArea.x, workArea.x + workArea.width - size.width),
    y: clamp(chosen.y, workArea.y, workArea.y + workArea.height - size.height),
    width: size.width,
    height: size.height,
  };
}

function createQuickLauncher(options = {}) {
  const { BrowserWindow, ipcMain } = options;
  let window = null;

  const isLauncherSender = (event) => !!window && !window.isDestroyed()
    && event && event.sender === window.webContents;

  function getState() {
    return {
      dndEnabled: !!options.getDoNotDisturb(),
      lang: options.getLang() || "en",
      live2d: !!options.isLive2dEnabled(),
    };
  }

  function sendState() {
    if (window && !window.isDestroyed()) window.webContents.send("quick-launcher:state", getState());
  }

  function hide() {
    if (window && !window.isDestroyed()) window.hide();
  }

  function ensureWindow() {
    if (window && !window.isDestroyed()) return window;
    window = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      show: false,
      alwaysOnTop: true,
      hasShadow: false,
      webPreferences: {
        preload: path.join(PRELOAD_ROOT, "preload-quick-launcher.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    window.setAlwaysOnTop(true, process.platform === "darwin" ? "screen-saver" : "pop-up-menu");
    window.loadFile(path.join(__dirname, "quick-launcher.html"));
    window.on("blur", hide);
    window.on("closed", () => { window = null; });
    window.webContents.on("did-finish-load", sendState);
    return window;
  }

  function show() {
    if (options.isPetHidden() || options.isMiniMode()) return false;
    const pet = options.getPetWindowBounds();
    const workArea = options.getNearestWorkArea(pet.x + pet.width / 2, pet.y + pet.height / 2);
    const bounds = computeQuickLauncherBounds(pet, workArea);
    if (!bounds) return false;
    const target = ensureWindow();
    target.setBounds(bounds);
    sendState();
    target.show();
    target.focus();
    return true;
  }

  function toggle() {
    if (window && !window.isDestroyed() && window.isVisible()) {
      hide();
      return false;
    }
    return show();
  }

  const handlers = {
    "quick-launcher:get-state": (event) => isLauncherSender(event) ? getState() : null,
    "quick-launcher:chat": (event) => {
      if (!isLauncherSender(event)) return;
      hide();
      options.openChat();
    },
    "quick-launcher:settings": (event) => {
      if (!isLauncherSender(event)) return;
      hide();
      options.openSettings();
    },
    "quick-launcher:toggle-dnd": (event) => {
      if (!isLauncherSender(event)) return;
      if (options.getDoNotDisturb()) options.disableDoNotDisturb();
      else options.enableDoNotDisturb();
      sendState();
    },
    "quick-launcher:close": (event) => { if (isLauncherSender(event)) hide(); },
  };
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, handler);
  }

  return {
    show,
    hide,
    toggle,
    sendState,
    isVisible: () => !!window && !window.isDestroyed() && window.isVisible(),
    destroy() {
      for (const channel of Object.keys(handlers)) ipcMain.removeHandler(channel);
      if (window && !window.isDestroyed()) window.destroy();
      window = null;
    },
  };
}

module.exports = { createQuickLauncher, computeQuickLauncherBounds, WIDTH, HEIGHT };
