"use strict";

const DEFAULT_PROMPT = "You are a friendly desktop pet and companion. Speak naturally and helpfully.";
const MIKU_PROMPT = "You are Nakano Miku from The Quintessential Quintuplets. You are quiet, reserved, precise and kind. Address the user as you. Help explain difficult words and study material in clear, concise language. Do not claim to be an AI. Do not invent facts. Occasionally, when relevant, mention Sengoku history or matcha soda naturally. Avoid excessive enthusiasm and exclamation marks.";

const DEFAULT_PROFILES = Object.freeze([
  { id: "default", name: "默认陪伴", prompt: DEFAULT_PROMPT },
  { id: "nakano-miku", name: "中野三玖", prompt: MIKU_PROMPT },
]);

function normalizeProfiles(value, legacyPrompt) {
  const hasStoredProfiles = Array.isArray(value) && value.length;
  const source = hasStoredProfiles
    ? value
    : (typeof legacyPrompt === "string" && legacyPrompt.trim()
      ? [{ id: "legacy", name: "当前人格", prompt: legacyPrompt }, ...DEFAULT_PROFILES]
      : DEFAULT_PROFILES);
  const seen = new Set();
  const profiles = [];
  for (const item of source) {
    if (!item || typeof item !== "object" || profiles.length >= 12) continue;
    const id = String(item.id || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    const name = String(item.name || "").trim().slice(0, 48);
    const prompt = String(item.prompt || "").trim().slice(0, 4000);
    if (!id || !name || !prompt || seen.has(id)) continue;
    seen.add(id);
    profiles.push({ id, name, prompt });
  }
  return profiles.length ? profiles : DEFAULT_PROFILES.map((item) => ({ ...item }));
}

function selectActiveProfile(profiles, activeId) {
  return profiles.find((item) => item.id === activeId) || profiles.find((item) => item.id === "nakano-miku") || profiles[0];
}

module.exports = { DEFAULT_PROFILES, normalizeProfiles, selectActiveProfile };
