"use strict";

const COPY = {
  en: { chat: "Chat", sleep: "Quiet", wake: "Wake", settings: "Settings", close: "Close", hints: ["Start a conversation", "Enable Do Not Disturb", "Personalize", "Hide menu"] },
  zh: { chat: "问答", sleep: "休眠", wake: "唤醒", settings: "设置", close: "关闭", hints: ["开始对话", "开启免打扰", "个性化", "收起菜单"] },
  "zh-TW": { chat: "問答", sleep: "休眠", wake: "喚醒", settings: "設定", close: "關閉", hints: ["開始對話", "開啟勿擾模式", "個人化", "收起選單"] },
  ja: { chat: "チャット", sleep: "休眠", wake: "起こす", settings: "設定", close: "閉じる", hints: ["会話を始める", "おやすみモード", "カスタマイズ", "メニューを閉じる"] },
  ko: { chat: "대화", sleep: "휴식", wake: "깨우기", settings: "설정", close: "닫기", hints: ["대화 시작", "방해 금지 켜기", "개인 설정", "메뉴 숨기기"] },
};

function applyState(state = {}) {
  const lang = COPY[state.lang] ? state.lang : "en";
  const copy = COPY[lang];
  document.documentElement.lang = lang;
  document.querySelector('[data-label="chat"]').textContent = copy.chat;
  document.querySelector('[data-label="dnd"]').textContent = state.dndEnabled ? copy.wake : copy.sleep;
  document.querySelector('[data-label="settings"]').textContent = copy.settings;
  document.querySelector('[data-label="close"]').textContent = copy.close;
  ["chat", "dnd", "settings", "close"].forEach((key, index) => {
    document.querySelector(`[data-hint="${key}"]`).textContent = copy.hints[index];
  });
  document.querySelector('[data-action="dnd"]').setAttribute("aria-pressed", String(!!state.dndEnabled));
}

const actions = {
  chat: () => window.quickLauncher.openChat(),
  dnd: () => window.quickLauncher.toggleDnd(),
  settings: () => window.quickLauncher.openSettings(),
  close: () => window.quickLauncher.close(),
};
document.querySelectorAll("button[data-action]").forEach((button) => {
  button.addEventListener("click", () => actions[button.dataset.action]());
});
window.quickLauncher.onState(applyState);
window.quickLauncher.getState().then(applyState);
