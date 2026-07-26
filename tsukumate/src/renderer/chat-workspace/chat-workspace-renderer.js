"use strict";

const $ = (id) => document.getElementById(id);
const api = window.chatWorkspace;
let session = { messages: [], generating: false, conversation: null };
let pendingAttachments = [];
let selectedDiary = null;
let diaryOriginal = "";
let viewState = { content: "chat", drawer: null };
const cardCleanups = [];

function cleanupCards() { while (cardCleanups.length) { try { cardCleanups.pop()(); } catch {} } }
function nearBottom() { const view = $("chat-view"); return view.scrollHeight - view.scrollTop - view.clientHeight < 90; }
function scrollToLatest(behavior = "auto") { $("chat-view").scrollTo({ top: $("chat-view").scrollHeight, behavior }); $("jump-bottom").hidden = true; }
function updateJumpBottom() { $("jump-bottom").hidden = nearBottom(); }
function renderAttachment(attachment, interactive = false) {
  const chip = document.createElement("button"); chip.type = "button"; chip.className = "attachment-chip";
  chip.textContent = `${attachment.kind === "image" ? "🖼" : "📄"} ${attachment.name}`;
  if (interactive) {
    const remove = document.createElement("span"); remove.textContent = " ×"; chip.append(remove);
    chip.onclick = async () => {
      await api.discardAttachment(attachment.id);
      pendingAttachments = pendingAttachments.filter((item) => item.id !== attachment.id);
      renderPendingAttachments();
    };
  } else chip.onclick = () => api.openAttachment(attachment.id);
  return chip;
}
function renderMessages() {
  const follow = nearBottom(); cleanupCards();
  const root = $("messages"); root.replaceChildren();
  if (!session.messages.length) {
    const empty = document.createElement("div"); empty.className = "chat-empty";
    empty.innerHTML = "<strong>从一个问题开始</strong><span>上传讲义、PDF、文档或图片，也可以要求 TsukuMate 用学习卡片整理。</span>";
    root.append(empty); return;
  }
  for (const message of session.messages) {
    if (message.role === "context-boundary") {
      const boundary = document.createElement("div"); boundary.className = "context-boundary"; boundary.textContent = "已清除此处之前的对话上下文"; root.append(boundary); continue;
    }
    const row = document.createElement("article"); row.className = `message ${message.role}${message.streaming ? " streaming" : ""}${message.error ? " error" : ""}`;
    const text = document.createElement("div"); text.className = "message-text"; text.textContent = message.content || (message.streaming ? "" : ""); row.append(text);
    if (Array.isArray(message.attachments) && message.attachments.length) {
      const list = document.createElement("div"); list.className = "message-attachments";
      for (const attachment of message.attachments) list.append(renderAttachment(attachment)); row.append(list);
    }
    if (message.role === "assistant" && Array.isArray(message.richCards) && window.TsukuMateRichContent) {
      const cards = document.createElement("div"); cards.className = "study-card-list"; row.append(cards);
      for (const card of message.richCards.slice(0, 3)) cardCleanups.push(window.TsukuMateRichContent.renderCard(cards, card));
    }
    root.append(row);
  }
  if (follow) requestAnimationFrame(() => scrollToLatest()); else updateJumpBottom();
}
function renderSession(value) {
  session = value || session;
  const conversation = session.conversation || {};
  $("page-title").textContent = conversation.title || "新对话";
  $("title-edit").hidden = !!conversation.legacy || viewState.content === "diary";
  $("send-status").textContent = session.generating ? "正在回复…" : "准备就绪";
  $("cancel").hidden = !session.generating;
  for (const id of ["send", "attachment-button", "new-conversation", "clear-context"]) $(id).disabled = !!session.generating;
  renderMessages();
}
function renderPendingAttachments() {
  const root = $("attachment-list"); root.replaceChildren(); root.hidden = !pendingAttachments.length;
  for (const attachment of pendingAttachments) root.append(renderAttachment(attachment, true));
}
async function discardPendingAttachments() {
  const current = pendingAttachments; pendingAttachments = []; renderPendingAttachments();
  await Promise.all(current.map((item) => api.discardAttachment(item.id).catch(() => {})));
}
function renderView() {
  const diary = viewState.content === "diary";
  $("diary-view").hidden = !diary; $("chat-view").hidden = diary; $("composer").hidden = diary; $("jump-bottom").hidden = diary || nearBottom();
  $("back-button").hidden = !diary; $("drawer").setAttribute("aria-hidden", String(!viewState.drawer));
  document.querySelector(".workspace").classList.toggle("drawer-open", !!viewState.drawer);
  document.querySelectorAll(".tool").forEach((node) => node.classList.remove("active"));
  $(viewState.drawer === "history" ? "history-tool" : viewState.drawer === "diary" ? "diary-tool" : "chat-tool").classList.add("active");
}
async function confirmDiaryDiscard() { return viewState.content !== "diary" || $("diary-editor").value === diaryOriginal || confirm("日记有未保存修改，确定放弃吗？"); }
async function returnToChat() { if (!(await confirmDiaryDiscard())) return; viewState = { content: "chat", drawer: null }; renderView(); $("prompt").focus(); }
async function showConversationDrawer() {
  if (!(await confirmDiaryDiscard())) return; viewState = { content: "chat", drawer: "history" }; renderView();
  $("drawer-title").textContent = "对话"; const root = $("date-list"); root.innerHTML = '<div class="drawer-status">正在加载…</div>';
  const result = await api.listConversations(); root.replaceChildren();
  if (!result || !result.ok) { root.innerHTML = '<div class="drawer-status error">读取失败</div>'; return; }
  for (const item of result.conversations || []) {
    const button = document.createElement("button"); button.className = "date-item"; button.disabled = !!session.generating;
    button.classList.toggle("active", item.id === session.conversationId); button.innerHTML = `<strong></strong><small></small>`;
    button.querySelector("strong").textContent = item.title; button.querySelector("small").textContent = item.legacy ? "旧版记录" : new Date(item.updatedAt).toLocaleString();
    button.onclick = async () => { await discardPendingAttachments(); const loaded = await api.loadConversation(item.id); if (!loaded.ok) $("send-status").textContent = loaded.error || "切换失败"; };
    root.append(button);
  }
}
async function showDiaryDrawer() {
  if (!(await confirmDiaryDiscard())) return; viewState.drawer = "diary"; renderView(); $("drawer-title").textContent = "日记";
  const root = $("date-list"); root.innerHTML = '<div class="drawer-status">正在加载…</div>';
  const result = await api.listDiaries(); root.replaceChildren();
  for (const date of result && result.dates || []) { const button = document.createElement("button"); button.className = "date-item"; button.textContent = date; button.onclick = () => loadDiary(date); root.append(button); }
}
async function loadDiary(date) {
  if (!(await confirmDiaryDiscard())) return; const result = await api.loadDiary(date); if (!result.ok) return;
  selectedDiary = date; diaryOriginal = result.content || ""; $("diary-editor").value = diaryOriginal; $("diary-status").textContent = "";
  viewState.content = "diary"; renderView();
}
async function send() {
  const text = $("prompt").value.trim(); if (!text || session.generating) return;
  const ids = pendingAttachments.map((item) => item.id);
  const result = await api.send({ text, attachmentIds: ids });
  if (result.ok) { pendingAttachments = []; renderPendingAttachments(); $("prompt").value = ""; }
  else $("send-status").textContent = result.error || "发送失败";
}
async function editTitle() {
  const input = $("title-input"); input.value = session.conversation && session.conversation.title || ""; $("page-title").hidden = true; $("title-edit").hidden = true; input.hidden = false; input.focus(); input.select();
}
async function finishTitle(save) {
  const input = $("title-input"); if (input.hidden) return;
  if (save && input.value.trim()) { const result = await api.updateTitle(input.value); if (!result.ok) $("send-status").textContent = result.error || "标题保存失败"; }
  input.hidden = true; $("page-title").hidden = false; $("title-edit").hidden = !!(session.conversation && session.conversation.legacy);
}

