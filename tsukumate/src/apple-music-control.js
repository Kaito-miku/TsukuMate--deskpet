"use strict";

const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function parseAppleMusicCommand(input) {
  const text = String(input || "").trim().replace(/[。！？!？]+$/g, "");
  const prefix = /^(?:请|帮我|麻烦)?(?:打开)?(?:Apple\s*Music|音乐)?(?:里|中)?/i;
  const bare = text.replace(prefix, "").trim();
  if (/^(?:暂停|停止)(?:播放|音乐)?$/i.test(bare)) return { action: "pause" };
  if (/^(?:继续|恢复|开始)?播放(?:音乐)?$/i.test(bare)) return { action: "play" };
  if (/^(?:下一首|下一曲|切歌)$/i.test(bare)) return { action: "next" };
  if (/^(?:上一首|上一曲)$/i.test(bare)) return { action: "previous" };
  if (/^(?:现在|当前)(?:在)?(?:播放)?(?:什么歌|什么歌曲|什么音乐|歌曲|音乐)?$/i.test(bare)) return { action: "status" };

  const volume = bare.match(/^(?:把)?(?:音乐)?音量(?:调到|设为|设置为)?\s*(\d{1,3})\s*(?:%|％)?$/i);
  if (volume) {
    const value = Number(volume[1]);
    if (Number.isInteger(value) && value >= 0 && value <= 100) return { action: "volume", value };
    return { error: "音量请设置在 0 到 100 之间。" };
  }

  const song = bare.match(/^播放\s+(.+)$/i);
  if (song) {
    const query = song[1].trim().replace(/[。！？!？]+$/g, "");
    if (query && !/^(?:音乐|歌曲|歌)$/i.test(query) && query.length <= 160) {
      return { action: "search", query };
    }
  }
  return null;
}

const SCRIPTS = Object.freeze({
  play: 'tell application "Music" to activate\ntell application "Music" to play\nreturn "正在播放 Apple Music。"',
  pause: 'tell application "Music" to pause\nreturn "已暂停 Apple Music。"',
  next: 'tell application "Music" to next track\nreturn "已切到下一首。"',
  previous: 'tell application "Music" to previous track\nreturn "已切回上一首。"',
  status: 'tell application "Music"\nif player state is playing then\nreturn "正在播放：" & name of current track & " - " & artist of current track\nend if\nreturn "Apple Music 当前没有播放音乐。"\nend tell',
});

const SEARCH_SCRIPT = [
  "on run argv",
  "set queryText to item 1 of argv",
  "set playlistName to item 2 of argv",
  'tell application "Music"',
  "activate",
  "if playlistName is \"\" then",
  "set sourcePlaylist to library playlist 1",
  "else",
  "if not (exists user playlist playlistName) then return \"__PLAYLIST_NOT_FOUND__\"",
  "set sourcePlaylist to user playlist playlistName",
  "end if",
  "set foundTracks to search sourcePlaylist for queryText",
  "if (count of foundTracks) is 0 then return \"__NOT_FOUND__\"",
  "set selectedTrack to item 1 of foundTracks",
  "play selectedTrack",
  'return "正在播放：" & name of selectedTrack & " - " & artist of selectedTrack',
  "end tell",
  "end run",
].join("\n");

