"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { computeQuickLauncherBounds } = require("../src/quick-launcher");

test("quick launcher prefers the right side of the pet", () => {
  const bounds = computeQuickLauncherBounds(
    { x: 100, y: 200, width: 180, height: 200 },
    { x: 0, y: 0, width: 1200, height: 900 },
    { width: 284, height: 284 }
  );
  assert.deepStrictEqual(bounds, { x: 294, y: 158, width: 284, height: 284 });
});

test("quick launcher falls back to the left near the right screen edge", () => {
  const bounds = computeQuickLauncherBounds(
    { x: 960, y: 200, width: 180, height: 200 },
    { x: 0, y: 0, width: 1200, height: 900 },
    { width: 284, height: 284 }
  );
  assert.strictEqual(bounds.x, 662);
  assert.strictEqual(bounds.y, 158);
});

test("quick launcher clamps to small and offset work areas", () => {
  const bounds = computeQuickLauncherBounds(
    { x: -900, y: 740, width: 100, height: 100 },
    { x: -1000, y: 100, width: 500, height: 700 },
    { width: 284, height: 284 }
  );
  assert.ok(bounds.x >= -1000);
  assert.ok(bounds.y >= 100);
  assert.ok(bounds.x + bounds.width <= -500);
  assert.ok(bounds.y + bounds.height <= 800);
});
