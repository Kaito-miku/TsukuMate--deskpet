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

// Weighted, multilingual instant classifier. Broad task words carry little
// weight; explicit feelings and emergencies dominate. This keeps commands
// such as "打开设置" focused while still letting "垃圾软件又崩了" read as
// annoyed. The remote API is free to correct this provisional result later.
const HEURISTIC_RULES = [
  { emotion: "shy", weight: 6, pattern: /害羞|不好意思|脸红|臉紅|羞涩|羞澀|暧昧|曖昧|喜欢你|喜歡你|爱你|愛你|照れ|恥ずかし|\bshy\b|embarrass|blush/gi },
  { emotion: "surprised", weight: 6, pattern: /惊讶|驚訝|吓一跳|嚇一跳|惊呆|驚呆|真的假的|被抢|被搶|抢走|搶走|失窃|失竊|出事|事故|受伤|受傷|危险|危險|紧急|緊急|救命|报警|報警|びっくり|驚き|emergency|panic|surpris|shock|unexpected/gi },
  { emotion: "surprised", weight: 3, pattern: /惊喜|驚喜|没想到|沒想到|居然|突然|\bwow\b|hooray|yippee/gi },
  { emotion: "annoyed", weight: 6, pattern: /垃圾|烂|爛|骗子|騙子|无语|無語|恶心|噁心|闭嘴|閉嘴|滚|滾|废话|廢話|白痴|差劲|差勁|死板|骂|罵|生气|生氣|愤怒|憤怒|气死|氣死|不爽|むかつ|怒り|annoy|angry|\bmad\b|damn|fuck|shut up|idiot|horrible|terrible/gi },
  { emotion: "annoyed", weight: 3, pattern: /烦|煩|讨厌|討厭|不喜欢|不喜歡|投诉|投訴|差评|差評|退款|退钱|退錢|卡顿|卡頓|报错|報錯|崩溃|崩潰|卸载|卸載|太慢|不好用|没用|沒用|故障|死机|死機|complain|refund|crash|\blag\b|error|failed|useless|\bbug\b|uninstall/gi },
  { emotion: "sad", weight: 6, pattern: /不开心|不開心|不高兴|不高興|难过|難過|伤心|傷心|委屈|失望|绝望|絕望|后悔|後悔|孤独|孤獨|痛苦|不想说了|不想說了|算了吧|再见|再見|悲し|寂し|\bsad\b|upset|disappoint|regret|lonely|give up|unfortunately|alas|not happy/gi },
  { emotion: "sad", weight: 4, pattern: /哭|受伤|受傷|损失|損失|丢了|丟了|没了|沒了|hurt|\bcry\b|lost|damaged|ruined/gi },
  { emotion: "sleepy", weight: 6, pattern: /困倦|好困|想睡|晚安|睡觉|睡覺|累死|眠い|眠たい|sleepy|exhaust/gi },
  { emotion: "sleepy", weight: 3, pattern: /疲惫|疲憊|累了|太累|乏力|\btired\b|fatigue/gi },
  { emotion: "happy", weight: 5, pattern: /开心|開心|高兴|高興|太好了|成功了|完成了|幸福|惊喜|驚喜|万岁|萬歲|有心了|うれし|嬉し|楽しい|\bhappy\b|\bglad\b|awesome|hooray|great news/gi },
  { emotion: "happy", weight: 3, pattern: /谢谢|謝謝|感谢|感謝|多亏|多虧|辛苦了|喜欢|喜歡|爱了|愛了|感恩|棒|优秀|優秀|完美|厉害|厲害|聪明|聰明|专业|專業|靠谱|靠譜|真快|懂我|绝了|絕了|点赞|點讚|thank|grateful|appreciate|great|perfect|amazing|brilliant|cool|super|\blove\b/gi },
  { emotion: "happy", weight: 1, pattern: /没错|沒錯|赞同|贊同|支持|认可|認可|可以|没问题|沒問題|好用|实用|實用|正确|正確|\byes\b|correct|agree|\bok(?:ay)?\b|useful|solved/gi },
  { emotion: "focused", weight: 3, pattern: /分析|研究|认真|認真|专注|專注|仔细|仔細|解释|解釋|学习|學習|代码|代碼|文件|方案|计划|計畫|步骤|步驟|方法|查询|查詢|搜索|搜尋|修改|生成|翻译|翻譯|調べ|集中|focus|analy|study|explain|debug|\bcode\b|steps|method|search|edit|generate|translate/gi },
  { emotion: "focused", weight: 2, pattern: /请问|請問|怎么|怎麼|如何|为什么|為什麼|什么|什麼|多少|哪里|哪裡|帮我|幫我|打开|打開|关闭|關閉|显示|顯示|状态|狀態|进度|進度|数据|數據|内容|內容|文档|文檔|格式|版本|功能|设置|設置|更新|结果|結果|how|what|why|where|when|please|question|show|display|status|progress|data|format|version|setting|update|result/gi },
  { emotion: "annoyed", weight: 1, pattern: /不对|不對|错了|錯了|不行|拒绝|拒絕|抗议|抗議|麻烦|麻煩|费劲|費勁|wrong|incorrect|reject|refuse|\bnope?\b/gi },
];

const EMOTION_TIE_PRIORITY = ["shy", "surprised", "annoyed", "sad", "sleepy", "happy", "focused"];

function scoreEmotionText(input) {
  let text = String(input || "").slice(0, 2000);
  text = text
    .replace(/(?:没有|沒有|没|沒|不)生[气氣]|not\s+(?:angry|mad)/gi, "")
    .replace(/(?:并不|並不|不是|不太)讨厌|(?:并不|並不|do not|don't)\s+hate/gi, "");
  const scores = Object.fromEntries(EMOTION_TIE_PRIORITY.map((emotion) => [emotion, 0]));
  for (const { emotion, weight, pattern } of HEURISTIC_RULES) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) scores[emotion] += matches.length * weight;
  }
  if (/[!！]{2,}/.test(text)) scores.surprised += 2;
  if (/[?？]{2,}/.test(text)) scores.surprised += 3;
  if (/[😊😄😁🎉👍❤❤️]/u.test(text)) scores.happy += 4;
  if (/[😢😭💔]/u.test(text)) scores.sad += 5;
  if (/[😡🤬]/u.test(text)) scores.annoyed += 6;
  let best = null;
  let bestScore = 0;
  for (const emotion of EMOTION_TIE_PRIORITY) {
    if (scores[emotion] > bestScore) { best = emotion; bestScore = scores[emotion]; }
  }
  return { emotion: best, score: bestScore, scores };
}

function inferEmotionFromText(input) {
  return scoreEmotionText(input).emotion;
}

module.exports = { EMOTIONS, normalizeEmotionToken, parseEmotionResponse, extractAssistantText, scoreEmotionText, inferEmotionFromText };
