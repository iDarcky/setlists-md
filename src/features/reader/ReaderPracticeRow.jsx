import { useCallback, useEffect, useRef, useState } from 'react';
import { youtubeId } from '@/lib/coverArt';
import { MAX_BPM, MIN_BPM, TAP_MIN, clampTempo, pruneTaps, tempoFromTaps } from '@/lib/metronome';
import { useYouTubeTrack, hiddenHostStyle } from '@/hooks/useYouTubeTrack';

/**
 * Element 12 — the practice row.
 *
 * ONE row, two halves, sitting directly above element 10's nav bar: the click
 * on the left, the backing track on the right. Two bars at the bottom edge,
 * never three — the alternative was stacking a player, a tools bar and the nav
 * bar, which is ~150px of chrome eating the chart on a phone.
 *
 * The right half only exists when the song actually has a YouTube link. A dead
 * transport for a song with no track reads as broken.
 *
 * On a narrow screen the two halves WRAP onto two lines rather than truncating.
 * Squeezing a tempo readout is how you end up unable to see what tempo you set.
 *
 * Round 1 by decision: metronome + slow-down only. No count-in, no section
 * loop, no wake lock. The click and the track slow down **independently** —
 * they are not locked to each other.
 */
export default function ReaderPracticeRow({
  song,
  bpm,
  onBpm,
  // Writes the tempo back onto the song. Absent (a read-only library, or a
  // host that doesn't own the song) → the tempo stays session-only.
  onSaveTempo = null,
  clickRunning,
  onToggleClick,
  canClick = true,
}) {
  const ytId = youtubeId(song?.youtube);
  const text = 'var(--chart-text, var(--ds-gray-1000))';
  const muted = 'var(--chart-subtle, var(--ds-gray-700))';

  // ── Tap tempo ────────────────────────────────────────────────────────────
  // Four taps, then it commits and keeps tracking (owner, 2026-08-01). Taps
  // live in a ref, not state: they change on every tap and nothing about the
  // row's appearance depends on the list itself, only on how many there are.
  const tapsRef = useRef([]);
  const [tapCount, setTapCount] = useState(0);
  const tapIdle = useRef(null);
  const tap = () => {
    const next = pruneTaps(tapsRef.current, Date.now());
    tapsRef.current = next;
    setTapCount(next.length);
    const found = tempoFromTaps(next);
    if (found) onBpm(found);
    clearTimeout(tapIdle.current);
    tapIdle.current = setTimeout(() => setTapCount(0), 2000);
  };
  useEffect(() => () => clearTimeout(tapIdle.current), []);

  // Typing an exact tempo. Held as a string while editing so a half-typed "1"
  // isn't clamped to 40 under the user's fingers.
  const [typing, setTyping] = useState(null);
  const commitTyped = () => {
    if (typing == null) return;
    const n = parseInt(typing, 10);
    if (Number.isFinite(n)) onBpm(clampTempo(n));
    setTyping(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {/* ── The click ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleClick}
          disabled={!canClick}
          aria-label={clickRunning ? 'Stop the click' : 'Start the click'}
          aria-pressed={clickRunning}
          // min-h-0: the global `button { min-height: 44px }` on phones turns
          // every small control in the reader into a capsule otherwise. This
          // has cost four rounds before — see docs/READER.md.
          className="min-h-0 shrink-0 w-8 h-8 rounded-lg grid place-items-center cursor-pointer border disabled:cursor-default disabled:opacity-40"
          style={{
            background: clickRunning ? 'var(--chord)' : 'transparent',
            borderColor: clickRunning ? 'var(--chord)' : 'var(--chart-rule, var(--ds-gray-400))',
            color: clickRunning ? '#0a0a0a' : text,
          }}
        >
          {clickRunning
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
            : <MetronomeIcon />}
        </button>

        <Stepper
          value={bpm}
          min={MIN_BPM}
          max={MAX_BPM}
          onChange={onBpm}
          label="Click tempo"
          format={(v) => `${v}`}
          suffix="bpm"
          text={text}
          muted={muted}
          // The number itself is the exact-entry control — tap it and type.
          // A stepper alone takes 32 presses to get from 132 to 100.
          editing={typing}
          onStartEdit={() => setTyping(String(bpm))}
          onEditChange={setTyping}
          onCommitEdit={commitTyped}
        />

        {/* TAP. The only way to get a tempo out of a recording — YouTube
            exposes no BPM and its audio can't be analysed from a cross-origin
            embed. Four taps and it commits, then keeps tracking. */}
        <button
          type="button"
          onClick={tap}
          className="min-h-0 shrink-0 w-9 h-7 rounded-lg grid place-items-center cursor-pointer border text-label-11 font-mono font-bold tracking-wider"
          style={{
            borderColor: tapCount ? 'var(--chord)' : 'var(--chart-rule, var(--ds-gray-400))',
            color: tapCount ? 'var(--chord)' : text,
          }}
          aria-label={`Tap tempo — ${TAP_MIN} taps`}
        >
          {tapCount > 0 && tapCount < TAP_MIN ? `${tapCount}/${TAP_MIN}` : 'TAP'}
        </button>

        {/* The song's written tempo, and a way back to it. Slowing down is only
            useful if returning to the real tempo is one tap. */}
        {song?.tempo && Number(song.tempo) !== bpm && (
          <button
            type="button"
            onClick={() => onBpm(Number(song.tempo))}
            className="min-h-0 shrink-0 px-1.5 py-0.5 rounded text-label-11 tabular-nums cursor-pointer border-0 bg-transparent"
            style={{ color: muted }}
            aria-label={`Back to the written tempo, ${song.tempo}`}
          >
            ♩{song.tempo}
          </button>
        )}

        {/* Save to the song (owner, 2026-08-01). Only shows when there is
            something to save — a tempo that already matches the song is not an
            action, and element 12's rule is still that nothing persists by
            itself. */}
        {onSaveTempo && Number(song?.tempo) !== bpm && (
          <button
            type="button"
            onClick={() => onSaveTempo(bpm)}
            className="min-h-0 shrink-0 px-2 py-0.5 rounded-lg text-label-11 font-semibold cursor-pointer border-0"
            style={{ background: 'var(--color-brand)', color: '#fff' }}
            aria-label={`Save ${bpm} as this song's tempo`}
          >
            Save
          </button>
        )}
      </div>

      {/* ── The backing track ──────────────────────────────────────────── */}
      {ytId && <TrackHalf ytId={ytId} text={text} muted={muted} />}
    </div>
  );
}

/**
 * The compact transport. Same engine as the Song Hub's bar (`useYouTubeTrack`),
 * a smaller face: play · rate. No title — the top bar two rows up already says
 * which song this is.
 *
 * **No scrubber, and no clock** (owner, 2026-08-01: "remove the scrub from the
 * practice view so we leave just the play/pause and slower/faster"). Practising
 * a song means playing it from the top at a slower speed, not hunting a
 * position — and a 3rem range input is the one control on this row nobody can
 * hit accurately on a phone while holding an instrument. The Song Hub's player
 * bar still has the full transport for when you ARE looking for a spot.
 */
function TrackHalf({ ytId, text, muted }) {
  const { hostRef, playing, failed, loading, rate, rates, toggle, setRate } = useYouTubeTrack(ytId);

  // Only the rates this video actually offers, so a step can never land on a
  // rate the player will refuse.
  const usable = Array.isArray(rates) && rates.length ? rates : [1];
  const at = Math.max(0, usable.indexOf(rate));
  const stepRate = (dir) => {
    const next = usable[Math.min(usable.length - 1, Math.max(0, at + dir))];
    if (next != null && next !== rate) setRate(next);
  };

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div ref={hostRef} aria-hidden="true" style={hiddenHostStyle} />

      <button
        type="button"
        aria-label={playing ? 'Pause backing track' : 'Play backing track'}
        onClick={toggle}
        disabled={loading || failed}
        className="min-h-0 shrink-0 w-8 h-8 rounded-lg grid place-items-center cursor-pointer border-0 disabled:cursor-default"
        style={{ background: 'var(--color-brand)', color: '#ffffff', opacity: failed ? 0.4 : 1, WebkitTapHighlightColor: 'transparent' }}
      >
        {loading ? (
          <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : playing ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>

      {failed ? (
        <span className="text-label-11" style={{ color: muted }}>Track unavailable</span>
      ) : (
        <Stepper
          value={rate}
          min={usable[0]}
          max={usable[usable.length - 1]}
          onChange={(_, dir) => stepRate(dir)}
          stepped
          label="Backing-track speed"
          format={(v) => `${v}×`}
          text={text}
          muted={muted}
        />
      )}
    </div>
  );
}

/**
 * − value + . Press-and-hold repeats, because a tap-only stepper takes 32 taps
 * to get from 132bpm to 100 and nobody does that twice.
 *
 * `stepped` hands the direction to the caller instead of doing the arithmetic,
 * for the track rate — its values are a fixed list from the player, not a range.
 */
function Stepper({
  value, min, max, onChange, label, format, suffix, text, muted, stepped = false,
  // Exact entry: `editing` is the in-progress string, or null when idle.
  editing = null, onStartEdit = null, onEditChange = null, onCommitEdit = null,
}) {
  const timers = useRef({ delay: null, repeat: null });

  const clear = useCallback(() => {
    const t = timers.current;
    if (t.delay) { clearTimeout(t.delay); t.delay = null; }
    if (t.repeat) { clearInterval(t.repeat); t.repeat = null; }
  }, []);

  useEffect(() => clear, [clear]);

  const bump = useCallback((dir) => {
    if (stepped) { onChange(value, dir); return; }
    onChange(Math.min(max, Math.max(min, Number(value) + dir)));
  }, [stepped, onChange, value, min, max]);

  // A held repeat must keep counting from wherever the value has got to, so the
  // interval calls through a ref rather than the `bump` it closed over at
  // pointer-down — that one is frozen at the value from that render. Synced in
  // an effect, never during render: assigning a ref while rendering is a
  // lint error and a genuine tearing hazard.
  const bumpRef = useRef(bump);
  useEffect(() => { bumpRef.current = bump; }, [bump]);

  const hold = (dir) => {
    clear();
    bumpRef.current(dir);
    if (stepped) return; // a 3-entry rate list has nothing to repeat through
    timers.current.delay = setTimeout(() => {
      timers.current.repeat = setInterval(() => bumpRef.current(dir), 60);
    }, 400);
  };

  const btn = 'min-h-0 shrink-0 w-7 h-7 rounded-lg grid place-items-center cursor-pointer border bg-transparent disabled:opacity-40 disabled:cursor-default';
  const border = { borderColor: 'var(--chart-rule, var(--ds-gray-400))', color: text };

  return (
    <span className="shrink-0 flex items-center gap-1">
      <button
        type="button"
        className={btn}
        style={border}
        disabled={!stepped && Number(value) <= min}
        aria-label={`${label} down`}
        onPointerDown={() => hold(-1)}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </button>

      {editing != null ? (
        <input
          type="text" inputMode="numeric" pattern="[0-9]*"
          aria-label={`${label}, exact`}
          value={editing}
          autoFocus
          onChange={(e) => onEditChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
          onBlur={onCommitEdit}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
          className="min-h-0 h-7 tabular-nums text-label-12 font-mono font-semibold text-center rounded border bg-transparent outline-none"
          style={{ color: text, borderColor: 'var(--chord)', width: suffix ? '2.75rem' : '2.5rem' }}
        />
      ) : (
        <span
          {...(onStartEdit ? { role: 'button', tabIndex: 0, onClick: onStartEdit, onKeyDown: (e) => e.key === 'Enter' && onStartEdit() } : {})}
          className={`tabular-nums text-label-12 font-mono font-semibold text-center${onStartEdit ? ' cursor-text' : ''}`}
          style={{ color: text, minWidth: suffix ? '2.5rem' : '2.25rem' }}
        >
          {format(value)}
          {suffix && <span className="ml-0.5 font-sans font-normal text-label-11" style={{ color: muted }}>{suffix}</span>}
        </span>
      )}

      <button
        type="button"
        className={btn}
        style={border}
        disabled={!stepped && Number(value) >= max}
        aria-label={`${label} up`}
        onPointerDown={() => hold(1)}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><line x1="12" y1="5" x2="12" y2="19" /></svg>
      </button>
    </span>
  );
}

export function MetronomeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4h6l3 16H6z" />
      <line x1="7" y1="14" x2="17" y2="14" />
      <line x1="12" y1="14" x2="18.5" y2="6.5" />
    </svg>
  );
}
