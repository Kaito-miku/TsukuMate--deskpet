"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { parseAppleMusicCommand, runAppleMusicCommand, SEARCH_SCRIPT, FUZZY_SEARCH_SCRIPT } = require("../src/main/integrations/apple-music/apple-music-control");

test("parses the supported Apple Music command allowlist", () => {
  assert.deepStrictEqual(parseAppleMusicCommand("播放音乐"), { action: "play" });
  assert.deepStrictEqual(parseAppleMusicCommand("暂停音乐"), { action: "pause" });
  assert.deepStrictEqual(parseAppleMusicCommand("下一首"), { action: "next" });
  assert.deepStrictEqual(parseAppleMusicCommand("音量调到 40%"), { action: "volume", value: 40 });
  assert.deepStrictEqual(parseAppleMusicCommand("播放 夜曲"), { action: "search", query: "夜曲" });
  assert.strictEqual(parseAppleMusicCommand("帮我删除文件"), null);
});

test("rejects out-of-range volume before invoking osascript", async () => {
  let called = false;
  const result = await runAppleMusicCommand({ text: "音量调到 101%" }, {
    platform: "darwin",
    execFileAsync: async () => { called = true; },
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(called, false);
});

test("passes a song query as an osascript argument, not source code", async () => {
  let call;
  const result = await runAppleMusicCommand({ text: '播放 x" & do shell script "whoami"' }, {
    platform: "darwin",
    execFileAsync: async (...args) => { call = args; return { stdout: "正在播放：安全歌曲" }; },
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(call[0], "osascript");
  assert.strictEqual(call[1][1], SEARCH_SCRIPT);
    assert.strictEqual(call[1][2], 'x" & do shell script "whoami"');
    assert.strictEqual(call[1][3], "");
  assert.ok(!SEARCH_SCRIPT.includes("do shell script"));
});

test("passes the configured playlist separately from the song query", async () => {
  let call;
  const result = await runAppleMusicCommand({ text: "播放 夜曲" }, {
    platform: "darwin",
    playlistName: "夜晚歌单",
    execFileAsync: async (...args) => { call = args; return { stdout: "正在播放：夜曲" }; },
  });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(call[1].slice(2), ["夜曲", "夜晚歌单"]);
});

test("keeps fuzzy matching as a fallback after Apple Music's native search", async () => {
  const calls = [];
  const result = await runAppleMusicCommand({ text: "播放 Hikaru" }, {
    platform: "darwin",
    execFileAsync: async (...args) => {
      calls.push(args);
      return { stdout: calls.length === 1 ? "__NOT_FOUND__" : "正在播放：First Love - 宇多田ヒカル" };
    },
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(calls.length, 2);
  assert.deepStrictEqual(calls[1][1].slice(0, 4), ["-l", "JavaScript", "-e", FUZZY_SEARCH_SCRIPT]);
  assert.match(FUZZY_SEARCH_SCRIPT, /NSStringTransformToLatin/);
  assert.match(SEARCH_SCRIPT, /search sourcePlaylist for queryText/);
});