// Apple Music's own `search` is fast and covers the metadata it indexes. This
// fallback is only used after that search misses: it compares compacted names,
// artists and albums, including Foundation's Latin transliteration for CJK.
const FUZZY_SEARCH_SCRIPT = [
  'ObjC.import("Foundation");',
  "function compact(value) {",
  "  var source = $.NSString.stringWithString(String(value || ''));",
  "  var latin = source.stringByApplyingTransformReverse($.NSStringTransformToLatin, false);",
  "  var folded = latin.stringByFoldingWithOptionsLocale($.NSDiacriticInsensitiveSearch, $.NSLocale.currentLocale);",
  "  return ObjC.unwrap(folded).toLowerCase().replace(/[\\s\\-_'\\\".,，。！？!（）()【】\\[\\]]/g, '');",
  "}",
  "function subsequence(needle, haystack) {",
  "  var at = 0; for (var i = 0; i < needle.length; i += 1) { at = haystack.indexOf(needle[i], at); if (at < 0) return false; at += 1; } return true;",
  "}",
  "function score(query, value) {",
  "  if (!value) return 0; if (value.indexOf(query) >= 0) return 1000 - value.length;",
  "  return query.length >= 3 && subsequence(query, value) ? 100 - value.length : 0;",
  "}",
  "function run(argv) {",
  "  var query = compact(argv[0]); var playlistName = String(argv[1] || ''); if (!query) return '__NOT_FOUND__';",
  "  var music = Application('Music');",
  "  var playlist = playlistName ? music.userPlaylists.byName(playlistName) : music.libraryPlaylists[0];",
  "  var tracks; try { tracks = playlist.tracks(); } catch (err) { return playlistName ? '__PLAYLIST_NOT_FOUND__' : '__NOT_FOUND__'; }",
  "  var best = null; var bestScore = 0; var limit = Math.min(tracks.length, 5000);",
  "  for (var i = 0; i < limit; i += 1) {",
  "    var track = tracks[i]; var name = ''; var artist = ''; var album = '';",
  "    try { name = track.name(); artist = track.artist(); album = track.album(); } catch (err) { continue; }",
  "    var candidateScore = Math.max(score(query, compact(name)), score(query, compact(artist)), score(query, compact(album)), score(query, compact(String(name) + ' ' + String(artist))));",
  "    if (candidateScore > bestScore) { best = track; bestScore = candidateScore; }",
  "  }",
  "  if (!best) return '__NOT_FOUND__'; music.play(best); return '正在播放：' + best.name() + ' - ' + best.artist();",
  "}",
].join("\n");

async function runAppleMusicCommand(command, options = {}) {
  if ((options.platform || process.platform) !== "darwin") {
    return { ok: false, text: "Apple Music 控制仅支持 macOS。" };
  }
  const parsed = command && command.action ? command : parseAppleMusicCommand(command && command.text);
  if (!parsed) return { ok: false, text: "我没理解这条 Apple Music 指令。" };
  if (parsed.error) return { ok: false, text: parsed.error };

  const run = options.execFileAsync || execFileAsync;
  try {
    let result;
    if (parsed.action === "volume") {
      result = await run("osascript", ["-e", `tell application "Music" to set sound volume to ${parsed.value}`]);
      return { ok: true, text: `已将音乐音量设为 ${parsed.value}%。` };
    }
    if (parsed.action === "search") {
      const playlistName = typeof options.playlistName === "string" ? options.playlistName.trim() : "";
      result = await run("osascript", ["-e", SEARCH_SCRIPT, parsed.query, playlistName]);
      const output = String(result && result.stdout || "").trim();
      if (output === "__PLAYLIST_NOT_FOUND__") {
        return { ok: false, text: `找不到播放列表“${playlistName}”。请在设置中检查默认找歌位置。` };
      }
      if (output !== "__NOT_FOUND__") return { ok: true, text: output || "已开始播放。" };

      const fuzzy = await run("osascript", ["-l", "JavaScript", "-e", FUZZY_SEARCH_SCRIPT, parsed.query, playlistName]);
      const fuzzyOutput = String(fuzzy && fuzzy.stdout || "").trim();
      if (fuzzyOutput === "__PLAYLIST_NOT_FOUND__") {
        return { ok: false, text: `找不到播放列表“${playlistName}”。请在设置中检查默认找歌位置。` };
      }
      return fuzzyOutput && fuzzyOutput !== "__NOT_FOUND__"
        ? { ok: true, text: fuzzyOutput }
        : { ok: false, text: `没有找到“${parsed.query}”。可以尝试歌名、歌手名、拼音或罗马音。` };
    }
    const script = SCRIPTS[parsed.action];
    if (!script) return { ok: false, text: "不支持的 Apple Music 操作。" };
    result = await run("osascript", ["-e", script]);
    return { ok: true, text: String(result && result.stdout || "").trim() || "操作完成。" };
  } catch (err) {
    const message = String(err && (err.stderr || err.message) || "");
    if (/not authorized|not permitted|授权|允许/i.test(message)) {
      return { ok: false, text: "请在 macOS 弹窗中允许桌宠控制“音乐”，或到系统设置中开启自动化权限。" };
    }
    return { ok: false, text: "无法控制 Apple Music。请确认“音乐”应用可以正常打开。" };
  }
}

module.exports = { parseAppleMusicCommand, runAppleMusicCommand, SEARCH_SCRIPT, FUZZY_SEARCH_SCRIPT };
