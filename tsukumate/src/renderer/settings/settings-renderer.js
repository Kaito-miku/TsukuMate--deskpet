"use strict";

const core = globalThis.ClawdSettingsCore;

const SIDEBAR_TABS = [
  { id: "general", labelKey: "sidebarGeneral", available: true },
  { id: "api", label: "模型连接", available: true },
  { id: "memory", label: "聊天与记忆", available: true },
  { id: "learning", label: "学习检索与联网资料", available: true },
  { id: "personas", label: "人格", available: true },
  { id: "agents", labelKey: "sidebarAgents", available: true },
  { id: "appearanceGroup", label: "外观与动画", available: true },
  { id: "shortcuts", labelKey: "sidebarShortcuts", available: true },
  { id: "remote-ssh", labelKey: "sidebarRemoteSsh", available: true },
  { id: "telegram-approval", labelKey: "sidebarTelegramApproval", available: true },
  { id: "mobile", labelKey: "sidebarMobile", available: true },
  { id: "about", labelKey: "sidebarAbout", available: true },
];

const SETTINGS_GROUPS = {
  appearanceGroup: {
    tabs: [
      { id: "theme", label: "主题" },
      { id: "live2d", label: "Live2D" },
      { id: "animMap", label: "动画映射" },
      { id: "animOverrides", label: "动画覆盖" },
    ],
  },
};

const activeGroupTabs = { appearanceGroup: "theme" };

function getTabIcon(tabId) {
  const icons = globalThis.ClawdSettingsIcons;
  if (icons && typeof icons.getIcon === "function") return icons.getIcon(tabId);
  return "";
}

function groupForTab(tabId) {
  return Object.entries(SETTINGS_GROUPS).find(([, group]) => group.tabs.some((tab) => tab.id === tabId)) || null;
}

function renderSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  sidebar.innerHTML = "";
  if (
    globalThis.ClawdSettingsDoctorModal
    && typeof globalThis.ClawdSettingsDoctorModal.renderSidebarIndicator === "function"
  ) {
    globalThis.ClawdSettingsDoctorModal.renderSidebarIndicator(sidebar, core);
  }
  for (const tab of SIDEBAR_TABS) {
    const item = document.createElement("div");
    item.className = "sidebar-item";
    if (!tab.available) item.classList.add("disabled");
    const groupActive = SETTINGS_GROUPS[tab.id]
      && SETTINGS_GROUPS[tab.id].tabs.some((child) => child.id === core.state.activeTab);
    if (tab.id === core.state.activeTab || groupActive) item.classList.add("active");
    const labelText = tab.label ? tab.label : core.helpers.t(tab.labelKey);
    item.innerHTML =
      `<span class="sidebar-item-icon">${getTabIcon(tab.id)}</span>` +
      `<span class="sidebar-item-label">${core.helpers.escapeHtml(labelText)}</span>` +
      (tab.available ? "" : `<span class="sidebar-item-soon">${core.helpers.escapeHtml(core.helpers.t("sidebarSoon"))}</span>`);
    if (tab.available) {
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      const select = () => {
        core.ops.selectTab(SETTINGS_GROUPS[tab.id] ? activeGroupTabs[tab.id] : tab.id);
      };
      // Settings is a non-focusable floating window on macOS. Its first
      // click can be consumed while the window becomes key, so switch on
      // pointerdown as well as click. selectTab is idempotent for the same id.
      item.addEventListener("pointerdown", (event) => {
        if (event.button === 0) select();
      });
      item.addEventListener("click", select);
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select();
        }
      });
    }
    sidebar.appendChild(item);
  }
}

function renderPlaceholder(parent) {
  const div = document.createElement("div");
  div.className = "placeholder";
  div.innerHTML =
    `<div class="placeholder-icon">${getTabIcon("placeholder")}</div>` +
    `<div class="placeholder-title">${core.helpers.escapeHtml(core.helpers.t("placeholderTitle"))}</div>` +
    `<div class="placeholder-desc">${core.helpers.escapeHtml(core.helpers.t("placeholderDesc"))}</div>`;
  parent.appendChild(div);
}

