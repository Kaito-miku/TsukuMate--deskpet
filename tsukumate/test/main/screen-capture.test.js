"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { CAPTURE_SIZE, PREVIEW_SIZE, createScreenCaptureService } = require("../../src/main/chat/screen-capture");

function image(label, empty = false) {
  return {
    label,
    isEmpty: () => empty,
    resize(options) { return { ...image(`${label}:${options.width}x${options.height}`), options }; },
    toJPEG: () => Buffer.from(label),
  };
}

function source(id, name = "Display") {
  return { id, name, display_id: id, thumbnail: image(id) };
}

test("lists display previews and captures only the selected source", async () => {
  const calls = [];
  const service = createScreenCaptureService({
    desktopCapturer: { getSources: async (options) => { calls.push(options.thumbnailSize); return [source("screen:1:0", "Main")]; } },
    platform: "win32",
  });
  const listed = await service.list();
  assert.equal(listed.length, 1);
  assert.equal(listed[0].name, "Main");
  assert.match(listed[0].previewDataUrl, /^data:image\/jpeg;base64,/);

  const captured = await service.capture("screen:1:0");
  assert.match(captured.dataUrl, /^data:image\/jpeg;base64,/);
  assert.match(captured.previewDataUrl, /^data:image\/jpeg;base64,/);
  assert.deepEqual(calls, [PREVIEW_SIZE, CAPTURE_SIZE]);
});

test("rejects unavailable sources and missing capture results", async () => {
  const desktopCapturer = { getSources: async () => [source("screen:1:0")] };
  const service = createScreenCaptureService({ desktopCapturer, platform: "linux" });
  await assert.rejects(() => service.capture("screen:missing"), (error) => error.code === "SCREEN_CAPTURE_INVALID_SOURCE");

  const unavailable = createScreenCaptureService({
    desktopCapturer: { getSources: async () => [] },
    systemPreferences: { getMediaAccessStatus: () => "denied" },
    platform: "darwin",
  });
  await assert.rejects(() => unavailable.list(), (error) => error.code === "SCREEN_CAPTURE_UNAVAILABLE");
});
