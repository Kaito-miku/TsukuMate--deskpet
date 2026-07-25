"use strict";

const $ = (id) => document.getElementById(id);
let session = { date: "", messages: [], generating: false };
const viewState = { content: "chat", drawer: null, selectedHistoryDate: "", selectedDiaryDate: "" };
let selectedDiary = "";
let diaryOriginal = "";
let pendingScreenCapture = null;
let displayedDate = "";
let historyCursor = null;
let historyHasMore = false;
let historyLoading = false;
const messageNodes = new Map();

function isNearBottom() {
  const view = $("chat-view");
  return view.scrollHeight - view.scrollTop - view.clientHeight < 80;
}

function updateJumpBottom() {
  const view = $("chat-view");
  $("jump-bottom").hidden = viewState.content !== "chat" || isNearBottom();
}

function scrollToLatest(behavior = "auto") {
  const view = $("chat-view");
  view.scrollTo({ top: view.scrollHeight, behavior });
  requestAnimationFrame(updateJumpBottom);
}

function createMessageNode(message) {
  const node = document.createElement("div");
  node.dataset.messageId = message.id;
  updateMessageNode(node, message);
  return node;
}

function updateMessageNode(node, message) {
  node.className = `message ${message.role}${message.streaming ? " streaming" : ""}${message.error ? " error" : ""}`;
  if (node.textContent !== (message.content || "")) node.textContent = message.content || "";
}

function updateEmptyState() {
  const root = $("messages");
  let empty = root.querySelector(".chat-empty");
  if (!messageNodes.size && !empty) {
    empty = document.createElement("div");
    empty.className = "chat-empty";
    empty.innerHTML = "<strong>还没有对话</strong><span>在下方输入消息，今天的内容会自动保存在本地。</span>";
    root.appendChild(empty);
  } else if (messageNodes.size && empty) empty.remove();
}

function resetMessages(date, messages) {
  const root = $("messages"); root.innerHTML = ""; messageNodes.clear(); displayedDate = date || "";
  for (const message of messages || []) {
    const node = document.createElement("div");
    node.dataset.messageId = message.id; updateMessageNode(node, message);
    messageNodes.set(message.id, node);
    root.appendChild(node);
  }
  updateEmptyState();
}

function mergeMessages(messages, { prepend = false } = {}) {
  const root = $("messages");
  const view = $("chat-view");
  const oldHeight = view.scrollHeight;
  const fragment = document.createDocumentFragment();
  for (const message of messages || []) {
    const existing = messageNodes.get(message.id);
    if (existing) { updateMessageNode(existing, message); continue; }
    const node = createMessageNode(message); messageNodes.set(message.id, node);
    if (prepend) fragment.appendChild(node); else root.appendChild(node);
  }
  if (prepend && fragment.childNodes.length) root.insertBefore(fragment, root.firstChild);
  updateEmptyState();
  if (prepend) requestAnimationFrame(() => { view.scrollTop += view.scrollHeight - oldHeight; });
}

function renderSessionMeta() {
  $("send-status").textContent = session.generating ? "AI 正在回复…" : `当前对话：${session.date || "今天"}`;
  $("cancel").hidden = !session.generating; $("send").disabled = !!session.generating;
}

function applySession(next) {
  if (!next) return;
  const follow = isNearBottom();
  const changedDate = displayedDate !== next.date;
  session = { ...session, ...next };
  if (changedDate) resetMessages(session.date, session.messages);
  else mergeMessages(session.messages);
  renderSessionMeta();
  requestAnimationFrame(() => { if (changedDate || follow) scrollToLatest(); else updateJumpBottom(); });
  setConnectionState(session.connectionState);
}

