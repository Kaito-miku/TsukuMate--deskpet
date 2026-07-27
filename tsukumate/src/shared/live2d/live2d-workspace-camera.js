"use strict";

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function computeWorkspaceCamera(bounds, viewportHeight, settings = {}) {
  if (!bounds || !Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX)
    || !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxY)
    || bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) return null;
  const targetMinY = bounds.minY + (bounds.maxY - bounds.minY) * 0.18;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - targetMinY;
  const autoFit = Math.min(1.8 / width, 1.8 / height);
  const userScale = clamp(Number(settings.workspaceScale) || 1, 0.6, 1.8);
  const fit = clamp(autoFit * userScale, 0.1, 4);
  const centerX = (bounds.minX + bounds.maxX) * 0.5;
  const centerY = (targetMinY + bounds.maxY) * 0.5;
  const offsetY = clamp(Number(settings.workspaceOffsetY) || 0, -300, 300);
  return {
    fit,
    translateX: -centerX * fit,
    translateY: -centerY * fit - (offsetY / Math.max(1, viewportHeight)) * 2,
    targetFraction: 0.82,
  };
}

module.exports = { computeWorkspaceCamera };
