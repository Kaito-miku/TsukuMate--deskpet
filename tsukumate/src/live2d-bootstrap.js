// Cubism Framework modules read Live2DCubismCore during module evaluation, so
// Core must be loaded before the bundled Framework script is evaluated.
(function bootstrapCubism5() {
  const config = window.themeConfig && window.themeConfig.live2d;
  const report = (stage, message) => {
    try { window.electronAPI.reportLive2dStatus({ stage, message }); } catch {}
  };
  if (!config || !config.enabled || !config.coreUrl) {
    report("cubism5-disabled", config && config.reason || "No model/core configured");
    return;
  }
  const loadFramework = () => {
    const framework = document.createElement("script");
    framework.src = "live2d-renderer.bundle.js";
    framework.onload = () => report("cubism5-framework", "loaded");
    framework.onerror = () => report("cubism5-error", "Failed to load bundled Cubism 5 Framework");
    document.head.appendChild(framework);
  };
  if (window.Live2DCubismCore) { loadFramework(); return; }
  const core = document.createElement("script");
  core.src = config.coreUrl;
  core.onload = () => window.Live2DCubismCore ? loadFramework() : report("cubism5-error", "Core loaded without Live2DCubismCore global");
  core.onerror = () => report("cubism5-error", "Failed to load Cubism 5 Core");
  document.head.appendChild(core);
})();