function renderViewState() {
  const diary = viewState.content === "diary";
  $("chat-view").hidden = diary; $("composer").hidden = diary; $("diary-view").hidden = !diary;
  $("back-button").hidden = !diary; $("page-title").textContent = diary ? (selectedDiary || "日记") : "与 TsukuMate 对话";
  $("page-subtitle").textContent = diary ? "Markdown 日记会保存在本地" : "今天的对话会自动保存在本地";
  document.querySelector(".workspace").classList.toggle("drawer-open", !!viewState.drawer);
  $("drawer").setAttribute("aria-hidden", String(!viewState.drawer));
  document.querySelectorAll(".tool").forEach((node) => node.classList.remove("active"));
  $(viewState.drawer === "history" ? "history-tool" : viewState.drawer === "diary" ? "diary-tool" : "chat-tool").classList.add("active");
  updateJumpBottom();
  if (!diary) requestAnimationFrame(updateJumpBottom);
}
function closeDrawer() {
  viewState.drawer = null; renderViewState();
}
async function returnToChat() {
  if (!(await confirmDiaryDiscard())) return;
  viewState.content = "chat"; viewState.drawer = null; renderViewState();
  $("prompt").focus();
}
async function fillDrawer(kind) {
  if (!(await confirmDiaryDiscard())) return;
  viewState.drawer = kind; renderViewState();
  $("drawer-title").textContent = kind === "history" ? "聊天历史" : "日记";
  const root = $("date-list"); root.innerHTML = '<div class="drawer-status">正在加载…</div>';
  const result = kind === "history" ? await chatWorkspace.listHistory() : await chatWorkspace.listDiaries();
  root.innerHTML = "";
  if (!result || !result.ok) { root.innerHTML = `<div class="drawer-status error">${result && result.error || "读取失败"}</div>`; return; }
  if (!(result.dates || []).length) { root.innerHTML = '<div class="drawer-status">暂无记录</div>'; return; }
  for (const date of result.dates || []) {
    const button = document.createElement("button"); button.className = "date-item"; button.textContent = date;
    button.classList.toggle("active", date === (kind === "history" ? viewState.selectedHistoryDate : viewState.selectedDiaryDate));
    button.onclick = async () => {
      if (kind === "history") await loadHistoryDate(date);
      else await loadDiaryDate(date);
    }; root.appendChild(button);
  }
}
async function loadHistoryDate(date) {
  if (historyLoading) return;
  historyLoading = true; viewState.selectedHistoryDate = date;
  const result = await chatWorkspace.loadHistory(date, { limit: 100 });
  historyLoading = false;
  if (!result || !result.ok) { $("send-status").textContent = result && result.error || "历史读取失败"; return; }
  session = { ...session, date, generating: false, messages: result.messages || [] };
  resetMessages(date, result.messages || []);
  historyCursor = result.nextCursor; historyHasMore = !!result.hasMore;
  viewState.content = "chat"; renderViewState(); renderSessionMeta();
  document.querySelectorAll(".date-item").forEach((node) => node.classList.toggle("active", node.textContent === date));
  requestAnimationFrame(() => scrollToLatest());
}
async function loadMoreHistory() {
  if (!historyHasMore || historyLoading || !viewState.selectedHistoryDate) return;
  historyLoading = true;
  const result = await chatWorkspace.loadHistory(viewState.selectedHistoryDate, { before: historyCursor, limit: 100 });
  historyLoading = false;
  if (!result || !result.ok) return;
  mergeMessages(result.messages || [], { prepend: true });
  historyCursor = result.nextCursor; historyHasMore = !!result.hasMore;
}
async function loadDiaryDate(date) {
  if (!(await confirmDiaryDiscard())) return;
  const loaded = await chatWorkspace.loadDiary(date);
  if (!loaded || !loaded.ok) { $("diary-status").textContent = loaded && loaded.error || "日记读取失败"; return; }
  viewState.selectedDiaryDate = date; selectedDiary = date; diaryOriginal = loaded.content || "";
  $("diary-editor").value = diaryOriginal; $("diary-status").textContent = "";
  viewState.content = "diary"; renderViewState();
  document.querySelectorAll(".date-item").forEach((node) => node.classList.toggle("active", node.textContent === date));
}
async function confirmDiaryDiscard() { return viewState.content !== "diary" || $("diary-editor").value === diaryOriginal || confirm("日记有未保存修改，确定放弃吗？"); }
async function discardScreenCapture() {
  const capture = pendingScreenCapture;
  pendingScreenCapture = null;
  $("screen-attachment").hidden = true;
  $("screen-preview").removeAttribute("src");
  if (capture && capture.token) await chatWorkspace.discardScreenCapture(capture.token).catch(() => {});
}
async function send() {
  const text = $("prompt").value.trim();
  if (!text || session.generating) return;
  const token = pendingScreenCapture && pendingScreenCapture.token;
  pendingScreenCapture = null;
  $("screen-attachment").hidden = true;
  $("screen-preview").removeAttribute("src");
  const result = await chatWorkspace.send({ text, screenCaptureToken: token });
  if (result.ok) $("prompt").value = "";
  else {
    $("send-status").textContent = result.error || "发送失败";
    if (token) await chatWorkspace.discardScreenCapture(token).catch(() => {});
  }
}
async function showScreenPicker() {
  $("screen-picker").hidden = false;
  $("screen-picker-status").textContent = "正在获取显示器…";
  $("screen-source-list").innerHTML = "";
  const result = await chatWorkspace.listScreenSources();
  if (!result || !result.ok) {
    $("screen-picker-status").textContent = (result && result.error) || "无法读取屏幕";
    if (result && result.permissionRequired) {
      const settings = document.createElement("button");
      settings.textContent = "打开屏幕录制权限设置";
      settings.onclick = () => chatWorkspace.openScreenRecordingSettings();
      $("screen-source-list").appendChild(settings);
    }
    return;
  }
  $("screen-picker-status").textContent = "截图只会用于下一条消息，不会保存到本地。";
  for (const source of result.sources || []) {
    const button = document.createElement("button");
    button.className = "screen-source";
    button.type = "button";
    const image = document.createElement("img"); image.src = source.previewDataUrl; image.alt = "";
    const label = document.createElement("span"); label.textContent = source.name;
    button.append(image, label);
    button.onclick = async () => {
      const captured = await chatWorkspace.captureScreen(source.id);
      if (!captured || !captured.ok) { $("screen-picker-status").textContent = captured && captured.error || "截取失败"; return; }
      await discardScreenCapture();
      pendingScreenCapture = { token: captured.token, previewDataUrl: captured.previewDataUrl };
      $("screen-preview").src = captured.previewDataUrl;
      $("screen-attachment").hidden = false;
      $("screen-picker").hidden = true;
      $("prompt").focus();
    };
    $("screen-source-list").appendChild(button);
  }
}
$("send").onclick = send; $("cancel").onclick = () => chatWorkspace.cancel();
$("screen-button").onclick = showScreenPicker;
$("screen-picker-close").onclick = () => { $("screen-picker").hidden = true; };
$("screen-remove").onclick = discardScreenCapture;
$("prompt").addEventListener("keydown", (event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); send(); } });
$("history-tool").onclick = () => fillDrawer("history"); $("diary-tool").onclick = () => fillDrawer("diary");
$("chat-tool").onclick = returnToChat;
$("drawer-close").onclick = closeDrawer;
$("jump-bottom").onclick = () => scrollToLatest("smooth");
$("chat-view").addEventListener("scroll", () => { updateJumpBottom(); if ($("chat-view").scrollTop < 80) void loadMoreHistory(); }, { passive: true });
$("back-button").onclick = returnToChat;
$("diary-save").onclick = async () => { if (!selectedDiary) return; const value = $("diary-editor").value; const result = await chatWorkspace.saveDiary(selectedDiary, value); if (result.ok) { diaryOriginal = value; $("diary-status").textContent = "已保存"; } else $("diary-status").textContent = result.error || "保存失败"; };
$("diary-generate").onclick = async () => { if (!selectedDiary || !confirm("重新生成会覆盖当前日记，确定继续吗？")) return; const result = await chatWorkspace.generateDiary(selectedDiary); if (result.ok) { const loaded = await chatWorkspace.loadDiary(selectedDiary); diaryOriginal = loaded.content || ""; $("diary-editor").value = diaryOriginal; $("diary-status").textContent = "已重新生成"; } else $("diary-status").textContent = result.error || "生成失败"; };
$("diary-folder").onclick = () => chatWorkspace.openDiaryFolder();
chatWorkspace.onSession(applySession); chatWorkspace.getSession().then(applySession);
renderViewState();
chatWorkspace.getConnectionStatus().then((status) => setConnectionState(status && status.state, status && status.configured));
const emotionNames = { calm: "平静", focused: "专注", happy: "开心", shy: "害羞", surprised: "惊讶", sleepy: "困倦", sad: "难过", annoyed: "轻微不满" };
window.electronAPI.onChatEmotion((value) => {
  const blend = value && value.display ? value.display : value;
  const primary = blend && blend.primary || "calm";
  const secondary = blend && blend.secondary;
  $("emotion-pill").textContent = secondary
    ? `${emotionNames[primary] || primary} · ${emotionNames[secondary] || secondary}`
    : (emotionNames[primary] || primary);
});
function setConnectionState(state, configured = true) {
  const dot = document.querySelector(".connection-dot");
  const safe = !configured ? "unconfigured" : (["available", "error", "configured"].includes(state) ? state : "configured");
  dot.dataset.state = safe;
  dot.title = safe === "available" ? "API 连接可用" : safe === "error" ? "API 连接异常" : safe === "unconfigured" ? "API 尚未配置" : "API 已配置，等待连接";
}
window.electronAPI.onLive2dStatus((status) => {
  const pane = document.querySelector(".live2d-pane");
  const phase = String(status && status.phase || "loading");
  pane.classList.toggle("live2d-ready", phase === "ready");
  pane.classList.toggle("live2d-error", phase === "error" || phase === "disabled");
  if (phase === "loading") $("live2d-feedback-text").textContent = "正在加载 Live2D…";
  if (phase === "recovering") $("live2d-feedback-text").textContent = "正在恢复 Live2D 画布…";
  if (phase === "error") $("live2d-feedback-text").textContent = "Live2D 加载失败，可以尝试重新加载。";
  if (phase === "disabled") $("live2d-feedback-text").textContent = "当前没有可用的 Live2D 模型。";
  $("live2d-retry").hidden = !(phase === "error" || phase === "disabled");
});
$("live2d-retry").onclick = () => chatWorkspace.reloadLive2d();
window.addEventListener("beforeunload", (event) => { if (pendingScreenCapture) void chatWorkspace.discardScreenCapture(pendingScreenCapture.token); if (viewState.content === "diary" && $("diary-editor").value !== diaryOriginal) { event.preventDefault(); event.returnValue = ""; } });
