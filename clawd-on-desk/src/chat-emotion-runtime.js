"use strict";

const { normalizeEmotionBlend } = require("./chat-emotion-classifier");

const REACTION_DURATION_MS = 6000;
const DEFAULT_MOOD_DURATION_MINUTES = 15;
const ALLOWED_MOOD_DURATIONS = new Set([5, 15, 30, 60]);
const MOOD_ACTIONS = new Set(["preserve", "establish", "reinforce", "ease", "resolve", "replace"]);
const LASTING_EMOTIONS = new Set(["happy", "shy", "surprised", "sleepy", "sad", "annoyed"]);

const VAD = {
  calm: { valence: 0, arousal: -0.15, dominance: 0 },
  focused: { valence: 0.1, arousal: 0.35, dominance: 0.25 },
  happy: { valence: 0.8, arousal: 0.55, dominance: 0.35 },
  shy: { valence: 0.35, arousal: 0.25, dominance: -0.35 },
  surprised: { valence: 0.1, arousal: 0.9, dominance: -0.1 },
  sleepy: { valence: -0.05, arousal: -0.75, dominance: -0.25 },
  sad: { valence: -0.7, arousal: -0.35, dominance: -0.45 },
  annoyed: { valence: -0.55, arousal: 0.55, dominance: 0.45 },
};

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function normalizeMoodDurationMinutes(value) {
  const minutes = Number(value);
  return ALLOWED_MOOD_DURATIONS.has(minutes) ? minutes : DEFAULT_MOOD_DURATION_MINUTES;
}

function normalizeMoodAction(value) {
  const action = String(value || "").trim().toLowerCase();
  return MOOD_ACTIONS.has(action) ? action : "preserve";
}

function calmMood() {
  const blend = normalizeEmotionBlend("calm", "fallback");
  return { blend, vad: { ...VAD.calm }, updatedAt: null, startedAt: null, expiresAt: null, action: "resolve" };
}

function blendToVad(value) {
  const blend = normalizeEmotionBlend(value, value && value.source || "fallback");
  const primary = VAD[blend.primary] || VAD.calm;
  if (!blend.secondary) return { ...primary };
  const secondary = VAD[blend.secondary] || VAD.calm;
  return {
    valence: primary.valence * blend.primaryWeight + secondary.valence * blend.secondaryWeight,
    arousal: primary.arousal * blend.primaryWeight + secondary.arousal * blend.secondaryWeight,
    dominance: primary.dominance * blend.primaryWeight + secondary.dominance * blend.secondaryWeight,
  };
}

function cloneMood(mood) {
  return {
    blend: normalizeEmotionBlend(mood && mood.blend || "calm", mood && mood.blend && mood.blend.source || "fallback"),
    vad: { ...(mood && mood.vad || VAD.calm) },
    updatedAt: Number.isFinite(mood && mood.updatedAt) ? mood.updatedAt : null,
    startedAt: Number.isFinite(mood && mood.startedAt) ? mood.startedAt : null,
    expiresAt: Number.isFinite(mood && mood.expiresAt) ? mood.expiresAt : null,
    action: normalizeMoodAction(mood && mood.action),
  };
}

function isCalmMood(mood) {
  return !mood || !mood.blend || mood.blend.primary === "calm" || !Number.isFinite(mood.expiresAt);
}

function activeMoodAt(mood, at) {
  if (isCalmMood(mood) || (Number.isFinite(at) && mood.expiresAt <= at)) return calmMood();
  return cloneMood(mood);
}

function makeMood(blendValue, at, durationMinutes, action) {
  const blend = normalizeEmotionBlend(blendValue, blendValue && blendValue.source || "fallback");
  if (!LASTING_EMOTIONS.has(blend.primary)) return calmMood();
  return {
    blend,
    vad: blendToVad(blend),
    updatedAt: at,
    startedAt: at,
    expiresAt: at + durationMinutes * 60 * 1000,
    action,
  };
}

function reinforceMood(current, blendValue, at, durationMinutes) {
  const next = normalizeEmotionBlend(blendValue, blendValue && blendValue.source || "fallback");
  if (isCalmMood(current)) return makeMood(next, at, durationMinutes, "reinforce");
  if (next.primary !== current.blend.primary) return { ...cloneMood(current), action: "preserve" };
  const secondary = next.secondary || current.blend.secondary;
  const blend = normalizeEmotionBlend({
    primary: current.blend.primary,
    secondary,
    primaryWeight: secondary ? (current.blend.primaryWeight + next.primaryWeight) / 2 : 1,
    secondaryWeight: secondary ? (current.blend.secondaryWeight + next.secondaryWeight) / 2 : 0,
    intensity: clamp(Math.max(current.blend.intensity, next.intensity) + 0.12, 0.2, 1),
    source: next.source,
  }, next.source);
  return {
    blend,
    vad: blendToVad(blend),
    updatedAt: at,
    startedAt: at,
    expiresAt: at + durationMinutes * 60 * 1000,
    action: "reinforce",
  };
}

