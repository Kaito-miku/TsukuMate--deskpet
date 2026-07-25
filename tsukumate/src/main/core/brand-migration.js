"use strict";

const fs = require("fs");
const path = require("path");

const LEGACY_APP_DIRS = ["MiniCPM Desk Pet", "minicpm-desk-pet", "clawd-on-desk"];
const MIGRATABLE_ENTRIES = [
  "clawd-prefs.json",
  "minicpm-prefs.json",
  "minicpm-api-key.bin",
  "minicpm-onboarding.json",
  "minicpm-bubble-pos.json",
  "chat-history",
  "daily-diaries",
  "memory-notes",
  "themes",
  "live2d",
  "models",
  "adapters",
];

function copyIfMissing(source, destination) {
  if (!fs.existsSync(source) || fs.existsSync(destination)) return false;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, errorOnExist: false });
  return true;
}

function migrateLegacyUserData({ appDataDir, userDataDir, logger = () => {} }) {
  const marker = path.join(userDataDir, ".tsukumate-migration-v1.json");
  if (fs.existsSync(marker)) return { migrated: false, reason: "already-complete" };
  fs.mkdirSync(userDataDir, { recursive: true });
  const copied = [];
  for (const legacyName of LEGACY_APP_DIRS) {
    const legacyDir = path.join(appDataDir, legacyName);
    if (path.resolve(legacyDir) === path.resolve(userDataDir) || !fs.existsSync(legacyDir)) continue;
    for (const entry of MIGRATABLE_ENTRIES) {
      try {
        if (copyIfMissing(path.join(legacyDir, entry), path.join(userDataDir, entry))) {
          copied.push(`${legacyName}/${entry}`);
        }
      } catch (error) {
        logger(`TsukuMate migration skipped ${legacyName}/${entry}: ${error.message}`);
      }
    }
    try {
      for (const filename of fs.readdirSync(legacyDir)) {
        if (!/^minicpm-api-key-[a-zA-Z0-9_-]+\.bin$/.test(filename)) continue;
        if (copyIfMissing(path.join(legacyDir, filename), path.join(userDataDir, filename))) {
          copied.push(`${legacyName}/${filename}`);
        }
      }
    } catch {}
  }
  fs.writeFileSync(marker, JSON.stringify({ completedAt: new Date().toISOString(), copied }, null, 2));
  return { migrated: copied.length > 0, copied };
}

module.exports = { LEGACY_APP_DIRS, MIGRATABLE_ENTRIES, migrateLegacyUserData };
