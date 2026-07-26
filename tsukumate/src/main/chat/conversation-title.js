"use strict";

const { cleanTitle } = require("./conversation-store");

function parseGeneratedTitle(value, language = "zh-CN") {
  let raw = String(value || "").trim();
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let title = "";
  try { title = JSON.parse(raw).title; } catch { return ""; }
  title = cleanTitle(title, 60);
  if (!title) return "";
  const compactLanguage = /^(zh|ja|ko)/i.test(String(language || ""));
  if (compactLanguage && [...title].length > 20) return "";
  if (!compactLanguage && title.split(/\s+/).filter(Boolean).length > 8) return "";
  return title;
}

function buildTitlePrompt(text, attachmentNames, language = "zh-CN") {
  return [
    `Create a concise conversation title in the UI language ${language}.`,
    "Return JSON only: {\"title\":\"...\"}.",
    /^(zh|ja|ko)/i.test(language) ? "Use 4-20 characters when practical." : "Use 3-8 words.",
    `First user message: ${String(text || "").slice(0, 1200)}`,
    `Attachment names: ${(attachmentNames || []).map(String).join(", ").slice(0, 500) || "none"}`,
  ].join("\n");
}

module.exports = { parseGeneratedTitle, buildTitlePrompt };
