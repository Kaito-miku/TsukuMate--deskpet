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

    async function render(parent, draft) {
      parent.innerHTML = "";
      const title = el("div", { className: "page-header" }, el("div", { className: "page-header-copy" },
        el("h1", { className: "page-title" }, "人格"),
        el("p", { className: "page-subtitle" }, "选择桌宠说话方式，或创建自己的提示词。")
      ));
      parent.appendChild(title);
      let data = { profiles: [], activeId: "" };
      try { data = await window.minicpmSettings.getPersonaProfiles(); } catch {}
      const profiles = draft && Array.isArray(draft.profiles) ? draft.profiles : (Array.isArray(data && data.profiles) ? data.profiles.map((item) => ({ ...item })) : []);
      let activeId = draft && draft.activeId ? draft.activeId : data && data.activeId;
      let selectedId = draft && Object.prototype.hasOwnProperty.call(draft, "selectedId") ? draft.selectedId : null;
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

      const list = el("div", { className: "minicpm-api-profile-list" });
      for (const profile of profiles) {
        const item = el("button", { type: "button", className: profile.id === selectedId ? "minicpm-api-profile-item active" : "minicpm-api-profile-item" });
        item.dataset.profileId = profile.id;
        item.appendChild(el("span", { className: "minicpm-api-profile-name" }, profile.name || "未命名人格"));
        item.appendChild(el("span", { className: "minicpm-api-profile-model" }, profile.id === activeId ? "当前使用" : "人格提示词"));
        item.addEventListener("click", () => { void render(parent, { profiles, activeId, selectedId: selectedId === profile.id ? null : profile.id }); });
        list.appendChild(item);
      }
      const profile = profiles.find((item) => item.id === selectedId);
      if (profile) {
        const row = el("div", { className: "minicpm-api-editor" });
        const header = el("div", { className: "minicpm-api-editor-header" }, el("div", {}, el("span", { className: "minicpm-api-editor-title" }, "编辑人格"), el("span", { className: "minicpm-api-editor-hint" }, "保存后才会应用修改。")));
        const text = el("div", { className: "row-text" });
        const select = el("input", { type: "radio", name: "active-persona" });
        select.checked = profile.id === activeId;
        select.addEventListener("change", () => { activeId = profile.id; });
        const name = el("input", { type: "text", className: "minicpm-adapter-editor-input", maxlength: "48" });
        name.value = profile.name;
        const prompt = el("textarea", { className: "minicpm-adapter-editor-input", rows: "6", maxlength: "4000" });
        prompt.value = profile.prompt;
        name.addEventListener("input", () => { profile.name = name.value.trim() || "未命名人格"; });
        prompt.addEventListener("input", () => { profile.prompt = prompt.value; });
        const fields = el("div", { className: "minicpm-api-editor-fields" });
        fields.appendChild(el("label", { className: "minicpm-api-input-field" }, el("span", {}, "名称"), name));
        fields.appendChild(el("label", { className: "minicpm-api-input-field" }, el("span", {}, "人格提示词"), prompt));
        header.appendChild(el("label", { className: "minicpm-api-active-control" }, select, "设为当前人格"));
        row.appendChild(header); row.appendChild(fields);
        const controls = el("div", { className: "minicpm-api-editor-actions" });
        if (profiles.length > 1) {
          const remove = el("button", { type: "button", className: "soft-btn" }, "删除");
          remove.addEventListener("click", async () => {
            const index = profiles.indexOf(profile);
            profiles.splice(index, 1);
            if (activeId === profile.id) activeId = profiles[0].id;
            await save(); void render(parent, { profiles, activeId, selectedId: null });
          });
          controls.appendChild(remove);
        }
        if (controls.childElementCount) row.appendChild(controls);
        const selectedItem = Array.from(list.children).find((item) => item.dataset.profileId === profile.id);
        if (selectedItem) selectedItem.after(row);
      }
      rows.appendChild(el("div", { className: "minicpm-api-profile-list-row" }, list));
      const actions = el("div", { className: "row" }, el("div", { className: "row-text" }), el("div", { className: "row-control" }));
      const controls = actions.querySelector(".row-control");
      const add = el("button", { type: "button", className: "soft-btn" }, "新增人格");
      add.addEventListener("click", () => {
        const used = new Set(profiles.map((item) => item.id));
        const name = "新人格";
        profiles.push({ id: makeId(`${name}-${Date.now()}`, used), name, prompt: "请填写这个人格的提示词。" });
        void render(parent, { profiles, activeId, selectedId: profiles[profiles.length - 1].id });
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
