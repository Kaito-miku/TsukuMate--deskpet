"use strict";

const CARD_FENCE_RE = /```tsukumate-study-card\s*\n([\s\S]*?)```/gi;
const MAX_CARDS = 3;
const MAX_TOTAL_BYTES = 100 * 1024;

function splitStyle(source) {
  let css = "";
  const html = String(source || "").replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, value) => {
    css += `${value}\n`;
    return "";
  }).trim();
  return { html, css: css.trim(), source: "ai" };
}

function parseRichStudyCards(input) {
  const raw = String(input || "");
  const cards = [];
  let totalBytes = 0;
  let match;
  let plain = "";
  let cursor = 0;
  CARD_FENCE_RE.lastIndex = 0;
  while ((match = CARD_FENCE_RE.exec(raw))) {
    plain += raw.slice(cursor, match.index);
    cursor = CARD_FENCE_RE.lastIndex;
    const bytes = Buffer.byteLength(match[1] || "", "utf8");
    if (cards.length >= MAX_CARDS || totalBytes + bytes > MAX_TOTAL_BYTES) {
      plain += match[0];
      continue;
    }
    const card = splitStyle(match[1]);
    if (!card.html) {
      plain += match[0];
      continue;
    }
    totalBytes += bytes;
    cards.push(card);
  }
  plain += raw.slice(cursor);
  return { content: plain.trim(), richCards: cards };
}

function studyCardMode(text) {
  const value = String(text || "").toLowerCase();
  if (/(纯文字|不要(?:用)?(?:气泡|卡片)|不用(?:气泡|卡片)|plain\s*text|no\s*(?:card|bubble)|カードなし)/i.test(value)) return "off";
  if (/(用|使用|做成|生成).{0,6}(气泡|卡片)|(?:card|bubble)\s*(?:view|format)|カードで/i.test(value)) return "force";
  return "auto";
}

function studyCardSystemPrompt(mode = "auto") {
  if (mode === "off") return "Answer with ordinary text only. Do not emit a tsukumate-study-card block.";
  const policy = mode === "force"
    ? "The user explicitly requested a visual study card, so include one."
    : "Include a card only when it materially improves a structured explanation, comparison, timeline, formula, multi-step process, vocabulary review, flashcard, or quiz. Do not use it for casual chat, short factual replies, clarifications, errors, emotional support, or code-only answers.";
  return [
    policy,
    "Always provide a concise ordinary-text answer first so non-rich clients remain readable.",
    "Then optionally append at most three fenced blocks labelled tsukumate-study-card.",
    "Each block may contain static HTML and a <style> element. Never include JavaScript, event handlers, forms, external resources, navigation, iframe, object, embed, or meta tags.",
  ].join(" ");
}

module.exports = { MAX_CARDS, MAX_TOTAL_BYTES, parseRichStudyCards, studyCardMode, studyCardSystemPrompt };
