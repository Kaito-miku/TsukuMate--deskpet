"use strict";

(function initSettingsTabMemory(root) {
  function init(core) {
    const t = (key) => core.helpers.t(key);
    const make = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    };
    const addRow = (rows, label, description, control) => {
      const row = make("div", "row");
      const copy = make("div", "row-text");
      copy.appendChild(make("span", "row-label", label));
      copy.appendChild(make("span", "row-desc", description));
      row.appendChild(copy);
      row.appendChild(control);
      rows.appendChild(row);
    };

    async function render(parent) {
      parent.innerHTML = "";
      let config = await window.minicpmSettings.getInferenceConfig();
      const header = make("div", "page-header");
      const headerCopy = make("div", "page-header-copy");
      headerCopy.appendChild(make("h1", "page-title", "聊天与记忆"));
      headerCopy.appendChild(make("p", "page-subtitle", "管理日记时间、持续心情以及本地聊天记录。"));
      header.appendChild(headerCopy);
      parent.appendChild(header);

      const section = make("section", "section");
      const rows = make("div", "section-rows");
      section.appendChild(rows);

      const diaryEnabled = document.createElement("input");
      diaryEnabled.type = "checkbox";
      diaryEnabled.checked = config.diary_enabled !== false;
      const diaryTime = make("input", "minicpm-adapter-editor-input");
      diaryTime.type = "time";
      diaryTime.value = config.diary_time || "22:00";
      const saveDiary = make("button", "soft-btn accent", "保存日记时间");
      saveDiary.type = "button";
      const diaryControl = make("div", "row-control minicpm-api-diary-schedule");
      diaryControl.append(diaryEnabled, diaryTime, saveDiary);
      addRow(rows, "每天生成日记", "在设定时间根据当天对话生成日记；电脑关闭期间会在下次启动后补写。", diaryControl);

      const moodDuration = make("select", "minicpm-adapter-editor-input");
      for (const minutes of [5, 15, 30, 60]) {
        const option = make("option", "", t("minicpmMoodDurationOption").replace("{minutes}", String(minutes)));
        option.value = String(minutes);
        option.selected = Number(config.mood_duration_minutes || 15) === minutes;
        moodDuration.appendChild(option);
      }
      const saveMood = make("button", "soft-btn accent", t("minicpmMoodSave"));
      saveMood.type = "button";
      const moodControl = make("div", "row-control minicpm-api-diary-schedule");
      moodControl.append(moodDuration, saveMood);
      addRow(rows, t("minicpmMoodDuration"), t("minicpmMoodDurationDesc"), moodControl);

      const save = async (kind) => {
        const latest = await window.minicpmSettings.getInferenceConfig();
        const result = await window.minicpmSettings.setInferenceConfig({
          inference_mode: "api",
          api_endpoint: latest.api_endpoint,
          api_model: latest.api_model,
          diary_enabled: diaryEnabled.checked,
          diary_time: diaryTime.value,
          mood_duration_minutes: Number(moodDuration.value),
        });
        if (!result || !result.ok) {
          core.ops.showToast(`${kind === "diary" ? "保存日记设置失败：" : t("minicpmMoodSaveFailed")} ${(result && result.error) || ""}`, { error: true });
          return;
        }
        config = result.config || config;
        core.ops.showToast(kind === "diary" ? "日记设置已保存。" : t("minicpmMoodSaved"), { error: false });
      };
      saveDiary.addEventListener("click", () => { void save("diary"); });
      saveMood.addEventListener("click", () => { void save("mood"); });

      const folderButton = (label, action) => {
        const button = make("button", "soft-btn", label);
        button.type = "button";
        button.addEventListener("click", () => { void action(); });
        const control = make("div", "row-control");
        control.appendChild(button);
        return control;
      };
      addRow(rows, "聊天记录", "按日期保存的本地对话记录。", folderButton("打开文件夹", async () => {
        const result = await window.minicpmSettings.openChatHistoryDir();
        if (!result || !result.ok) core.ops.showToast(`无法打开聊天记录：${(result && result.error) || ""}`, { error: true });
      }));
      addRow(rows, "日记本", "AI 根据当天对话整理的 Markdown 日记。", folderButton("查看日记本", async () => {
        const result = await window.minicpmSettings.openDiaryDir();
        if (!result || !result.ok) core.ops.showToast(`无法打开日记本：${(result && result.error) || ""}`, { error: true });
      }));
      parent.appendChild(section);
    }

    core.tabs.memory = { render: (parent) => { void render(parent); } };
  }
  root.ClawdSettingsTabMemory = { init };
})(globalThis);
