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
// Raised from 0.12s. The horizon is the only thing standing between a late
// scheduler pass and a missed beat, and 0.12s covers less than a frame budget's
// worth of slack on a busy phone. A quarter-second of booked-ahead audio costs
// nothing and absorbs a long task whole.
const SCHEDULE_AHEAD_S = 0.25;

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
export function beatsToSchedule({ now, nextTime, beat, bpm, perBar, horizon = SCHEDULE_AHEAD_S, anchor = null }) {
  const secondsPerBeat = 60 / clampTempo(bpm);
  const bars = Math.max(1, perBar);
  const beats = [];
  let t = nextTime;
  let n = beat;

  // ── Never fall behind, never leave the grid ──────────────────────────────
  // The scheduler is a timer, and a timer can be late — throttled in a hidden
  // tab, starved by a long task, stopped outright while the device sleeps. The
  // AUDIO clock keeps running regardless, so a late pass wakes with `nextTime`
  // behind `now`.
  //
  // Booking those beats anyway is the bug that was heard as "out of sync":
  // Web Audio plays anything scheduled in the past IMMEDIATELY, so a 30-second
  // gap became a burst of clicks followed by a click that never caught up.
  //
  // What we do instead is land on the next beat OF THE ORIGINAL GRID. `anchor`
  // is the time of beat 0, so beat k is always exactly `anchor + k *
  // secondsPerBeat` — computed, never accumulated, which is also why the click
  // cannot drift over a long session. Nothing is dropped from the count: `n`
  // advances by however many beats genuinely elapsed, so the accent still falls
  // on beat one of the bar and the count is exactly where it would have been
  // had the timer never faltered. Beats whose moment has already passed can't
  // be played — no scheduler can play a sound in the past — but the pulse
  // resumes in phase rather than restarting wherever the interruption ended.
  if (t < now) {
    if (anchor != null) {
      const k = Math.ceil((now - anchor) / secondsPerBeat);
      n += Math.max(0, k - Math.round((t - anchor) / secondsPerBeat));
      t = anchor + k * secondsPerBeat;
    } else {
      const missed = Math.ceil((now - t) / secondsPerBeat);
      t += missed * secondsPerBeat;
      n += missed;
    }
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
 * A tick that keeps ticking when the page is hidden.
 *
 * `setInterval` on the main thread is clamped to ~1s (or suspended) in a
 * background tab, which is precisely when the scheduler must NOT stop: the
 * audio clock carries on and every beat it fails to book is a beat that
 * silently doesn't happen. A Worker's timer is throttled far less
 * aggressively, so the click survives a glance at another app.
 *
 * Built from a Blob rather than a file so it needs no separate chunk and works
 * offline with no extra precache entry. Falls back to `setInterval` wherever
 * Workers or blob URLs are unavailable (older WebViews, strict CSP) — the
 * lookahead still covers ordinary main-thread jitter there.
 */
export function createTicker(intervalMs, onTick) {
  if (typeof Worker !== 'undefined' && typeof URL?.createObjectURL === 'function') {
    try {
      const src = `let id=null;onmessage=e=>{if(e.data.start){clearInterval(id);id=setInterval(()=>postMessage(0),e.data.start)}else{clearInterval(id);id=null}}`;
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      const worker = new Worker(url);
      worker.onmessage = () => onTick();
      worker.postMessage({ start: intervalMs });
      return () => {
        worker.postMessage({ start: 0 });
        worker.terminate();
        URL.revokeObjectURL(url);
      };
    } catch {
      /* fall through to the timer */
    }
  }
  const id = setInterval(onTick, intervalMs);
  return () => clearInterval(id);
}

/**
 * The click itself. Returns a handle rather than a class — nothing needs to
 * subclass a metronome, and a closure keeps the audio context private so it
 * cannot be left running by a stray reference.
 */
export function createMetronome() {
  let ctx = null;
  let stopTicker = null;
  let nextTime = 0;
  let beat = 0;
  let bpm = DEFAULT_BPM;
  let perBar = 4;
  // The time of beat 0. Every beat is computed FROM this rather than added to
  // the last one, so a long session cannot accumulate rounding drift and a late
  // pass can always find the grid again.
  let anchor = 0;

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
    const next = beatsToSchedule({ now: ctx.currentTime, nextTime, beat, bpm, perBar, anchor });
    for (const b of next.beats) playClick(b.at, b.accent);
    nextTime = next.nextTime;
    beat = next.nextBeat;
  }

  function stop() {
    if (stopTicker) {
      stopTicker();
      stopTicker = null;
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
      anchor = nextTime;
      stopTicker = createTicker(LOOKAHEAD_MS, pass);
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
      if (!ctx || !stopTicker || bpm === prev) return;
      const spb = 60 / bpm;
      const now = ctx.currentTime;
      // `nextTime` was booked at the old spacing and can sit a whole horizon in
      // the future, so without this the first beat after a change is still at
      // the old tempo — which a HELD − / + does dozens of times a second.
      if (nextTime > now + spb) nextTime = now + spb;
      // Re-anchor the grid to the beat we just committed to: the old anchor
      // describes a grid at the old tempo, and catch-up must land on the grid
      // actually being played.
      anchor = nextTime - beat * spb;
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

/**
 * Tap tempo — the only way to get a BPM out of a recording.
 *
 * Worth writing down, because it will be asked again: **a tempo cannot be read
 * from a YouTube link.** The IFrame API exposes duration, position, playback
 * rate and quality — no tempo — and the audio can't be analysed either, because
 * the embed is a cross-origin iframe with no media element to route into Web
 * Audio (`createMediaElementSource` requires same-origin). Spotify's
 * `audio-features` endpoint does carry tempo but is closed to new apps. So the
 * musician taps, which takes four taps and always works.
 *
 * @param taps  timestamps in ms, oldest first
 * @returns the bpm, or null while there aren't enough taps
 */
export const TAP_MIN = 4;          // owner's call: four taps, then it commits
export const TAP_RESET_MS = 2000;  // a gap this long starts a new count

export function tempoFromTaps(taps, { min = TAP_MIN } = {}) {
  if (!Array.isArray(taps) || taps.length < min) return null;
  // The last `min` taps only — a musician who taps eight times is correcting
  // the first four, not averaging with them.
  const recent = taps.slice(-min);
  const gaps = [];
  for (let i = 1; i < recent.length; i += 1) gaps.push(recent[i] - recent[i - 1]);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (!Number.isFinite(mean) || mean <= 0) return null;
  return clampTempo(60000 / mean);
}

/** Drop taps separated by more than `resetMs` — a fresh count, not a slow one. */
export function pruneTaps(taps, now, { resetMs = TAP_RESET_MS } = {}) {
  const list = Array.isArray(taps) ? taps : [];
  const last = list[list.length - 1];
  if (last != null && now - last > resetMs) return [now];
  return [...list, now];
}
