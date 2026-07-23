"use strict";

const EMOTIONS = ["calm", "focused", "happy", "shy", "surprised", "sleepy", "sad", "annoyed"];

const TOKEN_ALIASES = new Map([
  ["calm", "calm"], ["neutral", "calm"], ["平静", "calm"], ["平靜", "calm"], ["冷静", "calm"],
  ["focused", "focused"], ["focus", "focused"], ["专注", "focused"], ["專注", "focused"], ["集中", "focused"],
  ["happy", "happy"], ["joy", "happy"], ["joyful", "happy"], ["开心", "happy"], ["開心", "happy"], ["高兴", "happy"], ["高興", "happy"], ["嬉しい", "happy"],
  ["shy", "shy"], ["embarrassed", "shy"], ["bashful", "shy"], ["害羞", "shy"], ["照れ", "shy"], ["羞涩", "shy"], ["羞澀", "shy"],
  ["surprised", "surprised"], ["surprise", "surprised"], ["shocked", "surprised"], ["惊讶", "surprised"], ["驚訝", "surprised"], ["惊喜", "surprised"], ["驚喜", "surprised"], ["驚き", "surprised"],
  ["sleepy", "sleepy"], ["tired", "sleepy"], ["困倦", "sleepy"], ["困", "sleepy"], ["疲惫", "sleepy"], ["疲憊", "sleepy"], ["眠い", "sleepy"],
  ["sad", "sad"], ["sadness", "sad"], ["upset", "sad"], ["难过", "sad"], ["難過", "sad"], ["伤心", "sad"], ["傷心", "sad"], ["委屈", "sad"], ["悲しい", "sad"],
  ["annoyed", "annoyed"], ["angry", "annoyed"], ["anger", "annoyed"], ["mad", "annoyed"], ["生气", "annoyed"], ["生氣", "annoyed"], ["愤怒", "annoyed"], ["憤怒", "annoyed"], ["不满", "annoyed"], ["不滿", "annoyed"], ["怒り", "annoyed"],
]);

function normalizeEmotionToken(value) {
  const token = String(value == null ? "" : value).trim().toLowerCase().replace(/[\s_.-]+/g, " ");
  if (!token) return null;
  if (TOKEN_ALIASES.has(token)) return TOKEN_ALIASES.get(token);
  for (const [alias, emotion] of TOKEN_ALIASES) {
    if (alias.length >= 2 && token.includes(alias)) return emotion;
  }
  return null;
}

function parseEmotionResponse(raw) {
  const text = String(raw == null ? "" : raw).trim();
  if (!text) return null;
  const unfenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const candidates = [unfenced];
  const objectMatch = unfenced.match(/\{[\s\S]*?\}/);
  if (objectMatch && objectMatch[0] !== unfenced) candidates.push(objectMatch[0]);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const emotion = normalizeEmotionToken(parsed && (parsed.emotion || parsed.mood || parsed.label));
      if (emotion) return emotion;
    } catch {}
  }
  return normalizeEmotionToken(unfenced);
}

function extractAssistantText(result) {
  const choice = result && result.choices && result.choices[0];
  const message = choice && choice.message;
  const content = message && message.content;
  const contentText = Array.isArray(content)
    ? content.map((part) => typeof part === "string" ? part : String(part && (part.text || part.content) || "")).join("\n")
    : String(content == null ? "" : content);
  return [contentText, message && message.reasoning_content, choice && choice.text]
    .filter((part) => typeof part === "string" && part.trim())
    .join("\n");
}

const HEURISTICS = [
  ["shy", /害羞|不好意思|脸红|臉紅|羞涩|羞澀|暧昧|曖昧|照れ|恥ずかし|\bshy\b|embarrass|blush/gi],
  ["surprised", /惊讶|驚訝|惊喜|驚喜|吓一跳|嚇一跳|没想到|沒想到|居然|突然|真的假的|びっくり|驚き|surpris|shock|unexpected|\bwow\b/gi],
  ["annoyed", /生气|生氣|烦|煩|讨厌|討厭|愤怒|憤怒|骂|罵|闭嘴|閉嘴|滚|滾|气死|氣死|不爽|むかつ|怒り|嫌い|annoy|angry|\bmad\b|\bhate\b|damn|fuck/gi],
  ["sad", /不开心|不開心|不高兴|不高興|难过|難過|伤心|傷心|委屈|哭|失望|孤独|孤獨|痛苦|悲し|寂し|\bsad\b|upset|cry|lonely|disappoint/gi],
  ["sleepy", /困倦|好困|想睡|晚安|睡觉|睡覺|疲惫|疲憊|累死|眠い|眠たい|sleepy|tired|exhaust/gi],
  ["happy", /开心|開心|高兴|高興|太好了|成功了|喜欢|喜歡|爱你|愛你|幸福|うれし|嬉し|楽しい|\bhappy\b|\bglad\b|great news|\blove\b/gi],
  ["focused", /分析|研究|认真|認真|专注|專注|仔细|仔細|解释|解釋|学习|學習|代码|代碼|文件|方案|计划|計畫|調べ|集中|focus|analy|study|explain|debug|\bcode\b/gi],
];

function inferEmotionFromText(input) {
  let text = String(input || "").slice(0, 2000);
  text = text.replace(/(?:没有|沒有|没|沒|不)生[气氣]|not\s+(?:angry|mad)/gi, "");
  let best = null;
  let bestScore = 0;
  for (const [emotion, pattern] of HEURISTICS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    const score = matches ? matches.length : 0;
    if (score > bestScore) { best = emotion; bestScore = score; }
  }
  return best;
}

module.exports = { EMOTIONS, normalizeEmotionToken, parseEmotionResponse, extractAssistantText, inferEmotionFromText };
