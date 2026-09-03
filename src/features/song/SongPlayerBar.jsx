import { useState } from 'react';
import { youtubeId } from '@/lib/coverArt';
import { headerFrostStyle } from '@/lib/headerFrost';
import { useYouTubeTrack, hiddenHostStyle } from '@/hooks/useYouTubeTrack';
import { formatClock } from '@/lib/duration';

// ── Backing-track transport bar ────────────────────────────────────────────
// The bottom bar from docs/mockups/song-hub-v2.html. Plays the song's YouTube
// backing track with OUR OWN controls — play/pause, elapsed time and a scrub
// bar — driving the audio. YouTube's native player is loaded hidden (1px,
// in-viewport) via the IFrame API and we command it; only our controls show.
//
// The player itself lives in `hooks/useYouTubeTrack` — the Reader's practice
// row (element 12) drives the same engine with a compact transport, and the
// ready-watchdog / poll / teardown logic must not exist in two places.
//
// Spotify playback was intentionally dropped: its embed iframe API runs via
// `eval()`, which our CSP blocks — allowing it ('unsafe-eval') would weaken the
// whole app — and it only streams full tracks to listeners already signed into
// Spotify (a 30s preview otherwise). We still use Spotify links for cover art
// (resolved server-side via oEmbed), just not for in-app playback.

export default function SongPlayerBar({ youtubeUrl, title, artist }) {
  const ytId = youtubeId(youtubeUrl);
  if (!ytId) return null;

  return (
    <div
      className="rounded-2xl border border-[var(--border-1)] overflow-hidden"
      style={{ ...headerFrostStyle, background: 'color-mix(in srgb, var(--ds-background-100) 92%, transparent)' }}
    >
      <TrackTransport ytId={ytId} title={title} artist={artist} />
    </div>
  );
}

function TrackTransport({ ytId, title, artist }) {
  const {
    hostRef, playing, position, duration, failed, loading,
    toggle, seek, setDragging: setDraggingRef,
  } = useYouTubeTrack(ytId);

  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState(0);

  const displayPos = dragging ? dragPos : position;
  const canScrub = !loading && !failed && duration > 0;

  const onScrubInput = (e) => {
    setDraggingRef(true);
    setDragging(true);
    setDragPos(Number(e.target.value));
  };
  const onScrubCommit = () => {
    if (!dragging) return;
    seek(dragPos);
    setDraggingRef(false);
    setDragging(false);
  };

  return (
    <>
      {/* Hidden YouTube player — kept in-viewport at 1px but invisible, so only
          our controls show. */}
      <div ref={hostRef} aria-hidden="true" style={hiddenHostStyle} />

      {/* Single non-wrapping row on every width: play · title · scrubber · time
          (the scrubber stays on the title's line on phones, not below it). */}
      <div className="mx-auto max-w-[1200px] px-3 sm:px-7 py-2.5 sm:py-3 flex items-center gap-2.5 sm:gap-4">
        {/* Play + identity */}
        <div className="flex items-center gap-2.5 min-w-0 shrink sm:w-[240px] sm:shrink-0">
          <button
            type="button"
            aria-label={playing ? 'Pause backing track' : 'Play backing track'}
            onClick={toggle}
            disabled={loading || failed}
            className="shrink-0 w-11 h-11 rounded-full grid place-items-center cursor-pointer hover:opacity-90 transition-opacity disabled:cursor-default"
            style={{ background: 'var(--color-brand)', color: '#ffffff', WebkitTapHighlightColor: 'transparent', opacity: failed ? 0.5 : 1 }}
          >
            {loading ? (
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : playing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>

          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[var(--text-1)] truncate">{title || 'Backing track'}</div>
            <div className="text-[11px] text-[var(--text-2)] flex items-center gap-1 min-w-0">
              {artist && <span className="truncate min-w-0">{artist}</span>}
              {artist && <span aria-hidden="true" className="opacity-60">·</span>}
              <span className="shrink-0">YouTube</span>
              {failed && <span className="shrink-0 opacity-70">· unavailable</span>}
            </div>
          </div>
        </div>

        {/* Scrub bar — inline on the title's row at every width */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <span className="text-[11px] tabular-nums text-[var(--text-2)] w-9 text-right shrink-0">{formatClock(displayPos)}</span>
          <input
            type="range"
            aria-label="Seek"
            min={0}
            max={duration || 0}
            step="0.1"
            value={Math.min(displayPos, duration || 0)}
            onChange={onScrubInput}
            onMouseUp={onScrubCommit}
            onTouchEnd={onScrubCommit}
            onKeyUp={onScrubCommit}
            disabled={!canScrub}
            className="flex-1 min-w-0 h-1 cursor-pointer disabled:cursor-default"
            style={{ accentColor: 'var(--color-brand)' }}
          />
          <span className="text-[11px] tabular-nums text-[var(--text-2)] w-9 shrink-0">{formatClock(duration)}</span>
        </div>
      </div>
    </>
  );
}
