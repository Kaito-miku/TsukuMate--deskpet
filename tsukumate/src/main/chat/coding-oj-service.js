"use strict";

const ALLOWED = new Map([
  ["codeforces", ["codeforces.com", "www.codeforces.com"]],
  ["atcoder", ["atcoder.jp", "www.atcoder.jp"]],
  ["luogu", ["luogu.com.cn", "www.luogu.com.cn"]],
]);
const MAX_RESPONSE_BYTES = 1_500_000;
const TIMEOUT_MS = 9_000;
function text(value, max = 300) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
function sourceForUrl(value) { try { const host = new URL(value).hostname.toLowerCase(); return [...ALLOWED].find(([, hosts]) => hosts.includes(host))?.[0] || null; } catch { return null; } }
function toMarkdown(title, body, samples) { return `# ${title}\n\n${body}\n${samples.map((sample, i) => `\n## 样例 ${i + 1}\n\n### 输入\n\n\`\`\`text\n${sample.input}\n\`\`\`\n\n### 输出\n\n\`\`\`text\n${sample.output}\n\`\`\``).join("\n")}`; }
function decode(value) { return String(value || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
function strip(value) { return decode(String(value || "").replace(/<\/(?:p|div|li|h[1-6]|br|pre)>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/\n{3,}/g, "\n\n").trim(); }
function luoguProblem(html) {
  const raw = String(html || "").match(/<script\s+id=["']lentille-context["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!raw) return null;
  try {
    const problem = JSON.parse(raw)?.data?.problem; const content = problem?.content;
    if (!problem || !content) return null;
    const title = `${problem.pid || ""} ${content.name || problem.name || "洛谷题目"}`.trim();
    const section = (heading, value) => String(value || "").trim() ? `## ${heading}\n\n${String(value).trim()}` : "";
    const samples = Array.isArray(problem.samples) ? problem.samples.slice(0, 20).flatMap((pair, index) => Array.isArray(pair) ? [{ id: `sample-${index + 1}`, input: String(pair[0] || ""), output: String(pair[1] || ""), source: "sample" }] : []) : [];
    const limits = problem.limits || {}; const time = Array.isArray(limits.time) ? limits.time[0] : null; const memory = Array.isArray(limits.memory) ? limits.memory[0] : null;
    const header = [time ? `时间限制：${(Number(time) / 1000).toFixed(2)}s` : "", memory ? `内存限制：${(Number(memory) / 1024).toFixed(2)}MB` : ""].filter(Boolean).join("　");
    const body = [header, section("题目背景", content.background), section("题目描述", content.description), section("输入格式", content.formatI), section("输出格式", content.formatO), section("说明/提示", content.hint)].filter(Boolean).join("\n\n");
    return { title, markdown: toMarkdown(title, body, samples), tests: samples };
  } catch { return null; }
}
function lentille(html) {
  const raw = String(html || "").match(/<script\s+id=["']lentille-context["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function luoguPid(url) {
  try { return new URL(String(url || "")).pathname.match(/\/problem\/([a-z]\d+)\/?$/i)?.[1]?.toUpperCase() || null; } catch { return null; }
}

function createCodingOjService({ fetchImpl = global.fetch } = {}) {
  const cache = new Map();
  async function withinTimeout(promise, milliseconds = TIMEOUT_MS) {
    let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("题目来源请求超时")), milliseconds); })]); } finally { clearTimeout(timer); }
  }
  async function fetchText(url) {
    const source = sourceForUrl(url); if (!source) throw new Error("不支持的题目来源");
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try { const response = await fetchImpl(url, { signal: controller.signal, headers: { "user-agent": "TsukuMate/1.0 educational problem importer" } }); if (!response.ok) throw new Error(response.status === 403 || response.status === 401 ? "该站点拒绝访问或需要登录" : `来源返回 ${response.status}`); const length = Number(response.headers.get("content-length") || 0); if (length > MAX_RESPONSE_BYTES) throw new Error("题面响应过大"); const value = await response.text(); if (Buffer.byteLength(value, "utf8") > MAX_RESPONSE_BYTES) throw new Error("题面响应过大"); return value; } finally { clearTimeout(timer); }
  }
  function cfResult(item) { const contest = item.contestId ? `${item.contestId}${item.index}` : item.name; return { id: `cf:${contest}`, source: "codeforces", title: item.name, label: contest, difficulty: item.rating ? `${item.rating}` : "", tags: item.tags || [], url: item.contestId ? `https://codeforces.com/problemset/problem/${item.contestId}/${item.index}` : "", summary: text((item.tags || []).join(" · "), 160) }; }
  async function search(query, source = "all") {
    const q = text(query, 120); if (!q) return [];
    const direct = sourceForUrl(q) ? { url: q } : null;
    const looksCf = /^(\d+)\s*([a-z]\d?)$/i.exec(q.replace(/\//g, " "));
    const looksLuogu = /^(p\d+)$/i.exec(q); const looksAtcoder = /^([a-z0-9_]+)$/i.test(q) && q.includes("_");
    if (direct) return [{ id: `url:${q}`, source: sourceForUrl(q), title: q, label: "导入公开题面", url: q, summary: "点击导入题目" }];
    const results = [];
    if ((source === "all" || source === "codeforces") && looksCf) results.push({ id: `cf:${looksCf[1]}${looksCf[2].toUpperCase()}`, source: "codeforces", title: `Codeforces ${looksCf[1]}${looksCf[2].toUpperCase()}`, label: `${looksCf[1]}${looksCf[2].toUpperCase()}`, url: `https://codeforces.com/problemset/problem/${looksCf[1]}/${looksCf[2].toUpperCase()}`, summary: "按题号导入" });
    if ((source === "all" || source === "luogu") && looksLuogu) results.push({ id: `luogu:${looksLuogu[1].toUpperCase()}`, source: "luogu", title: `洛谷 ${looksLuogu[1].toUpperCase()}`, label: looksLuogu[1].toUpperCase(), url: `https://www.luogu.com.cn/problem/${looksLuogu[1].toUpperCase()}`, summary: "按题号导入" });
    if ((source === "all" || source === "atcoder") && looksAtcoder) results.push({ id: `atcoder:${q}`, source: "atcoder", title: `AtCoder ${q}`, label: q, url: `https://atcoder.jp/contests/${q.split("_")[0]}/tasks/${q}`, summary: "按任务 ID 导入" });
    // A concrete problem identifier is deterministic. Never make its result
    // depend on a large remote catalogue request from another provider.
    if (results.length) return results;
    if (source === "all" || source === "codeforces") {
      try { const response = await withinTimeout(fetchImpl("https://codeforces.com/api/problemset.problems", { signal: AbortSignal.timeout ? AbortSignal.timeout(TIMEOUT_MS) : undefined })); const payload = await withinTimeout(response.json()); for (const item of (payload.result?.problems || []).filter((item) => text(item.name).toLowerCase().includes(q.toLowerCase())).slice(0, 20)) results.push(cfResult(item)); } catch {}
    }
    return results.slice(0, 30);
  }
  function parseSamples(html) { const samples = []; const inputs = [...html.matchAll(/(?:input|sample-input)[^>]*>\s*<pre[^>]*>([\s\S]*?)<\/pre>/gi)].map((m) => strip(m[1])); const outputs = [...html.matchAll(/(?:output|sample-output)[^>]*>\s*<pre[^>]*>([\s\S]*?)<\/pre>/gi)].map((m) => strip(m[1])); for (let i = 0; i < Math.min(inputs.length, outputs.length, 20); i += 1) samples.push({ id: `sample-${i + 1}`, input: inputs[i], output: outputs[i], source: "sample" }); return samples; }
  async function importProblem(url) {
    const source = sourceForUrl(url); if (!source) throw new Error("只支持 Codeforces、AtCoder 或洛谷公开题面");
    const cacheKey = url; const old = cache.get(cacheKey); if (old && Date.now() - old.time < 5 * 60_000) return old.value;
    const html = await fetchText(url); const structured = source === "luogu" ? luoguProblem(html) : null; const title = structured?.title || text((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "导入题目", 120); const samples = structured?.tests || parseSamples(html); const body = strip((html.match(/<div[^>]+class=["'][^"']*(?:problem-statement|statement|content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || "").slice(0, 100000);
    const value = { source, sourceUrl: url, title, markdown: structured?.markdown || toMarkdown(title, body || "题面未能完整解析，请在编辑模式补充。", samples), tests: samples, importedAt: new Date().toISOString() }; cache.set(cacheKey, { time: Date.now(), value }); return value;
  }
  return { search, importProblem, sourceForUrl, luoguPid, ALLOWED };
}
module.exports = { createCodingOjService, sourceForUrl, luoguProblem, luoguPid };
