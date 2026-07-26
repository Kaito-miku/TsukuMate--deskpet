/*
 * Adapted from UniStudy's MIT-licensed safeHtml/contentProcessor preview
 * pipeline. TsukuMate uses a stricter, scriptless iframe boundary.
 */
import DOMPurify from "dompurify";

const BLOCKED_TAGS = ["script", "form", "iframe", "object", "embed", "meta", "link", "base", "video", "audio"];

function safeCss(value) {
  return String(value || "")
    .replace(/@import[\s\S]*?;/gi, "")
    .replace(/url\s*\([^)]*\)/gi, "none")
    .replace(/expression\s*\([^)]*\)/gi, "");
}

function safeHtml(value) {
  return DOMPurify.sanitize(String(value || ""), {
    FORBID_TAGS: BLOCKED_TAGS,
    FORBID_ATTR: ["src", "srcset", "href", "action", "formaction", "target"],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: true,
  });
}

function sourceText(card) {
  return `${card.css ? `<style>\n${card.css}\n</style>\n` : ""}${card.html || ""}`;
}

function renderCard(host, card) {
  const shell = document.createElement("section");
  shell.className = "study-card-shell";
  const toolbar = document.createElement("div"); toolbar.className = "study-card-toolbar";
  const status = document.createElement("span"); status.textContent = "学习卡片";
  const toggle = document.createElement("button"); toggle.type = "button"; toggle.textContent = "查看源码";
  const frame = document.createElement("iframe"); frame.className = "study-card-frame";
  frame.setAttribute("sandbox", ""); frame.setAttribute("referrerpolicy", "no-referrer");
  frame.title = "AI 生成的学习卡片";
  const source = document.createElement("pre"); source.className = "study-card-source"; source.hidden = true;
  source.textContent = sourceText(card);
  const html = safeHtml(card.html);
  const css = safeCss(card.css);
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'none';"><style>html,body{margin:0;padding:0;background:transparent;color:#eef0f6;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}*{box-sizing:border-box}${css}</style></head><body>${html}</body></html>`;
  toggle.addEventListener("click", () => {
    const showingSource = source.hidden;
    source.hidden = !showingSource; frame.hidden = showingSource;
    toggle.textContent = showingSource ? "返回卡片" : "查看源码";
  });
  toolbar.append(status, toggle); shell.append(toolbar, frame, source); host.appendChild(shell);
  return () => { frame.srcdoc = ""; shell.remove(); };
}

window.TsukuMateRichContent = { renderCard, safeCss, safeHtml };
