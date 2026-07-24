"use strict";

(function initSettingsTabLive2d(root) {
  function init(core) {
    const make = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    };

    const addCopy = (row, title, description) => {
      const copy = make("div", "row-text");
      copy.appendChild(make("span", "row-label", title));
      copy.appendChild(make("span", "row-desc", description));
      row.appendChild(copy);
      return copy;
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    function buildSlider(label, description, value, min, max, step, unit, onChange) {
      const row = make("div", "row live2d-setting-row");
      addCopy(row, label, description);
      const control = make("div", "row-control live2d-slider-control");
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = String(min);
      slider.max = String(max);
      slider.step = String(step);
      slider.value = String(value);
      const output = make("output", "live2d-slider-value");
      const format = (raw) => unit === "%" ? `${Math.round(Number(raw) * 100)}%` : `${Math.round(Number(raw))}${unit}`;
      output.textContent = format(slider.value);
      slider.addEventListener("input", () => {
        output.textContent = format(slider.value);
        onChange(clamp(Number(slider.value), min, max));
      });
      control.appendChild(slider);
      control.appendChild(output);
      row.appendChild(control);
      return row;
    }

    async function render(parent) {
      parent.innerHTML = "";
      const header = make("div", "page-header live2d-page-header");
      const headerCopy = make("div", "page-header-copy");
      headerCopy.appendChild(make("h1", "page-title", "Live2D 模型"));
      headerCopy.appendChild(make("p", "page-subtitle", "选择本地 Cubism 模型，并即时调整模型在桌宠窗口中的大小和位置。"));
      header.appendChild(headerCopy);
      parent.appendChild(header);

      if (!window.settingsAPI || typeof window.settingsAPI.getLive2dSettings !== "function") {
        parent.appendChild(make("div", "live2d-status-card error", "当前版本没有加载 Live2D 设置接口。"));
        return;
      }

      let payload;
      try {
        payload = await window.settingsAPI.getLive2dSettings();
      } catch (error) {
        parent.appendChild(make("div", "live2d-status-card error", `无法读取 Live2D 设置：${error && error.message || error}`));
        return;
      }

      let settings = { modelId: "", scale: 1, offsetX: 0, offsetY: 0, ...(payload && payload.settings || {}) };
      let runtime = payload && payload.runtime || { enabled: false, models: [] };
      let saveTimer = null;
      let saveVersion = 0;

      const apply = (patch, immediate = false) => {
        settings = { ...settings, ...patch };
        const version = ++saveVersion;
        if (saveTimer) clearTimeout(saveTimer);
        const commit = async () => {
          try {
            const result = await window.settingsAPI.setLive2dSettings(settings);
            if (!result || result.status !== "ok") throw new Error(result && result.message || "保存失败");
            if (version !== saveVersion) return;
            settings = { ...settings, ...(result.settings || {}) };
            runtime = result.runtime || runtime;
          } catch (error) {
            core.ops.showToast(`Live2D 设置保存失败：${error && error.message || error}`, { error: true });
          }
        };
        if (immediate) void commit();
        else saveTimer = setTimeout(commit, 80);
      };

      const status = make("div", `live2d-status-card ${runtime.enabled ? "ready" : "warning"}`);
      status.appendChild(make("span", "live2d-status-dot"));
      const statusCopy = make("div", "live2d-status-copy");
      statusCopy.appendChild(make("strong", "", runtime.enabled ? `正在使用：${runtime.modelName || "Live2D 模型"}` : "Live2D 尚未就绪"));
      statusCopy.appendChild(make("span", "", runtime.enabled ? "背景透明；点击、拖拽和 AI 情绪动作均已启用。" : (runtime.reason || "没有找到可用模型或 Cubism Core。")));
      status.appendChild(statusCopy);
      parent.appendChild(status);

      const modelSection = make("section", "section");
      modelSection.appendChild(make("div", "section-title", "模型选择"));
      const modelRows = make("div", "section-rows");
      const modelRow = make("div", "row");
      addCopy(modelRow, "当前模型", "自动扫描项目 live2d 文件夹及应用数据目录中的 .model3.json。");
      const modelControl = make("div", "row-control");
      const select = make("select", "live2d-model-select");
      const models = Array.isArray(runtime.models) ? runtime.models : [];
      if (!models.length) {
        const option = document.createElement("option");
        option.textContent = "未发现模型";
        option.disabled = true;
        option.selected = true;
        select.appendChild(option);
        select.disabled = true;
      } else {
        for (const item of models) {
          const option = document.createElement("option");
          option.value = item.id;
          option.textContent = item.name;
          option.selected = item.id === runtime.modelId || item.id === settings.modelId;
          select.appendChild(option);
        }
        select.addEventListener("change", () => {
          apply({ modelId: select.value }, true);
          core.ops.showToast("正在切换 Live2D 模型…", { error: false });
          setTimeout(() => { if (core.ops.isTabActive("live2d")) core.ops.requestRender({ content: true }); }, 500);
        });
      }
      modelControl.appendChild(select);
      modelRow.appendChild(modelControl);
      modelRows.appendChild(modelRow);
      modelSection.appendChild(modelRows);
      parent.appendChild(modelSection);

      const layoutSection = make("section", "section");
      layoutSection.appendChild(make("div", "section-title", "显示调整"));
      const layoutRows = make("div", "section-rows");
      layoutRows.appendChild(buildSlider("模型缩放", "只缩放 Live2D 立绘，不改变桌宠窗口大小。", settings.scale, 0.35, 2.5, 0.01, "%", (scale) => apply({ scale })));
      layoutRows.appendChild(buildSlider("水平位置", "向左或向右移动模型。", settings.offsetX, -300, 300, 1, " px", (offsetX) => apply({ offsetX })));
      layoutRows.appendChild(buildSlider("垂直位置", "向上或向下移动模型。", settings.offsetY, -300, 300, 1, " px", (offsetY) => apply({ offsetY })));
      const resetRow = make("div", "row");
      addCopy(resetRow, "恢复默认布局", "缩放恢复为 100%，位置恢复到窗口中心。");
      const resetControl = make("div", "row-control");
      const reset = make("button", "soft-btn", "恢复默认");
      reset.type = "button";
      reset.addEventListener("click", async () => {
        apply({ scale: 1, offsetX: 0, offsetY: 0 }, true);
        setTimeout(() => { if (core.ops.isTabActive("live2d")) core.ops.requestRender({ content: true }); }, 180);
      });
      resetControl.appendChild(reset);
      resetRow.appendChild(resetControl);
      layoutRows.appendChild(resetRow);
      layoutSection.appendChild(layoutRows);
      parent.appendChild(layoutSection);

      const motionSection = make("section", "section");
      motionSection.appendChild(make("div", "section-title", "当前模型动作"));
      const motionCard = make("div", "live2d-motion-card");
      const selectedModel = models.find((item) => item.id === runtime.modelId || item.id === settings.modelId);
      const motions = Array.isArray(runtime.motions) ? runtime.motions : (selectedModel && selectedModel.motions || []);
      if (!motions.length) {
        motionCard.appendChild(make("span", "row-desc", "模型没有声明动作组，仍可使用 Soullink 的呼吸、视线和参数情绪效果。"));
      } else {
        for (const motion of motions) {
          const chip = make("span", "live2d-motion-chip");
          chip.appendChild(make("strong", "", motion.group));
          chip.appendChild(make("small", "", `${motion.count} 个动作`));
          motionCard.appendChild(chip);
        }
      }
      const note = make("p", "live2d-motion-note", "交互映射：单击 → Tap；拖拽 → Flick / Flick@Body；AI 会按开心、害羞、惊讶、难过、专注或轻微不满选择相应动作。");
      motionSection.appendChild(motionCard);
      motionSection.appendChild(note);
      parent.appendChild(motionSection);
    }

    core.tabs.live2d = { render };
  }

  root.ClawdSettingsTabLive2d = { init };
})(globalThis);
