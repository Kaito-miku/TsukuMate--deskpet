"use strict";

// One-shot screen capture for the chat bubble. The caller owns the returned
// image data and is responsible for releasing it after the request finishes.
const PREVIEW_SIZE = { width: 360, height: 240 };
const CAPTURE_SIZE = { width: 1600, height: 1200 };

function makeScreenCaptureError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function imageToJpegDataUrl(image) {
  if (!image || (typeof image.isEmpty === "function" && image.isEmpty())) {
    throw makeScreenCaptureError("SCREEN_CAPTURE_UNAVAILABLE", "Screen capture returned an empty image");
  }
  if (typeof image.toJPEG === "function") {
    return `data:image/jpeg;base64,${image.toJPEG(82).toString("base64")}`;
  }
  return image.toDataURL();
}

function resizeImage(image, size) {
  return image && typeof image.resize === "function"
    ? image.resize({ ...size, quality: "good" })
    : image;
}

function createScreenCaptureService({ desktopCapturer, systemPreferences, platform = process.platform }) {
  if (!desktopCapturer || typeof desktopCapturer.getSources !== "function") {
    throw new TypeError("desktopCapturer is required");
  }

  function checkPermission() {
    // On macOS, Electron's `getMediaAccessStatus("screen")` can disagree
    // with the TCC toggle for a development Electron bundle. Let
    // desktopCapturer make the authoritative capture attempt instead.
    // An unauthorized capture produces an empty image and is rejected below.
    void systemPreferences;
    void platform;
  }

  async function getSources(size) {
    checkPermission();
    let sources;
    try {
      sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: size, fetchWindowIcons: false });
    } catch (error) {
      throw makeScreenCaptureError("SCREEN_CAPTURE_UNAVAILABLE", error && error.message || "Could not capture the screen");
    }
    if (!Array.isArray(sources) || sources.length === 0) {
      throw makeScreenCaptureError("SCREEN_CAPTURE_UNAVAILABLE", "No displays are available for capture");
    }
    return sources;
  }

  return {
    async list() {
      const sources = await getSources(PREVIEW_SIZE);
      return sources
        .filter((source) => source && source.thumbnail && !(typeof source.thumbnail.isEmpty === "function" && source.thumbnail.isEmpty()))
        .map((source) => ({
          id: String(source.id),
          name: String(source.name || "Display"),
          displayId: source.display_id == null ? "" : String(source.display_id),
          previewDataUrl: imageToJpegDataUrl(source.thumbnail),
        }));
    },

    async capture(sourceId) {
      const requestedId = String(sourceId || "");
      if (!requestedId) throw makeScreenCaptureError("SCREEN_CAPTURE_INVALID_SOURCE", "Choose a display first");
      const sources = await getSources(CAPTURE_SIZE);
      const source = sources.find((item) => String(item.id) === requestedId);
      if (!source || !source.thumbnail) {
        throw makeScreenCaptureError("SCREEN_CAPTURE_INVALID_SOURCE", "The selected display is no longer available");
      }
      const capture = resizeImage(source.thumbnail, CAPTURE_SIZE);
      const preview = resizeImage(capture, PREVIEW_SIZE);
      return {
        dataUrl: imageToJpegDataUrl(capture),
        previewDataUrl: imageToJpegDataUrl(preview),
      };
    },
  };
}

module.exports = { PREVIEW_SIZE, CAPTURE_SIZE, createScreenCaptureService, makeScreenCaptureError };