function renderSettingsGroup(parent, groupId) {
  const group = SETTINGS_GROUPS[groupId];
  if (!group) return;
  const currentIsChild = group.tabs.some((tab) => tab.id === core.state.activeTab);
  const selectedId = currentIsChild ? core.state.activeTab : (activeGroupTabs[groupId] || group.tabs[0].id);
  activeGroupTabs[groupId] = selectedId;
  const switcher = document.createElement("div");
  switcher.className = "settings-group-switcher";
  switcher.setAttribute("role", "tablist");
  for (const item of group.tabs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `settings-group-tab${item.id === selectedId ? " active" : ""}`;
    button.textContent = item.label;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(item.id === selectedId));
    button.addEventListener("click", () => {
      if (activeGroupTabs[groupId] === item.id) return;
      activeGroupTabs[groupId] = item.id;
      core.ops.selectTab(item.id);
    });
    switcher.appendChild(button);
  }
  parent.appendChild(switcher);
  const child = document.createElement("div");
  child.className = "settings-group-content";
  parent.appendChild(child);
  const tab = core.tabs[selectedId];
  if (tab && typeof tab.render === "function") tab.render(child, core);
  else renderPlaceholder(child);
}

function renderContent() {
  const content = document.getElementById("content");
  if (!content) return;
  core.ops.clearMountedControls();
  content.innerHTML = "";
  const activeGroup = groupForTab(core.state.activeTab);
  if (activeGroup) {
    renderSettingsGroup(content, activeGroup[0]);
    return;
  }
  const tab = core.tabs[core.state.activeTab];
  if (tab && typeof tab.render === "function") {
    tab.render(content, core);
  } else {
    renderPlaceholder(content);
  }
}

core.ops.installRenderHooks({
  sidebar: renderSidebar,
  content: renderContent,
});

globalThis.ClawdSettingsTabGeneral.init(core);
globalThis.ClawdSettingsTabAgents.init(core);
globalThis.ClawdSettingsTabTheme.init(core);
if (globalThis.ClawdSettingsTabLive2d) globalThis.ClawdSettingsTabLive2d.init(core);
globalThis.ClawdSettingsTabAnimMap.init(core);
globalThis.ClawdSettingsTabAnimOverrides.init(core);
globalThis.ClawdSettingsTabShortcuts.init(core);
if (globalThis.ClawdSettingsTabTelegramApproval) globalThis.ClawdSettingsTabTelegramApproval.init(core);
globalThis.ClawdSettingsTabAbout.init(core);
if (globalThis.ClawdSettingsTabRemoteSsh) globalThis.ClawdSettingsTabRemoteSsh.init(core);
if (globalThis.ClawdSettingsTabMobile) globalThis.ClawdSettingsTabMobile.init(core);
if (globalThis.ClawdSettingsTabMinicpm) globalThis.ClawdSettingsTabMinicpm.init(core);
if (globalThis.ClawdSettingsTabApi) globalThis.ClawdSettingsTabApi.init(core);
if (globalThis.ClawdSettingsTabMemory) globalThis.ClawdSettingsTabMemory.init(core);
if (globalThis.ClawdSettingsTabLearning) globalThis.ClawdSettingsTabLearning.init(core);
if (globalThis.ClawdSettingsTabPersonas) globalThis.ClawdSettingsTabPersonas.init(core);

if (window.settingsAPI && typeof window.settingsAPI.onChanged === "function") {
  window.settingsAPI.onChanged((payload) => core.ops.applyChanges(payload));
}

if (window.settingsAPI && typeof window.settingsAPI.onAnimationPreviewPosterReady === "function") {
  window.settingsAPI.onAnimationPreviewPosterReady((payload) => core.ops.applyAnimationPreviewPoster(payload));
}

if (window.settingsAPI && typeof window.settingsAPI.onShortcutRecordKey === "function") {
  window.settingsAPI.onShortcutRecordKey((payload) => core.ops.handleShortcutRecordKey(payload));
}

if (window.settingsAPI && typeof window.settingsAPI.onShortcutFailuresChanged === "function") {
  window.settingsAPI.onShortcutFailuresChanged((failures) => core.ops.applyShortcutFailures(failures));
}

if (window.settingsAPI && typeof window.settingsAPI.getShortcutFailures === "function") {
  window.settingsAPI.getShortcutFailures().then((failures) => {
    core.ops.applyShortcutFailures(failures);
  }).catch((err) => {
    console.warn("settings: getShortcutFailures failed", err);
  });
}

if (window.settingsAPI && typeof window.settingsAPI.getSnapshot === "function") {
  window.settingsAPI.getSnapshot().then((snapshot) => {
    core.ops.applyBootstrap(snapshot);
  });
}

if (window.settingsAPI && typeof window.settingsAPI.listAgents === "function") {
  window.settingsAPI.listAgents().then((list) => {
    core.ops.applyAgentMetadata(list);
  }).catch((err) => {
    console.warn("settings: listAgents failed", err);
    core.ops.applyAgentMetadata([]);
  });
}
