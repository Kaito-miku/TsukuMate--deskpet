"use strict";

(function initLearningTab(root) {
  function init(core) {
    const el = (tag, attrs, ...children) => { const node = document.createElement(tag); Object.entries(attrs || {}).forEach(([key, value]) => key === "className" ? node.className = value : node.setAttribute(key, value)); children.flat().filter((child) => child != null).forEach((child) => node.append(typeof child === "string" ? document.createTextNode(child) : child)); return node; };
    function field(label, type, value, placeholder) { const input = el("input", { type, className: "minicpm-adapter-editor-input", placeholder: placeholder || "" }); input.value = value || ""; return [el("label", { className: "minicpm-api-input-field" }, el("span", {}, label), input), input]; }
    async function render(parent) {
      parent.replaceChildren(); const config = await window.minicpmSettings.getLearningConfig();
      parent.append(el("div", { className: "page-header" }, el("div", { className: "page-header-copy" }, el("h1", { className: "page-title" }, "学习检索与联网资料"), el("p", { className: "page-subtitle" }, "向量服务可选；未配置或不可用时，学习资源会自动使用本地关键词检索。密钥仅由系统加密存储。"))));
      const section = el("section", { className: "section" }); const rows = el("div", { className: "section-rows" }); section.append(rows);
      const [embeddingEndpoint, endpoint] = field("Embeddings 地址（OpenAI 兼容）", "url", config.embeddingEndpoint, "https://api.example.com/v1/embeddings"); const [embeddingModel, model] = field("Embeddings 模型", "text", config.embeddingModel, "text-embedding-3-small"); const [embeddingKey, key] = field("Embeddings API Key", "password", "", config.embeddingKeyConfigured ? "已保存，留空保持原 Key" : "可选");
      rows.append(el("div", { className: "minicpm-api-editor" }, embeddingEndpoint, embeddingModel, embeddingKey));
      const provider = el("select", { className: "minicpm-adapter-editor-input" }); [["none", "不使用联网资料"], ["tavily", "Tavily"], ["searxng", "SearXNG 兼容服务"]].forEach(([value, label]) => { const option = el("option", { value }, label); option.selected = config.searchProvider === value; provider.append(option); });
      const [searchEndpoint, searchUrl] = field("搜索服务地址", "url", config.searchEndpoint, "Tavily 默认 https://api.tavily.com/search；SearXNG 填实例地址"); const [searchKey, searchSecret] = field("搜索服务 API Key", "password", "", config.searchKeyConfigured ? "已保存，留空保持原 Key" : "Tavily 通常需要；SearXNG 通常无需");
      rows.append(el("div", { className: "minicpm-api-editor" }, el("label", { className: "minicpm-api-input-field" }, el("span", {}, "联网资料服务"), provider), searchEndpoint, searchKey));
      const enabled = el("input", { type: "checkbox" }); enabled.checked = config.a2uiEnabled !== false;
      const visualBubble = el("input", { type: "checkbox" }); visualBubble.checked = config.visualBubbleEnabled !== false;
      const [whepEndpoint, whepUrl] = field("WHEP 播放地址（可选）", "url", config.whepEndpoint, "https://stream.example.com/whep"); const [whepKey, whepSecret] = field("WHEP 访问令牌（可选）", "password", "", config.whepKeyConfigured ? "已保存，留空保持原令牌" : "仅在服务需要认证时填写");
      rows.append(el("div", { className: "minicpm-api-editor" }, el("label", { className: "minicpm-api-input-field" }, el("span", {}, "启用 A2UI 富内容"), enabled), el("label", { className: "minicpm-api-input-field" }, el("span", {}, "全部 AI 回复使用可视学习气泡"), visualBubble), whepEndpoint, whepKey));
      const save = el("button", { type: "button", className: "soft-btn accent" }, "保存学习检索设置"); save.onclick = async () => { save.disabled = true; const result = await window.minicpmSettings.saveLearningConfig({ embeddingEndpoint: endpoint.value, embeddingModel: model.value, embeddingKey: key.value, searchProvider: provider.value, searchEndpoint: searchUrl.value, searchKey: searchSecret.value, a2uiEnabled: enabled.checked, visualBubbleEnabled: visualBubble.checked, whepEndpoint: whepUrl.value, whepKey: whepSecret.value }); save.disabled = false; core.ops.showToast(result?.ok ? "学习检索设置已保存。" : `保存失败：${result?.error || ""}`, { error: !result?.ok }); if (result?.ok) await render(parent); };
      rows.append(el("div", { className: "row" }, el("div", { className: "row-text" }, el("div", {}, "联网阅读材料会由 AI 基于检索事实原创改写，并显示来源与检索日期。")), el("div", { className: "row-control" }, save))); parent.append(section);
    }
    core.tabs.learning = { render: (parent) => { void render(parent); } };
  }
  root.ClawdSettingsTabLearning = { init };
})(globalThis);
