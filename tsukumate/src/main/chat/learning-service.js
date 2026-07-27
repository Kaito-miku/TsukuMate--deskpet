"use strict";

// Local-first learning data. This intentionally stays smaller and more
// isolated than UniStudy's historical knowledge-base runtime: all filesystem
// paths are resolved in the main process and renderers only receive ids.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const RESOURCE_TYPES = new Set([".pdf", ".docx", ".txt", ".md", ".csv", ".png", ".jpg", ".jpeg", ".webp"]);
const IMAGE_TYPES = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_RESOURCE_TEXT = 80_000;
const MAX_CONTEXT = 18_000;
const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}`;
const clean = (value, max = 120) => String(value || "").replace(/[\u0000-\u001f<>:"/\\|?*]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

function atomicJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); const temp = `${file}.tmp-${process.pid}-${Date.now()}`; fs.writeFileSync(temp, JSON.stringify(value, null, 2), "utf8"); fs.renameSync(temp, file); }
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
function words(text) { return [...new Set(String(text || "").toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [])]; }
function score(query, text) { const needle = words(query); if (!needle.length) return 0; const haystack = String(text || "").toLowerCase(); return needle.reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0) / needle.length; }
function stripCodeFence(value) { return String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim(); }

function createLearningService({ root, dialog, shell, nativeImage, complete, getConfig = () => ({}) }) {
  const notesDir = path.join(root, "learning", "notes");
  const resourcesDir = path.join(root, "learning", "resources");
  const practicesDir = path.join(root, "learning", "practices");
  const notePath = (noteId) => path.join(notesDir, `${noteId}.json`);
  const resourcePath = (resourceId) => path.join(resourcesDir, resourceId, "meta.json");
  const practicePath = (practiceId) => path.join(practicesDir, `${practiceId}.json`);
  const valid = (prefix, value) => new RegExp(`^${prefix}-[a-z0-9-]+$`, "i").test(String(value || ""));
  function listFrom(dir) { try { return fs.readdirSync(dir).sort().reverse(); } catch { return []; } }
  function listNotes() { return listFrom(notesDir).filter((name) => name.endsWith(".json")).map((name) => readJson(path.join(notesDir, name), null)).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt); }
  function getNote(noteId) { return valid("note", noteId) ? readJson(notePath(noteId), null) : null; }
  function saveNote(input = {}) {
    const previous = input.id ? getNote(input.id) : null;
    const now = Date.now(); const note = {
      id: previous?.id || id("note"), title: clean(input.title || previous?.title || "AI 回答摘录", 100) || "未命名笔记",
      content: String(input.content ?? previous?.content ?? "").slice(0, 120_000), sourceMessageId: clean(input.sourceMessageId ?? previous?.sourceMessageId, 128),
      conversationId: clean(input.conversationId ?? previous?.conversationId, 100), richCards: Array.isArray(input.richCards) ? input.richCards.slice(0, 3) : (previous?.richCards || []),
      createdAt: previous?.createdAt || now, updatedAt: now,
    }; atomicJson(notePath(note.id), note); return note;
  }
  function deleteNote(noteId) { if (!valid("note", noteId)) return false; try { fs.unlinkSync(notePath(noteId)); return true; } catch { return false; } }
  async function extract(file, extension) {
    if (extension === ".pdf") return String((await pdfParse(fs.readFileSync(file))).text || "").slice(0, MAX_RESOURCE_TEXT);
    if (extension === ".docx") return String((await mammoth.extractRawText({ path: file })).value || "").slice(0, MAX_RESOURCE_TEXT);
    return fs.readFileSync(file, "utf8").slice(0, MAX_RESOURCE_TEXT);
  }
  async function transcribeImage(file, name) {
    let image = nativeImage.createFromPath(file); const size = image.getSize(); const longest = Math.max(size.width, size.height);
    if (longest > 1600) image = image.resize({ width: Math.round(size.width * 1600 / longest), height: Math.round(size.height * 1600 / longest), quality: "good" });
    const dataUrl = `data:image/jpeg;base64,${image.toJPEG(82).toString("base64")}`;
    return complete({ image: dataUrl, maxTokens: 1800, temperature: 0, system: "Transcribe this learning image faithfully. Return plain text only; preserve headings, equations and tables where possible.", text: `请转写学习资源图片：${name}` });
  }
  function splitChunks(text) { const value = String(text || "").trim(); const chunks = []; for (let offset = 0; offset < value.length && chunks.length < 100; offset += 1000) chunks.push(value.slice(offset, offset + 1200)); return chunks; }
  async function embed(texts) {
    const config = getConfig() || {}; if (!config.embeddingEndpoint || !config.embeddingModel || !Array.isArray(texts) || !texts.length) return null;
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(config.embeddingEndpoint, { method: "POST", signal: controller.signal, headers: { "content-type": "application/json", ...(config.embeddingKey ? { authorization: `Bearer ${config.embeddingKey}` } : {}) }, body: JSON.stringify({ model: config.embeddingModel, input: texts }) });
      if (!response.ok) return null; const payload = await response.json(); const values = Array.isArray(payload?.data) ? payload.data.map((item) => Array.isArray(item.embedding) ? item.embedding.map(Number) : null) : null;
      return values && values.length === texts.length && values.every((item) => item && item.every(Number.isFinite)) ? values : null;
    } catch { return null; } finally { clearTimeout(timer); }
  }
  function cosine(a, b) { if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0; let dot = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; } return aa && bb ? dot / Math.sqrt(aa * bb) : 0; }
  async function indexResource(meta) { meta.chunks = splitChunks(meta.text).map((text, index) => ({ id: `${meta.id}-${index}`, text, embedding: null })); const vectors = await embed(meta.chunks.map((chunk) => chunk.text)); if (vectors) meta.chunks.forEach((chunk, index) => { chunk.embedding = vectors[index]; }); }
  async function addResources(window) {
    const result = await dialog.showOpenDialog(window || null, { title: "添加学习资源", properties: ["openFile", "multiSelections"], filters: [{ name: "学习资源", extensions: [...RESOURCE_TYPES].map((item) => item.slice(1)) }] });
    if (result.canceled) return { ok: true, resources: [] };
    const resources = [];
    for (const source of result.filePaths.slice(0, 20)) {
      const extension = path.extname(source).toLowerCase(); const stat = fs.statSync(source);
      if (!RESOURCE_TYPES.has(extension)) throw new Error(`不支持的资源格式：${path.basename(source)}`);
      if (stat.size > MAX_FILE_BYTES) throw new Error(`资源超过 20 MB：${path.basename(source)}`);
      const resourceId = id("resource"); const dir = path.join(resourcesDir, resourceId); fs.mkdirSync(dir, { recursive: true });
      const name = clean(path.basename(source), 180); const storedName = `source${extension}`; fs.copyFileSync(source, path.join(dir, storedName));
      const meta = { id: resourceId, name, extension, size: stat.size, storedName, status: "processing", text: "", createdAt: Date.now(), updatedAt: Date.now() };
      atomicJson(resourcePath(resourceId), meta);
      try { meta.text = IMAGE_TYPES.has(extension) ? await transcribeImage(path.join(dir, storedName), name) : await extract(path.join(dir, storedName), extension); meta.status = "ready"; }
      catch (error) { meta.status = "failed"; meta.error = String(error && error.message || error); }
      meta.text = String(meta.text || "").slice(0, MAX_RESOURCE_TEXT); if (meta.status === "ready") await indexResource(meta); meta.updatedAt = Date.now(); atomicJson(resourcePath(resourceId), meta); resources.push(publicResource(meta));
    }
    return { ok: true, resources };
  }
  async function selectAnswerImage(window) {
    const result = await dialog.showOpenDialog(window || null, { title: "选择答题图片", properties: ["openFile"], filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp"] }] });
    if (result.canceled || !result.filePaths[0]) return { ok: true, imageDataUrl: "" };
    let image = nativeImage.createFromPath(result.filePaths[0]); const size = image.getSize(); const longest = Math.max(size.width, size.height);
    if (!size.width || !size.height) throw new Error("无法读取图片");
    if (longest > 1600) image = image.resize({ width: Math.round(size.width * 1600 / longest), height: Math.round(size.height * 1600 / longest), quality: "good" });
    return { ok: true, imageDataUrl: `data:image/jpeg;base64,${image.toJPEG(82).toString("base64")}` };
  }
  function publicResource(meta) { return { id: meta.id, name: meta.name, extension: meta.extension, size: meta.size, status: meta.status, error: meta.error || "", preview: String(meta.text || "").slice(0, 600), createdAt: meta.createdAt, updatedAt: meta.updatedAt }; }
  function listResources() { return listFrom(resourcesDir).map((entry) => readJson(resourcePath(entry), null)).filter(Boolean).map(publicResource).sort((a, b) => b.updatedAt - a.updatedAt); }
  function getResource(resourceId) { const value = valid("resource", resourceId) ? readJson(resourcePath(resourceId), null) : null; return value ? { ...publicResource(value), text: value.text || "" } : null; }
  async function retryResource(resourceId) {
    if (!valid("resource", resourceId)) throw new Error("资源不存在"); const meta = readJson(resourcePath(resourceId), null); if (!meta) throw new Error("资源不存在");
    const file = path.join(resourcesDir, resourceId, meta.storedName); if (!fs.existsSync(file)) throw new Error("原始资源已不存在"); meta.status = "processing"; meta.error = ""; atomicJson(resourcePath(resourceId), meta);
    try { meta.text = IMAGE_TYPES.has(meta.extension) ? await transcribeImage(file, meta.name) : await extract(file, meta.extension); meta.text = String(meta.text || "").slice(0, MAX_RESOURCE_TEXT); await indexResource(meta); meta.status = "ready"; }
    catch (error) { meta.status = "failed"; meta.error = String(error && error.message || error); }
    meta.updatedAt = Date.now(); atomicJson(resourcePath(resourceId), meta); return publicResource(meta);
  }
  function deleteResource(resourceId) { if (!valid("resource", resourceId)) return false; const dir = path.join(resourcesDir, resourceId); try { fs.rmSync(dir, { recursive: true, force: true }); return true; } catch { return false; } }
  async function searchWeb(query) {
    const config = getConfig() || {}; if (!config.searchProvider || config.searchProvider === "none") throw new Error("尚未配置联网资料服务");
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 9000);
    try {
      let response; if (config.searchProvider === "tavily") response = await fetch(config.searchEndpoint || "https://api.tavily.com/search", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json", ...(config.searchKey ? { authorization: `Bearer ${config.searchKey}` } : {}) }, body: JSON.stringify({ query, max_results: 5, search_depth: "basic" }) });
      else { const endpoint = new URL(config.searchEndpoint); endpoint.searchParams.set("q", query); endpoint.searchParams.set("format", "json"); response = await fetch(endpoint, { signal: controller.signal }); }
      if (!response.ok) throw new Error("联网资料服务返回错误"); const payload = await response.json(); const records = Array.isArray(payload.results) ? payload.results : [];
      return records.slice(0, 5).map((item, index) => ({ type: "web", id: `web-${index}`, name: clean(item.title || item.url || "联网资料", 160), url: String(item.url || ""), retrievedAt: new Date().toISOString(), text: String(item.content || item.snippet || "").slice(0, 4000) })).filter((item) => item.text);
    } finally { clearTimeout(timer); }
  }
  async function buildContext({ noteIds = [], resourceIds = [], query = "", sourceMode = "local" }) {
    const refs = []; for (const noteId of noteIds.slice(0, 12)) { const note = getNote(noteId); if (note) refs.push({ type: "note", id: note.id, name: note.title, text: note.content }); }
    for (const resourceId of resourceIds.slice(0, 12)) { const resource = getResource(resourceId); if (resource?.status === "ready") refs.push({ type: "resource", id: resource.id, name: resource.name, text: resource.text, chunks: readJson(resourcePath(resourceId), {}).chunks || [] }); }
    if (sourceMode === "web") refs.push(...await searchWeb(query || "学习复习资料"));
    let queryEmbedding = null; try { queryEmbedding = (await embed([query || "学习资料"])); queryEmbedding = queryEmbedding && queryEmbedding[0]; } catch {}
    const selected = refs.flatMap((ref) => ref.type === "resource" && ref.chunks?.length ? ref.chunks.map((chunk) => ({ ...ref, text: chunk.text, rank: queryEmbedding && chunk.embedding ? cosine(queryEmbedding, chunk.embedding) : score(query, chunk.text) })) : [{ ...ref, rank: score(query, ref.text) }]).sort((a, b) => b.rank - a.rank);
    let left = MAX_CONTEXT; const chunks = []; for (const ref of selected) { if (left <= 0) break; const value = String(ref.text || "").slice(0, Math.min(left, 6000)); if (value) { chunks.push(`[${ref.type}:${ref.name}]\n${value}`); left -= value.length; } }
    const seen = new Set(); return { refs: selected.map(({ text, chunks: ignored, ...ref }) => ref).filter((ref) => { const key = `${ref.type}:${ref.id}`; if (seen.has(key)) return false; seen.add(key); return true; }), text: chunks.join("\n\n") };
  }
  async function generate(input = {}) {
    const kind = ["choice", "flashcards", "fill", "short", "review"].includes(input.kind) ? input.kind : "choice";
    const context = await buildContext({ ...input, query: `${input.subject || ""} ${kind} ${input.focus || ""}` });
    if (!context.text) throw new Error("请至少选择一篇有内容的笔记或学习资源");
    const special = input.subject === "english" ? "For review, include Shanghai English A/B/C/D: MC reading, sentence insertion, word cloze, Task 1 Q&A and Task 2 composition." : input.subject === "chinese" ? "For review include Chinese reading comprehension, allowing modern or classical text." : input.subject === "math" ? "For review include calculation problems with verifiable answers." : "";
    const kindRules = {
      choice: "Create ONLY multiple-choice questions. Every question.type MUST be choice and include 2–6 options.",
      flashcards: "Create ONLY flashcards. Every question.type MUST be flashcard. prompt is the front/question and answer is the back; do not create options, blanks, or essay questions.",
      fill: "Create ONLY fill-in-the-blank questions. Every question.type MUST be fill. The prompt must contain blanks and answer gives the required answer.",
      short: "Create ONLY short-answer questions. Every question.type MUST be short. Ask for reasoning, steps, or a concise written response.",
      review: "Create a mixed review. question.type may be choice, fill, or short; include only flashcard when it is genuinely useful for memorisation.",
    };
    const prompt = `Create a ${kind} learning practice in Chinese. ${kindRules[kind]} ${special}\nReturn strict JSON only: {"title":"...","questions":[{"id":"q1","type":"choice|flashcard|fill|short","prompt":"...","options":["..."],"answer":"...","acceptableAnswers":["..."],"explanation":"..."}]}. For flashcard use prompt as front and answer as back. Do not include explanation in the visible result unless the user is wrong.\n\nStudy material:\n${context.text}`;
    const raw = await complete({ text: prompt, maxTokens: 5000, temperature: .35, system: "You generate accurate structured learning exercises. Output JSON only." });
    let parsed; try { parsed = JSON.parse(stripCodeFence(raw)); } catch { throw new Error("模型没有返回可用的题目结构，请重试"); }
    const forcedType = { choice: "choice", flashcards: "flashcard", fill: "fill", short: "short" }[kind] || null;
    const questions = Array.isArray(parsed.questions) ? parsed.questions.slice(0, 30).map((item, index) => ({ id: clean(item.id || `q${index + 1}`, 40), type: forcedType || (["choice", "flashcard", "fill", "short"].includes(item.type) ? item.type : "short"), prompt: String(item.prompt || "").slice(0, 12000), options: Array.isArray(item.options) ? item.options.map((v) => String(v).slice(0, 1000)).slice(0, 8) : [], answer: String(item.answer || "").slice(0, 6000), acceptableAnswers: Array.isArray(item.acceptableAnswers) ? item.acceptableAnswers.map((v) => String(v).slice(0, 1000)).slice(0, 10) : [], explanation: String(item.explanation || "").slice(0, 8000), response: null })).filter((item) => item.prompt && item.answer) : [];
    if (!questions.length) throw new Error("题目内容为空，请调整资料后重试"); const practice = { id: id("practice"), title: clean(parsed.title || "学习练习", 120), kind, subject: clean(input.subject || "general", 40), sourceMode: input.sourceMode === "web" ? "web" : "local", refs: context.refs, questions, createdAt: Date.now(), updatedAt: Date.now() }; atomicJson(practicePath(practice.id), practice); return practice;
  }
  function listPractices() { return listFrom(practicesDir).filter((file) => file.endsWith(".json")).map((file) => readJson(path.join(practicesDir, file), null)).filter(Boolean).map((item) => ({ id: item.id, title: item.title, kind: item.kind, subject: item.subject, createdAt: item.createdAt, updatedAt: item.updatedAt, completed: item.questions?.filter((q) => q.response).length || 0, total: item.questions?.length || 0 })).sort((a, b) => b.updatedAt - a.updatedAt); }
  function getPractice(practiceId) { return valid("practice", practiceId) ? readJson(practicePath(practiceId), null) : null; }
  function deletePractice(practiceId) { if (!valid("practice", practiceId)) return false; try { fs.unlinkSync(practicePath(practiceId)); return true; } catch { return false; } }
  async function submit(practiceId, questionId, answer, imageDataUrl) {
    const practice = getPractice(practiceId); if (!practice) throw new Error("练习不存在"); const question = practice.questions.find((item) => item.id === questionId); if (!question) throw new Error("题目不存在");
    const submitted = String(answer || "").trim(); const image = String(imageDataUrl || "");
    if (question.response && question.response.answer === submitted && question.response.image === image) return { practice, response: question.response };
    const allowed = [question.answer, ...(question.acceptableAnswers || [])].map((item) => String(item).trim().toLowerCase()).filter(Boolean); let correct = question.type === "short" ? null : allowed.includes(submitted.toLowerCase());
    let analysis = ""; if (correct === false || question.type === "short") { const verdict = await complete({ image, maxTokens: 1800, temperature: .35, system: "Use the active TsukuMate persona voice. Grade the answer carefully. If it is correct, return JSON {\"correct\":true,\"analysis\":\"\"}. If wrong, return JSON with correct:false and a concise explanation of the error, correct reasoning, key knowledge and next step. JSON only.", text: `题目：${question.prompt}\n标准答案：${question.answer}\n用户答案：${submitted || "（图片答案）"}` }); try { const graded = JSON.parse(stripCodeFence(verdict)); if (question.type === "short") question.response = { answer: submitted, image, correct: graded.correct === true, analysis: graded.correct === true ? "" : String(graded.analysis || "") }; else { correct = graded.correct === true; analysis = correct ? "" : String(graded.analysis || question.explanation); } } catch { analysis = question.explanation; } }
    if (!question.response) question.response = { answer: submitted, image: imageDataUrl || "", correct, analysis: correct === false ? analysis : "" }; practice.updatedAt = Date.now(); atomicJson(practicePath(practice.id), practice); return { practice, response: question.response };
  }
  async function submitBatch(practiceId, answers = []) {
    const initial = getPractice(practiceId); if (!initial) throw new Error("练习不存在");
    const submitted = new Map((Array.isArray(answers) ? answers : []).slice(0, 30).map((item) => [String(item && item.questionId || ""), item]));
    for (const question of initial.questions || []) {
      const item = submitted.get(question.id); if (!item) continue;
      if (question.type === "flashcard") {
        const latest = getPractice(practiceId); const target = latest && latest.questions.find((value) => value.id === question.id); if (!target) continue;
        const mastered = item.mastered === true; target.response = { answer: mastered ? "__mastered__" : "__review__", image: "", correct: mastered, analysis: "" }; latest.updatedAt = Date.now(); atomicJson(practicePath(practiceId), latest);
      } else await submit(practiceId, question.id, item.answer, item.imageDataUrl);
    }
    return { practice: getPractice(practiceId) };
  }
  return { listNotes, getNote, saveNote, deleteNote, addResources, selectAnswerImage, listResources, getResource, retryResource, deleteResource, searchWeb, buildContext, generate, listPractices, getPractice, deletePractice, submit, submitBatch };
}

module.exports = { createLearningService };