function applyMoodAction(currentValue, event, durationMinutes) {
  const at = Number.isFinite(event.at) ? event.at : Date.now();
  const current = activeMoodAt(currentValue, at);
  const action = normalizeMoodAction(event.moodAction);
  const blend = normalizeEmotionBlend(event.blend, event.blend && event.blend.source || "fallback");
  if (action === "resolve") return calmMood();
  if (action === "preserve") return { ...current, action: "preserve" };
  if (action === "establish") return isCalmMood(current) ? makeMood(blend, at, durationMinutes, action) : { ...current, action: "preserve" };
  if (action === "replace") return makeMood(blend, at, durationMinutes, action);
  if (action === "reinforce") return reinforceMood(current, blend, at, durationMinutes);
  if (action === "ease") {
    if (isCalmMood(current)) return current;
    const easedBlend = normalizeEmotionBlend({ ...current.blend, intensity: clamp(current.blend.intensity * 0.45, 0.2, 1) }, current.blend.source);
    return { ...current, blend: easedBlend, vad: blendToVad(easedBlend), updatedAt: at, action: "ease" };
  }
  return current;
}

function createEmotionRuntime(options = {}) {
  const now = typeof options.now === "function" ? options.now : Date.now;
  const schedule = options.setTimeout || setTimeout;
  const cancel = options.clearTimeout || clearTimeout;
  const onChange = typeof options.onChange === "function" ? options.onChange : () => {};
  let durationMinutes = normalizeMoodDurationMinutes(options.moodDurationMinutes);
  let reaction = null;
  let mood = calmMood();
  let reactionTimer = null;
  let moodTimer = null;
  let eventSeq = 0;
  const events = [];

  function clearTimers() {
    if (reactionTimer) cancel(reactionTimer);
    if (moodTimer) cancel(moodTimer);
    reactionTimer = null;
    moodTimer = null;
  }

  function expireAt(timestamp = now()) {
    let changed = false;
    if (reaction && reaction.expiresAt <= timestamp) { reaction = null; changed = true; }
    if (!isCalmMood(mood) && mood.expiresAt <= timestamp) { mood = calmMood(); changed = true; }
    return changed;
  }

  function snapshot(timestamp = now()) {
    expireAt(timestamp);
    const activeReaction = reaction && reaction.expiresAt > timestamp ? { ...reaction, blend: normalizeEmotionBlend(reaction.blend, reaction.blend.source) } : null;
    const activeMood = cloneMood(mood);
    const activeLayer = activeReaction ? "reaction" : (!isCalmMood(activeMood) ? "mood" : "calm");
    const display = activeReaction ? activeReaction.blend : activeMood.blend;
    return {
      reaction: activeReaction,
      mood: activeMood,
      display,
      activeLayer,
      moodDurationMinutes: durationMinutes,
      remainingMoodMs: !isCalmMood(activeMood) ? Math.max(0, activeMood.expiresAt - timestamp) : 0,
    };
  }

  function emit() { const value = snapshot(); onChange(value); return value; }

  function scheduleTimers() {
    if (reactionTimer) cancel(reactionTimer);
    if (moodTimer) cancel(moodTimer);
    reactionTimer = null;
    moodTimer = null;
    const timestamp = now();
    if (reaction && reaction.expiresAt > timestamp) {
      reactionTimer = schedule(() => { reactionTimer = null; if (expireAt(now())) emit(); }, reaction.expiresAt - timestamp);
    }
    if (!isCalmMood(mood) && mood.expiresAt > timestamp) {
      moodTimer = schedule(() => { moodTimer = null; if (expireAt(now())) emit(); }, mood.expiresAt - timestamp);
    }
  }

  function recomputeMood() {
    if (!events.length) return;
    let nextMood = cloneMood(events[0].beforeMood);
    for (const event of events) nextMood = applyMoodAction(nextMood, event, durationMinutes);
    mood = activeMoodAt(nextMood, now());
  }

  function apply(input = {}) {
    const timestamp = Number.isFinite(input.at) ? input.at : now();
    const rawId = String(input.eventId || "").replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 96);
    const eventId = rawId || `emotion-${timestamp}-${++eventSeq}`;
    const blend = normalizeEmotionBlend(input.blend || input.emotion || input, input.source || "fallback");
    const moodAction = normalizeMoodAction(input.moodAction);
    let event = events.find((item) => item.eventId === eventId);
    if (event) {
      event.blend = blend;
      event.moodAction = moodAction;
      event.corrected = true;
    } else {
      event = { eventId, at: timestamp, blend, moodAction, beforeMood: cloneMood(mood), corrected: false };
      events.push(event);
      events.sort((a, b) => a.at - b.at);
      while (events.length > 32) events.shift();
    }
    recomputeMood();

    if (!reaction || timestamp >= reaction.at || reaction.eventId === eventId) {
      const expiresAt = reaction && reaction.eventId === eventId ? reaction.expiresAt : timestamp + REACTION_DURATION_MS;
      if (expiresAt > now()) reaction = { eventId, at: timestamp, expiresAt, blend };
    }
    scheduleTimers();
    return emit();
  }

  function setMoodDurationMinutes(value) {
    const next = normalizeMoodDurationMinutes(value);
    if (next === durationMinutes) return snapshot();
    durationMinutes = next;
    if (!isCalmMood(mood)) {
      mood.expiresAt = (mood.startedAt || mood.updatedAt || now()) + durationMinutes * 60 * 1000;
      mood = activeMoodAt(mood, now());
    }
    scheduleTimers();
    return emit();
  }

  function cleanup() { clearTimers(); events.length = 0; reaction = null; mood = calmMood(); }

  return { apply, snapshot, setMoodDurationMinutes, cleanup, get eventCount() { return events.length; } };
}

module.exports = {
  REACTION_DURATION_MS,
  DEFAULT_MOOD_DURATION_MINUTES,
  ALLOWED_MOOD_DURATIONS,
  MOOD_ACTIONS,
  normalizeMoodDurationMinutes,
  normalizeMoodAction,
  blendToVad,
  applyMoodAction,
  createEmotionRuntime,
};
