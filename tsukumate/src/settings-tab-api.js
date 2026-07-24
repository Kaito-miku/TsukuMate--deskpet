"use strict";

(function initSettingsTabApi(root) {
  function init(core) {
    const t = (key) => core.helpers.t(key);
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

    function createProfileId(profiles) {
      let id = `api-${Date.now()}`;
      let suffix = 2;
      const ids = new Set(profiles.map((profile) => profile.id));
      while (ids.has(id)) id = `api-${Date.now()}-${suffix++}`;
      return id;
    }

    async function render(parent, draft) {
      parent.innerHTML = "";
      let config = await window.minicpmSettings.getInferenceConfig();
      const profiles = draft && Array.isArray(draft.profiles)
        ? draft.profiles
        : (Array.isArray(config.api_profiles) ? config.api_profiles.map((profile) => ({ ...profile })) : []);
      let activeId = draft && draft.activeId ? draft.activeId : config.active_api_profile_id;
      let selectedId = draft && Object.prototype.hasOwnProperty.call(draft, "selectedId")
        ? draft.selectedId
        : null;
      if (selectedId && !profiles.some((profile) => profile.id === selectedId)) selectedId = null;

      parent.appendChild(el("div", { className: "page-header" },
        el("div", { className: "page-header-copy" },
          el("h1", { className: "page-title" }, "API 配置"),
          el("p", { className: "page-subtitle" }, "可保存多个 OpenAI 兼容 API，但一次只使用一个活动配置。")
        )
      ));

      const section = el("section", { className: "section" });
      const rows = el("div", { className: "section-rows" });
      section.appendChild(rows);

      const save = async () => {
        const result = await window.minicpmSettings.saveApiProfiles({ profiles, activeId });
        if (!result || !result.ok) {
          core.ops.showToast(`保存 API 配置失败：${(result && result.error) || ""}`, { error: true });
          return false;
        }
        core.ops.showToast("API 配置已保存并启用。", { error: false });
        return true;
      };

      const profileList = el("div", { className: "minicpm-api-profile-list" });
      for (const profile of profiles) {
        const item = el("button", {
          type: "button",
          className: profile.id === selectedId ? "minicpm-api-profile-item active" : "minicpm-api-profile-item",
        });
        item.dataset.profileId = profile.id;
        item.appendChild(el("span", { className: "minicpm-api-profile-name" }, profile.name || "未命名 API"));
        item.appendChild(el("span", { className: "minicpm-api-profile-model" }, profile.model || "未配置模型"));
        if (profile.id === activeId) item.appendChild(el("span", { className: "minicpm-api-profile-active" }, "使用中"));
        item.addEventListener("click", () => {
          void render(parent, { profiles, activeId, selectedId: selectedId === profile.id ? null : profile.id });
        });
        profileList.appendChild(item);
      }

      const profile = profiles.find((item) => item.id === selectedId);
      if (profile) {
        const row = el("div", { className: "minicpm-api-editor" });
        const header = el("div", { className: "minicpm-api-editor-header" },
          el("div", {}, el("span", { className: "minicpm-api-editor-title" }, "编辑 API 档案"), el("span", { className: "minicpm-api-editor-hint" }, "保存后才会应用修改。"))
        );
        const radio = el("input", { type: "radio", name: "active-api-profile" });
        radio.checked = profile.id === activeId;
        radio.addEventListener("change", () => { activeId = profile.id; });
        header.appendChild(el("label", { className: "minicpm-api-active-control" }, radio, "设为活动 API"));
        row.appendChild(header);
        const text = el("div", { className: "minicpm-api-editor-fields" });
        const fields = [
          ["name", "名称", "text", "例如：OpenAI"],
          ["endpoint", "完整 Chat Completions 地址", "url", "https://api.example.com/v1/chat/completions"],
          ["model", "模型名", "text", "gpt-4o-mini"],
        ];
        for (const [key, label, type, placeholder] of fields) {
          const input = el("input", { type, className: "minicpm-adapter-editor-input", placeholder });
          input.value = profile[key] || "";
          input.addEventListener("input", () => { profile[key] = input.value; });
          text.appendChild(el("label", { className: "minicpm-api-input-field" }, el("span", {}, label), input));
        }
        const key = el("input", { type: "password", className: "minicpm-adapter-editor-input", placeholder: profile.keyConfigured ? "Key 已保存，留空保持原 Key" : "API Key" });
        key.addEventListener("input", () => { profile.api_key = key.value; });
        text.appendChild(el("label", { className: "minicpm-api-input-field" }, el("span", {}, "API Key"), key));
        row.appendChild(text);
        const controls = el("div", { className: "minicpm-api-editor-actions" });
        if (profiles.length > 1) {
          const remove = el("button", { type: "button", className: "soft-btn" }, "删除");
          remove.addEventListener("click", () => {
            profiles.splice(profiles.indexOf(profile), 1);
            if (activeId === profile.id) activeId = profiles[0].id;
            void render(parent, { profiles, activeId, selectedId: null });
          });
          controls.appendChild(remove);
        }
        if (controls.childElementCount) row.appendChild(controls);
        const selectedItem = Array.from(profileList.children).find((item) => item.dataset.profileId === profile.id);
        if (selectedItem) selectedItem.after(row);
      }
      rows.appendChild(el("div", { className: "minicpm-api-profile-list-row" }, profileList));

      const actions = el("div", { className: "row" }, el("div", { className: "row-text" }), el("div", { className: "row-control" }));
      const controls = actions.querySelector(".row-control");
      const add = el("button", { type: "button", className: "soft-btn" }, "新增 API");
      add.addEventListener("click", () => {
        profiles.push({ id: createProfileId(profiles), name: "新 API", endpoint: "", model: "", keyConfigured: false });
        activeId = profiles[profiles.length - 1].id;
        void render(parent, { profiles, activeId, selectedId: profiles[profiles.length - 1].id });
      });
      const saveButton = el("button", { type: "button", className: "soft-btn accent" }, "保存并启用");
      saveButton.addEventListener("click", () => { void save(); });
      controls.appendChild(add);
      controls.appendChild(saveButton);
      rows.appendChild(actions);
      parent.appendChild(section);

      const memorySection = el("section", { className: "section" });
      const memoryRows = el("div", { className: "section-rows" });
      memorySection.appendChild(el("div", { className: "section-title" }, "聊天与记忆"));
      memorySection.appendChild(memoryRows);

      const diaryEnabled = el("input", { type: "checkbox" });
      diaryEnabled.checked = config.diary_enabled !== false;
      const diaryTime = el("input", { type: "time", className: "minicpm-adapter-editor-input" });
      diaryTime.value = config.diary_time || "22:00";
      const moodDuration = el("select", { className: "minicpm-adapter-editor-input" });
      for (const minutes of [5, 15, 30, 60]) {
        const option = el("option", { value: String(minutes) }, t("minicpmMoodDurationOption").replace("{minutes}", String(minutes)));
        option.selected = Number(config.mood_duration_minutes || 15) === minutes;
        moodDuration.appendChild(option);
      }
      const saveDiary = el("button", { type: "button", className: "soft-btn accent" }, "保存日记时间");
      saveDiary.addEventListener("click", async () => {
        const latestConfig = await window.minicpmSettings.getInferenceConfig();
        const result = await window.minicpmSettings.setInferenceConfig({
          inference_mode: "api",
          api_endpoint: latestConfig.api_endpoint,
          api_model: latestConfig.api_model,
          diary_enabled: diaryEnabled.checked,
          diary_time: diaryTime.value,
          mood_duration_minutes: Number(moodDuration.value),
        });
        if (!result || !result.ok) {
          core.ops.showToast(`保存日记设置失败：${(result && result.error) || ""}`, { error: true });
          return;
        }
        config = result.config || config;
        core.ops.showToast("日记设置已保存。", { error: false });
      });
      const diaryScheduleControl = el("div", { className: "row-control minicpm-api-diary-schedule" }, diaryEnabled, diaryTime, saveDiary);
      memoryRows.appendChild(el("div", { className: "row" },
        el("div", { className: "row-text" }, el("span", { className: "row-label" }, "每天生成日记"), el("span", { className: "row-desc" }, "在设定时间根据当天对话生成日记；电脑关闭期间会在下次启动后补写。")),
        diaryScheduleControl
      ));
      const saveMood = el("button", { type: "button", className: "soft-btn accent" }, t("minicpmMoodSave"));
      saveMood.addEventListener("click", async () => {
        const latestConfig = await window.minicpmSettings.getInferenceConfig();
        const result = await window.minicpmSettings.setInferenceConfig({
          inference_mode: "api",
          api_endpoint: latestConfig.api_endpoint,
          api_model: latestConfig.api_model,
          diary_enabled: diaryEnabled.checked,
          diary_time: diaryTime.value,
          mood_duration_minutes: Number(moodDuration.value),
        });
        if (!result || !result.ok) {
          core.ops.showToast(`${t("minicpmMoodSaveFailed")} ${(result && result.error) || ""}`, { error: true });
          return;
        }
        config = result.config || config;
        core.ops.showToast(t("minicpmMoodSaved"), { error: false });
      });
      memoryRows.appendChild(el("div", { className: "row" },
        el("div", { className: "row-text" }, el("span", { className: "row-label" }, t("minicpmMoodDuration")), el("span", { className: "row-desc" }, t("minicpmMoodDurationDesc"))),
        el("div", { className: "row-control minicpm-api-diary-schedule" }, moodDuration, saveMood)
      ));

      const addOpenRow = (label, description, actionLabel, action) => {
        const button = el("button", { type: "button", className: "soft-btn" }, actionLabel);
        button.addEventListener("click", () => { void action(); });
        memoryRows.appendChild(el("div", { className: "row" },
          el("div", { className: "row-text" }, el("span", { className: "row-label" }, label), el("span", { className: "row-desc" }, description)),
          el("div", { className: "row-control" }, button)
        ));
      };
      addOpenRow("聊天记录", "按日期保存的本地对话记录。", "打开文件夹", async () => {
        const result = await window.minicpmSettings.openChatHistoryDir();
        if (!result || !result.ok) core.ops.showToast(`无法打开聊天记录：${(result && result.error) || ""}`, { error: true });
      });
      addOpenRow("日记本", "AI 根据当天对话整理的 Markdown 日记。", "查看日记本", async () => {
        const result = await window.minicpmSettings.openDiaryDir();
        if (!result || !result.ok) core.ops.showToast(`无法打开日记本：${(result && result.error) || ""}`, { error: true });
      });
      parent.appendChild(memorySection);
    }

    core.tabs.api = { render: (parent) => { void render(parent); } };
  }
  root.ClawdSettingsTabApi = { init };
})(globalThis);
