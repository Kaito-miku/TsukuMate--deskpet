"use strict";

(function initSettingsTabPersonas(root) {
  function init(core) {
    const { showToast } = core.ops;
    function el(tag, attrs, ...children) {
      const node = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs || {})) {
        if (key === "className") node.className = value;
        else node.setAttribute(key, value);
      }
      for (const child of children) {
        if (child != null) node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
      }
      return node;
    }

    function makeId(name, used) {
      const base = String(name || "persona").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "persona";
      let id = base.slice(0, 40);
      let n = 2;
      while (used.has(id)) id = `${base.slice(0, 36)}-${n++}`;
      return id;
    }

    async function render(parent) {
      parent.innerHTML = "";
      const title = el("div", { className: "page-header" }, el("div", { className: "page-header-copy" },
        el("h1", { className: "page-title" }, "人格"),
        el("p", { className: "page-subtitle" }, "选择桌宠说话方式，或创建自己的提示词。")
      ));
      parent.appendChild(title);
      let data = { profiles: [], activeId: "" };
      try { data = await window.minicpmSettings.getPersonaProfiles(); } catch {}
      const profiles = Array.isArray(data && data.profiles) ? data.profiles.map((item) => ({ ...item })) : [];
      let activeId = data && data.activeId;
      const section = el("section", { className: "section" });
      const rows = el("div", { className: "section-rows" });
      section.appendChild(rows);

      const save = async () => {
        const result = await window.minicpmSettings.savePersonaProfiles({ profiles, activeId });
        if (!result || !result.ok) {
          showToast(`保存人格失败：${(result && result.error) || ""}`, { error: true });
          return false;
        }
        activeId = result.activeId;
        showToast("人格设置已保存。", { error: false });
        return true;
      };

      const redraw = () => { void render(parent); };
      for (const profile of profiles) {
        const row = el("div", { className: "row minicpm-api-field" });
        const text = el("div", { className: "row-text" });
        const select = el("input", { type: "radio", name: "active-persona" });
        select.checked = profile.id === activeId;
        select.addEventListener("change", async () => { activeId = profile.id; await save(); redraw(); });
        const name = el("input", { type: "text", className: "minicpm-adapter-editor-input", maxlength: "48" });
        name.value = profile.name;
        const prompt = el("textarea", { className: "minicpm-adapter-editor-input", rows: "6", maxlength: "4000" });
        prompt.value = profile.prompt;
        name.addEventListener("input", () => { profile.name = name.value.trim() || "未命名人格"; });
        prompt.addEventListener("input", () => { profile.prompt = prompt.value; });
        text.appendChild(el("span", { className: "row-label" }, profile.id === activeId ? "当前人格" : "人格"));
        text.appendChild(name);
        text.appendChild(prompt);
        row.appendChild(text);
        const controls = el("div", { className: "row-control" }, select);
        if (profiles.length > 1) {
          const remove = el("button", { type: "button", className: "soft-btn" }, "删除");
          remove.addEventListener("click", async () => {
            const index = profiles.indexOf(profile);
            profiles.splice(index, 1);
            if (activeId === profile.id) activeId = profiles[0].id;
            await save(); redraw();
          });
          controls.appendChild(remove);
        }
        row.appendChild(controls);
        rows.appendChild(row);
      }
      const actions = el("div", { className: "row" }, el("div", { className: "row-text" }), el("div", { className: "row-control" }));
      const controls = actions.querySelector(".row-control");
      const add = el("button", { type: "button", className: "soft-btn" }, "新增人格");
      add.addEventListener("click", () => {
        const used = new Set(profiles.map((item) => item.id));
        const name = "新人格";
        profiles.push({ id: makeId(`${name}-${Date.now()}`, used), name, prompt: "请填写这个人格的提示词。" });
        redraw();
      });
      const commit = el("button", { type: "button", className: "soft-btn accent" }, "保存");
      commit.addEventListener("click", () => { void save(); });
      controls.appendChild(add); controls.appendChild(commit); rows.appendChild(actions);
      parent.appendChild(section);
    }
    core.tabs.personas = { render };
  }
  root.ClawdSettingsTabPersonas = { init };
})(globalThis);
