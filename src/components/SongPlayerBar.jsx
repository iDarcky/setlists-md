import { useEffect, useRef, useState, useCallback } from 'react';
import { youtubeId, spotifyTrackId } from '../lib/coverArt';
import { ensureYouTubeApi, ensureSpotifyApi } from '../lib/embedPlayers';
import { headerFrostStyle } from '../lib/headerFrost';
import { cn } from '../lib/utils';

// ── Backing-track transport bar ────────────────────────────────────────────
// The bottom bar from docs/mockups/song-hub-v2.html. Plays the song's backing
// track from its Spotify and/or YouTube link, but with OUR OWN controls —
// play/pause, elapsed time, and a scrub bar — driving the audio. The platform's
// native player is loaded hidden offscreen via its JS API (YouTube IFrame API /
// Spotify iframe API) and we command it; only our controls are visible. A source
// toggle switches providers when the song has both links.
//
// Note: Spotify embeds play full tracks only for listeners signed into Spotify
// in this browser; otherwise the API serves a 30s preview (a Spotify limit, not
// ours). Future practice features (pitch / tempo) need a scrubbing audio engine
// these streaming embeds don't expose — out of scope here.

function fmtTime(sec) {
  if (!sec || !isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function SongPlayerBar({ spotifyUrl, youtubeUrl, title }) {
  const ytId = youtubeId(youtubeUrl);
  const spId = spotifyTrackId(spotifyUrl);
  const sources = [
    ytId && { id: 'youtube', label: 'YouTube' },
    spId && { id: 'spotify', label: 'Spotify' },
  ].filter(Boolean);

  const [source, setSource] = useState(sources[0]?.id);
  const active = sources.some(s => s.id === source) ? source : sources[0]?.id;

  if (sources.length === 0) return null;

  return (
    <div
      className="shrink-0 border-t border-[var(--border-1)]"
      style={{ ...headerFrostStyle, background: 'color-mix(in srgb, var(--ds-background-100) 88%, transparent)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Keyed by source so switching providers remounts with fresh player state. */}
      <TrackTransport
        key={active}
        active={active}
        ytId={ytId}
        spId={spId}
        title={title}
        sources={sources}
        onSource={setSource}
      />
    </div>
  );
}

function TrackTransport({ active, ytId, spId, title, sources, onSource }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);   // { kind, player }
  const pollRef = useRef(null);
  const draggingRef = useRef(false); // suppress poll-driven position while scrubbing

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState(0);

  // Build (and tear down) the hidden platform player on mount. Fresh mount per
  // source (parent keys us by it), so there's no in-effect state reset.
  useEffect(() => {
    const host = hostRef.current;
    if (!active || !host) return undefined;
    let disposed = false;
    const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

    if (active === 'youtube') {
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
            onReady: (e) => { if (disposed) return; setReady(true); setDuration(e.target.getDuration() || 0); },
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
        playerRef.current = { kind: 'youtube', player };
      }).catch(() => { if (!disposed) setFailed(true); });
    } else if (active === 'spotify') {
      ensureSpotifyApi().then((IFrameAPI) => {
        if (disposed) return;
        const el = document.createElement('div');
        host.appendChild(el);
        IFrameAPI.createController(el, { uri: `spotify:track:${spId}`, width: '100%', height: '80' }, (controller) => {
          if (disposed) { controller.destroy?.(); return; }
          playerRef.current = { kind: 'spotify', player: controller };
          setReady(true);
          controller.addListener('playback_update', (e) => {
            if (disposed) return;
            const d = e.data || {};
            setDuration((d.duration || 0) / 1000);
            if (!draggingRef.current) setPosition((d.position || 0) / 1000);
            setPlaying(!d.isPaused);
          });
        });
      }).catch(() => { if (!disposed) setFailed(true); });
    }

    return () => {
      disposed = true;
      stopPoll();
      const ref = playerRef.current;
      if (ref) { try { ref.player.destroy?.(); } catch { /* ignore teardown errors */ } }
      playerRef.current = null;
      host.innerHTML = '';
    };
  }, [active, ytId, spId]);

  const toggle = useCallback(() => {
    const ref = playerRef.current;
    if (!ref) return;
    if (ref.kind === 'youtube') {
      if (playing) ref.player.pauseVideo(); else ref.player.playVideo();
    } else {
      ref.player.togglePlay();
    }
  }, [playing]);

  const seek = useCallback((sec) => {
    const ref = playerRef.current;
    if (!ref) return;
    if (ref.kind === 'youtube') ref.player.seekTo(sec, true);
    else ref.player.seek(sec);
    setPosition(sec);
  }, []);

  const activeLabel = sources.find(s => s.id === active)?.label;
  const displayPos = dragging ? dragPos : position;
  const canScrub = ready && duration > 0;

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
      {/* Hidden platform player — present (the APIs require a real iframe) but
          offscreen so only our controls show. */}
      <div ref={hostRef} aria-hidden="true" style={{ position: 'absolute', left: -99999, top: 0, width: 320, height: 180, opacity: 0, pointerEvents: 'none' }} />

      <div className="mx-auto max-w-[1200px] px-3 sm:px-7 py-2.5 sm:py-3 flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          aria-label={playing ? 'Pause backing track' : 'Play backing track'}
          onClick={toggle}
          disabled={!ready || failed}
          className="shrink-0 w-11 h-11 rounded-full grid place-items-center cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-default"
          style={{ background: 'var(--color-brand)', color: '#ffffff', WebkitTapHighlightColor: 'transparent' }}
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>

        <div className="min-w-0 w-[110px] sm:w-[180px] shrink-0">
          <div className="text-[13px] font-semibold text-[var(--text-1)] truncate">{title || 'Backing track'}</div>
          <div className="text-[11px] text-[var(--text-2)] truncate">
            {failed ? 'Player unavailable' : activeLabel}
          </div>
        </div>

        {/* Scrub bar */}
        <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="hidden sm:inline text-[11px] tabular-nums text-[var(--text-2)] w-9 text-right shrink-0">{fmtTime(displayPos)}</span>
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

        {sources.length > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            {sources.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSource(s.id)}
                className={cn(
                  'h-8 px-2.5 sm:px-3 rounded-lg border text-[12px] font-medium cursor-pointer transition-colors',
                  active === s.id
                    ? 'border-[var(--color-brand)] text-[var(--text-1)] bg-[var(--bg-2)]'
                    : 'border-[var(--border-2)] text-[var(--text-2)] bg-[var(--bg-1)] hover:text-[var(--text-1)]',
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
