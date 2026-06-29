import { useEffect, useRef, useState, useCallback } from 'react';
import { youtubeId } from '../lib/coverArt';
import { ensureYouTubeApi } from '../lib/embedPlayers';
import { headerFrostStyle } from '../lib/headerFrost';

// ── Backing-track transport bar ────────────────────────────────────────────
// The bottom bar from docs/mockups/song-hub-v2.html. Plays the song's YouTube
// backing track with OUR OWN controls — play/pause, elapsed time and a scrub
// bar — driving the audio. YouTube's native player is loaded hidden (1px,
// in-viewport) via the IFrame API and we command it; only our controls show.
//
// Spotify playback was intentionally dropped: its embed iframe API runs via
// `eval()`, which our CSP blocks — allowing it ('unsafe-eval') would weaken the
// whole app — and it only streams full tracks to listeners already signed into
// Spotify (a 30s preview otherwise). We still use Spotify links for cover art
// (resolved server-side via oEmbed), just not for in-app playback.

function fmtTime(sec) {
  if (!sec || !isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function SongPlayerBar({ youtubeUrl, title, artist }) {
  const ytId = youtubeId(youtubeUrl);
  if (!ytId) return null;

  return (
    <div
      className="shrink-0 border-t border-[var(--border-1)]"
      style={{ ...headerFrostStyle, background: 'color-mix(in srgb, var(--ds-background-100) 88%, transparent)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <TrackTransport ytId={ytId} title={title} artist={artist} />
    </div>
  );
}

function TrackTransport({ ytId, title, artist }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const pollRef = useRef(null);
  const draggingRef = useRef(false); // suppress poll-driven position while scrubbing
  const readyRef = useRef(false);    // mirrors `ready` for the watchdog closure
  const watchdogRef = useRef(null);  // re-init timer if the player never signals ready

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState(0);
  const [attempt, setAttempt] = useState(0); // bumped to force a clean player re-create

  // Build (and tear down) the hidden YouTube player. The `attempt` dep lets a
  // stalled init auto-recover: the embed occasionally drops its very first
  // ready callback in a hidden container (or stalls behind a slow/blocked API
  // load), and a clean re-create fixes it.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let disposed = false;
    readyRef.current = false;
    const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
    const clearWatchdog = () => { if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; } };
    const markReady = () => { readyRef.current = true; clearWatchdog(); setReady(true); };

    // If the player hasn't signalled ready in time, re-create it a couple of
    // times before surfacing "unavailable". Covers both a dropped first-init
    // and an API load that never resolves (e.g. blocked/slow network).
    watchdogRef.current = setTimeout(() => {
      if (disposed || readyRef.current) return;
      if (attempt < 2) setAttempt(a => a + 1);
      else setFailed(true);
    }, 6000);

    ensureYouTubeApi().then((YT) => {
      if (disposed) return;
      const el = document.createElement('div');
      host.appendChild(el);
      const player = new YT.Player(el, {
        videoId: ytId,
        width: '320',
        height: '180',
        playerVars: { controls: 0, modestbranding: 1, rel: 0, playsinline: 1, disablekb: 1, iv_load_policy: 3, fs: 0 },
        events: {
          onReady: (e) => { if (disposed) return; markReady(); setDuration(e.target.getDuration() || 0); },
          onStateChange: (e) => {
            if (disposed) return;
            const isPlaying = e.data === YT.PlayerState.PLAYING;
            setPlaying(isPlaying);
            if (isPlaying) {
              setDuration(player.getDuration() || 0);
              stopPoll();
              pollRef.current = setInterval(() => {
                if (!draggingRef.current) setPosition(player.getCurrentTime() || 0);
              }, 250);
            } else {
              stopPoll();
            }
          },
        },
      });
      playerRef.current = player;
    }).catch(() => { if (!disposed) { clearWatchdog(); setFailed(true); } });

    return () => {
      disposed = true;
      stopPoll();
      clearWatchdog();
      if (playerRef.current) { try { playerRef.current.destroy?.(); } catch { /* ignore teardown errors */ } }
      playerRef.current = null;
      host.innerHTML = '';
    };
  }, [ytId, attempt]);

  const toggle = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) player.pauseVideo(); else player.playVideo();
  }, [playing]);

  const seek = useCallback((sec) => {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(sec, true);
    setPosition(sec);
  }, []);

  const displayPos = dragging ? dragPos : position;
  const canScrub = ready && duration > 0;
  const loading = !ready && !failed;

  const onScrubInput = (e) => {
    draggingRef.current = true;
    setDragging(true);
    setDragPos(Number(e.target.value));
  };
  const onScrubCommit = () => {
    if (!draggingRef.current) return;
    seek(dragPos);
    draggingRef.current = false;
    setDragging(false);
  };

  return (
    <>
      {/* Hidden YouTube player — kept in-viewport at 1px but invisible, so only
          our controls show. */}
      <div ref={hostRef} aria-hidden="true" style={{ position: 'fixed', left: 0, bottom: 0, width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none', zIndex: -1 }} />

      <div className="mx-auto max-w-[1200px] px-3 sm:px-7 py-2.5 sm:py-3 flex flex-wrap items-center gap-x-4 gap-y-2.5">
        {/* Play + identity */}
        <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-none sm:w-[240px]">
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

        {/* Scrub bar — own row on mobile, inline on desktop */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 w-full sm:w-auto sm:flex-1 order-last sm:order-none">
          <span className="text-[11px] tabular-nums text-[var(--text-2)] w-9 text-right shrink-0">{fmtTime(displayPos)}</span>
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
          <span className="text-[11px] tabular-nums text-[var(--text-2)] w-9 shrink-0">{fmtTime(duration)}</span>
        </div>
      </div>
    </>
  );
}