$("send").onclick = send; $("cancel").onclick = () => api.cancel();
$("attachment-button").onclick = async () => { const result = await api.selectAttachments(); if (result && result.ok) { pendingAttachments.push(...(result.attachments || [])); renderPendingAttachments(); } else $("send-status").textContent = result && result.error || "附件读取失败"; };
$("new-conversation").onclick = async () => { if (session.generating) return; if (($("prompt").value.trim() || pendingAttachments.length) && !confirm("放弃尚未发送的内容并新建对话吗？")) return; await discardPendingAttachments(); await api.createConversation(); viewState = { content: "chat", drawer: null }; renderView(); };
$("clear-context").onclick = async () => { if (!session.generating && confirm("保留记录，但让后续回复不再使用此处之前的对话？")) await api.clearContext(); };
$("title-edit").onclick = editTitle; $("title-input").onblur = () => finishTitle(true); $("title-input").onkeydown = (event) => { if (event.key === "Enter") { event.preventDefault(); finishTitle(true); } if (event.key === "Escape") { event.preventDefault(); finishTitle(false); } };
$("prompt").addEventListener("keydown", (event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); send(); } });
$("history-tool").onclick = showConversationDrawer; $("diary-tool").onclick = showDiaryDrawer; $("chat-tool").onclick = returnToChat; $("drawer-close").onclick = () => { viewState.drawer = null; renderView(); }; $("back-button").onclick = returnToChat;
$("jump-bottom").onclick = () => scrollToLatest("smooth"); $("chat-view").addEventListener("scroll", updateJumpBottom, { passive: true });
$("diary-save").onclick = async () => { if (!selectedDiary) return; const result = await api.saveDiary(selectedDiary, $("diary-editor").value); if (result.ok) { diaryOriginal = $("diary-editor").value; $("diary-status").textContent = "已保存"; } };
$("diary-generate").onclick = async () => { if (!selectedDiary || !confirm("重新生成会覆盖当前日记，确定吗？")) return; const result = await api.generateDiary(selectedDiary); if (result.ok) await loadDiary(selectedDiary); };
$("diary-folder").onclick = () => api.openDiaryFolder();

