"use strict";

const $ = (id) => document.getElementById(id);
const api = window.chatWorkspace;
let session = { messages: [], generating: false, conversation: null };
let pendingAttachments = [];
let selectedDiary = null;
let diaryOriginal = "";
let viewState = { content: "chat", drawer: null };
const cardCleanups = [];
let navigatorIdleTimer = null;
let navigatorDragging = false;
let live2dHasVisibleFrame = false;
let live2dPhase = "loading";

function cleanupCards() { while (cardCleanups.length) { try { cardCleanups.pop()(); } catch {} } }
function nearBottom() { const view = $("chat-view"); return view.scrollHeight - view.scrollTop - view.clientHeight < 90; }
function scrollToLatest(behavior = "auto") { $("chat-view").scrollTo({ top: $("chat-view").scrollHeight, behavior }); $("jump-bottom").hidden = true; activateConversationNavigator(); }
function updateJumpBottom() { $("jump-bottom").hidden = viewState.content !== "chat" || nearBottom(); }
function activateConversationNavigator() { const navigator = $("conversation-navigator"); navigator.classList.add("is-active"); clearTimeout(navigatorIdleTimer); navigatorIdleTimer = setTimeout(() => { if (!navigatorDragging) navigator.classList.remove("is-active"); }, 1000); }
function updateConversationNavigator() {
  const view = $("chat-view"); const navigator = $("conversation-navigator"); const track = $("conversation-nav-track"); const thumb = $("conversation-nav-thumb"); const markers = $("conversation-nav-markers"); const users = [...document.querySelectorAll(".message.user")]; const maxScroll = Math.max(0, view.scrollHeight - view.clientHeight);
  navigator.hidden = viewState.content !== "chat" || !users.length || !maxScroll;
  if (navigator.hidden) return;
  const trackHeight = Math.max(1, track.clientHeight); const thumbHeight = Math.max(28, Math.min(trackHeight, Math.round(trackHeight * (view.clientHeight / view.scrollHeight)))); const thumbTop = Math.round((trackHeight - thumbHeight) * (view.scrollTop / maxScroll));
  thumb.style.height = `${thumbHeight}px`; thumb.style.transform = `translateY(${thumbTop}px)`; track.setAttribute("aria-valuemin", "0"); track.setAttribute("aria-valuemax", String(Math.round(maxScroll))); track.setAttribute("aria-valuenow", String(Math.round(view.scrollTop))); markers.replaceChildren();
  for (const element of users) { const marker = document.createElement("button"); marker.type = "button"; marker.className = "conversation-nav-marker"; const label = `定位到第 ${element.dataset.messageIndex || ""} 条用户消息`; marker.title = label; marker.setAttribute("aria-label", label); const center = element.offsetTop + (element.offsetHeight / 2); marker.style.top = `${Math.max(3, Math.min(trackHeight - 7, (center / view.scrollHeight) * trackHeight))}px`; marker.onclick = () => { view.scrollTo({ top: Math.max(0, element.offsetTop - ((view.clientHeight - element.offsetHeight) / 2)), behavior: "smooth" }); activateConversationNavigator(); }; markers.append(marker); }
}
function scrollNavigatorTo(clientY) { const track = $("conversation-nav-track"); const view = $("chat-view"); const rect = track.getBoundingClientRect(); const progress = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height))); view.scrollTop = progress * Math.max(0, view.scrollHeight - view.clientHeight); }
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
    root.append(empty); requestAnimationFrame(updateConversationNavigator); return;
  }
  for (const message of session.messages) {
    if (message.role === "context-boundary") {
      const boundary = document.createElement("div"); boundary.className = "context-boundary"; boundary.textContent = "已清除此处之前的对话上下文"; root.append(boundary); continue;
    }
    const row = document.createElement("article"); row.className = `message ${message.role}${message.streaming ? " streaming" : ""}${message.error ? " error" : ""}`; row.dataset.messageId = message.id || "";
    if (message.role === "user") row.dataset.messageIndex = String(root.querySelectorAll(".message.user").length + 1);
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
  requestAnimationFrame(() => { if (follow) scrollToLatest(); else updateJumpBottom(); updateConversationNavigator(); });
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
  const editingDiary = diary && !!selectedDiary;
  $("diary-view").hidden = !diary; $("chat-reading-area").hidden = diary; $("composer").hidden = diary; $("jump-bottom").hidden = diary || nearBottom(); $("conversation-navigator").hidden = diary;
  $("diary-empty-state").hidden = editingDiary; $("diary-editor").hidden = !editingDiary; $("diary-view").querySelector("footer").hidden = !editingDiary;
  $("back-button").hidden = !diary; $("drawer").setAttribute("aria-hidden", String(!viewState.drawer));
  document.querySelector(".workspace").classList.toggle("drawer-open", !!viewState.drawer);
  document.querySelectorAll(".tool").forEach((node) => node.classList.remove("active"));
  $(viewState.content === "diary" ? "diary-tool" : "chat-tool").classList.add("active");
  if (!diary) requestAnimationFrame(updateConversationNavigator);
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
  if (!(await confirmDiaryDiscard())) return; selectedDiary = null; diaryOriginal = ""; viewState = { content: "diary", drawer: "diary" }; renderView(); $("drawer-title").textContent = "日记";
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
$("chat-tool").onclick = () => viewState.content === "chat" && viewState.drawer === "history" ? (viewState.drawer = null, renderView()) : showConversationDrawer(); $("diary-tool").onclick = showDiaryDrawer; $("drawer-close").onclick = () => { viewState.drawer = null; renderView(); }; $("back-button").onclick = returnToChat;
$("jump-bottom").onclick = () => scrollToLatest("smooth"); $("chat-view").addEventListener("scroll", () => { updateJumpBottom(); updateConversationNavigator(); activateConversationNavigator(); }, { passive: true });
$("conversation-nav-track").addEventListener("pointerdown", (event) => { if (event.target.closest(".conversation-nav-marker")) return; navigatorDragging = true; $("conversation-navigator").classList.add("is-dragging"); event.currentTarget.setPointerCapture(event.pointerId); scrollNavigatorTo(event.clientY); activateConversationNavigator(); });
$("conversation-nav-track").addEventListener("pointermove", (event) => { if (navigatorDragging) scrollNavigatorTo(event.clientY); });
$("conversation-nav-track").addEventListener("pointerup", (event) => { navigatorDragging = false; $("conversation-navigator").classList.remove("is-dragging"); event.currentTarget.releasePointerCapture?.(event.pointerId); activateConversationNavigator(); });
$("conversation-nav-track").addEventListener("keydown", (event) => { const view = $("chat-view"); const amount = Math.max(40, view.clientHeight * .12); if (event.key === "ArrowDown" || event.key === "PageDown") { event.preventDefault(); view.scrollTop += amount; } else if (event.key === "ArrowUp" || event.key === "PageUp") { event.preventDefault(); view.scrollTop -= amount; } else if (event.key === "Home") { event.preventDefault(); view.scrollTop = 0; } else if (event.key === "End") { event.preventDefault(); scrollToLatest("smooth"); } });
$("diary-save").onclick = async () => { if (!selectedDiary) return; const result = await api.saveDiary(selectedDiary, $("diary-editor").value); if (result.ok) { diaryOriginal = $("diary-editor").value; $("diary-status").textContent = "已保存"; } };
$("diary-generate").onclick = async () => { if (!selectedDiary || !confirm("重新生成会覆盖当前日记，确定吗？")) return; const result = await api.generateDiary(selectedDiary); if (result.ok) await loadDiary(selectedDiary); };
$("diary-folder").onclick = () => api.openDiaryFolder();

api.onSession(renderSession); api.getSession().then(renderSession); renderView();
api.getConnectionStatus().then((status) => setConnectionState(status && status.state, status && status.configured));
function setConnectionState(state, configured = true) { const dot = document.querySelector(".connection-dot"); const safe = !configured ? "unconfigured" : (["available", "error", "configured"].includes(state) ? state : "configured"); dot.dataset.state = safe; }
const emotionNames = { calm: "平静", focused: "专注", happy: "开心", shy: "害羞", surprised: "惊讶", sleepy: "困倦", sad: "难过", annoyed: "轻微不满" };
window.electronAPI.onChatEmotion((value) => { const blend = value && value.display ? value.display : value; const p = blend && blend.primary || "calm"; const s = blend && blend.secondary; $("emotion-pill").textContent = s ? `${emotionNames[p] || p} · ${emotionNames[s] || s}` : emotionNames[p] || p; });
function updateLive2dFeedback() { const pane = document.querySelector(".live2d-pane"); const feedback = $("live2d-feedback"); const failed = live2dPhase === "error" || live2dPhase === "disabled"; const visible = failed || (!live2dHasVisibleFrame && ["loading", "recovering"].includes(live2dPhase)); pane.classList.toggle("live2d-ready", live2dHasVisibleFrame); pane.classList.toggle("live2d-error", failed); feedback.hidden = !visible; $("live2d-feedback-text").textContent = live2dPhase === "error" ? "Live2D 加载失败，可以尝试重新加载。" : live2dPhase === "disabled" ? "当前没有可用的 Live2D 模型。" : live2dPhase === "recovering" ? "正在恢复 Live2D 画布…" : "正在加载 Live2D…"; $("live2d-retry").hidden = !failed; }
function detectLive2dFrame() { const canvas = document.querySelector("#live2d-stage canvas"); if (canvas && canvas.width > 0 && canvas.height > 0 && canvas.getBoundingClientRect().width > 0) { live2dHasVisibleFrame = true; updateLive2dFeedback(); } }
window.electronAPI.onLive2dStatus((status) => { live2dPhase = String(status && status.phase || "loading"); if (live2dPhase === "ready") live2dHasVisibleFrame = true; if (["error", "disabled"].includes(live2dPhase)) live2dHasVisibleFrame = false; updateLive2dFeedback(); });
$("live2d-retry").onclick = () => api.reloadLive2d();
new MutationObserver(detectLive2dFrame).observe($("live2d-stage"), { childList: true, subtree: true });
window.addEventListener("resize", () => { updateConversationNavigator(); detectLive2dFrame(); });
if (window.ResizeObserver) new ResizeObserver(updateConversationNavigator).observe($("messages"));
setInterval(detectLive2dFrame, 750);
window.addEventListener("beforeunload", (event) => { discardPendingAttachments(); cleanupCards(); if (viewState.content === "diary" && $("diary-editor").value !== diaryOriginal) { event.preventDefault(); event.returnValue = ""; } });
