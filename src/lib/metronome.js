/**
 * Element 12 — the click.
 *
 * A **lookahead scheduler**, not a `setInterval` that plays a sound. A timer
 * that fires the click directly inherits every bit of main-thread jitter — a
 * React re-render, a scroll, a GC pause — and a metronome that wobbles is worse
 * than no metronome. Instead the interval only ever *schedules*, handing beats
 * to the audio clock a fraction of a second early; the audio hardware plays
 * them at exactly the right time even if JS was busy when the timer fired.
 *
 * The click is synthesised (a short oscillator burst), so there is no audio
 * asset to ship, load, or fail to load offline.
 *
 * Beat 1 is **accented** — higher and louder — cycling on the song's existing
 * `time` field. That field is already parsed and already shown in the top bar;
 * a metronome that tells you where you are in the bar costs no new data and no
 * new setting.
 */

export const MIN_BPM = 40;
export const MAX_BPM = 240;
const DEFAULT_BPM = 100;

// How often the scheduler wakes, and how far ahead of the audio clock it books
// beats. 25ms/120ms is the standard pairing: comfortably more lookahead than
// wake interval, so a late wake still has beats already booked.
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;

export function clampTempo(bpm) {
  // `parseFloat`, NOT `Number`: tempo comes off the .md frontmatter as a string,
  // and `Number(null)` / `Number('')` are both **0**, which clamped a song with
  // a blank tempo to 40bpm instead of falling back to the default.
  const n = typeof bpm === 'number' ? bpm : parseFloat(bpm);
  if (!Number.isFinite(n)) return DEFAULT_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(n)));
}

/**
 * Beats per bar from a `4/4`-style time signature — the numerator, because
 * that is how many beats you count before the accent comes round again.
 *
 * Anything missing or malformed falls back to 4 rather than refusing to click:
 * `time` is a free-text field in the .md format and plenty of songs leave it
 * blank. A wrong accent is a small annoyance; no metronome is the feature
 * missing.
 */
export function beatsPerBar(time) {
  if (typeof time !== 'string') return 4;
  const m = time.match(/^\s*(\d{1,2})\s*\/\s*\d{1,2}\s*$/);
  if (!m) return 4;
  const beats = Number(m[1]);
  if (!Number.isInteger(beats) || beats < 1 || beats > 16) return 4;
  return beats;
}

/**
 * The beats a scheduler pass should book, given where the audio clock is.
 *
 * Split out from the audio so it can be tested without an AudioContext: this
 * is the part with the arithmetic in it.
 *
 * @returns {{ beats: Array<{ at: number, accent: boolean }>, nextTime: number, nextBeat: number }}
 */
export function beatsToSchedule({ now, nextTime, beat, bpm, perBar, horizon = SCHEDULE_AHEAD_S }) {
  const secondsPerBeat = 60 / clampTempo(bpm);
  const bars = Math.max(1, perBar);
  const beats = [];
  let t = nextTime;
  let n = beat;

  // ── Catch up, don't machine-gun ──────────────────────────────────────────
  // The scheduler is a `setInterval`, and browsers throttle or suspend timers
  // in a background tab while the AUDIO clock keeps running. Come back after
  // 30 seconds and `nextTime` is 30 seconds behind `now` — at which point the
  // loop below books every beat in between, all with a time in the PAST, and
  // Web Audio plays anything scheduled in the past immediately. That is a burst
  // of clicks followed by a click that is permanently late: the "metronome gets
  // out of sync" report.
  //
  // Skipping whole beats keeps the BAR phase, so the accent still lands on
  // beat one — dropping to `now` exactly would put the downbeat wherever the
  // interruption happened to end.
  if (t < now) {
    const missed = Math.ceil((now - t) / secondsPerBeat);
    t += missed * secondsPerBeat;
    n += missed;
  }

  // Bounded so a pathological input (a huge horizon, a stalled clock) can never
  // spin here — at 240bpm the horizon holds a handful of beats, never hundreds.
  while (t < now + horizon && beats.length < 64) {
    beats.push({ at: t, accent: n % bars === 0 });
    t += secondsPerBeat;
    n += 1;
  }
  return { beats, nextTime: t, nextBeat: n };
}

/**
 * The click itself. Returns a handle rather than a class — nothing needs to
 * subclass a metronome, and a closure keeps the audio context private so it
 * cannot be left running by a stray reference.
 */
export function createMetronome() {
  let ctx = null;
  let timer = null;
  let nextTime = 0;
  let beat = 0;
  let bpm = DEFAULT_BPM;
  let perBar = 4;

  function ensureContext() {
    if (ctx) return ctx;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
    return ctx;
  }

  function playClick(at, accent) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1000;
    // A percussive envelope. A bare oscillator start/stop clicks at BOTH ends
    // and reads as two ticks per beat; the ramp down to near-silence is what
    // makes it a tick rather than a beep.
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(accent ? 0.5 : 0.28, at + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.05);
  }

  function pass() {
    if (!ctx) return;
    const next = beatsToSchedule({ now: ctx.currentTime, nextTime, beat, bpm, perBar });
    for (const b of next.beats) playClick(b.at, b.accent);
    nextTime = next.nextTime;
    beat = next.nextBeat;
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    /**
     * Must be called from a user gesture the first time: iOS hands every audio
     * context back suspended until one touches it, and a resume() outside a
     * gesture is silently ignored.
     */
    start(nextBpm, nextPerBar) {
      const c = ensureContext();
      if (!c) return false;
      bpm = clampTempo(nextBpm);
      perBar = Math.max(1, nextPerBar || 4);
      if (c.state === 'suspended') c.resume?.();
      stop();
      beat = 0;
      // A beat's grace before the first click, so the downbeat is scheduled
      // rather than fired late at whatever `currentTime` happened to be.
      nextTime = c.currentTime + 0.06;
      timer = setInterval(pass, LOOKAHEAD_MS);
      pass();
      return true;
    },
    /** Retempo while running. Beats already booked keep their time; the new
     *  spacing takes effect from the next one, so there is no lurch.
     *
     *  It also RE-ANCHORS: `nextTime` was computed at the old spacing and can
     *  sit up to `SCHEDULE_AHEAD_S` in the future, so without this the first
     *  beat after a tempo change is still spaced at the old tempo — which is
     *  exactly what a held − / + press does, dozens of times a second. Pull it
     *  back to one new-tempo beat after now whenever it has drifted further
     *  than that. */
    setTempo(nextBpm) {
      const prev = bpm;
      bpm = clampTempo(nextBpm);
      if (!ctx || !timer || bpm === prev) return;
      const spb = 60 / bpm;
      const now = ctx.currentTime;
      if (nextTime > now + spb) nextTime = now + spb;
    },
    stop,
    dispose() {
      stop();
      if (ctx) {
        try { ctx.close?.(); } catch { /* already closed */ }
        ctx = null;
      }
    },
  };
}