api.onSession(renderSession); api.getSession().then(renderSession); renderView();
api.getConnectionStatus().then((status) => setConnectionState(status && status.state, status && status.configured));
function setConnectionState(state, configured = true) { const dot = document.querySelector(".connection-dot"); const safe = !configured ? "unconfigured" : (["available", "error", "configured"].includes(state) ? state : "configured"); dot.dataset.state = safe; }
const emotionNames = { calm: "平静", focused: "专注", happy: "开心", shy: "害羞", surprised: "惊讶", sleepy: "困倦", sad: "难过", annoyed: "轻微不满" };
window.electronAPI.onChatEmotion((value) => { const blend = value && value.display ? value.display : value; const p = blend && blend.primary || "calm"; const s = blend && blend.secondary; $("emotion-pill").textContent = s ? `${emotionNames[p] || p} · ${emotionNames[s] || s}` : emotionNames[p] || p; });
window.electronAPI.onLive2dStatus((status) => { const pane = document.querySelector(".live2d-pane"); const phase = String(status && status.phase || "loading"); pane.classList.toggle("live2d-ready", phase === "ready"); pane.classList.toggle("live2d-error", phase === "error" || phase === "disabled"); $("live2d-feedback-text").textContent = phase === "error" ? "Live2D 加载失败，可以尝试重新加载。" : phase === "disabled" ? "当前没有可用的 Live2D 模型。" : phase === "recovering" ? "正在恢复 Live2D 画布…" : "正在加载 Live2D…"; $("live2d-retry").hidden = !(phase === "error" || phase === "disabled"); });
$("live2d-retry").onclick = () => api.reloadLive2d();
window.addEventListener("beforeunload", (event) => { discardPendingAttachments(); cleanupCards(); if (viewState.content === "diary" && $("diary-editor").value !== diaryOriginal) { event.preventDefault(); event.returnValue = ""; } });
