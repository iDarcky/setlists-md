import { useEffect, useRef, useState, useCallback } from 'react';
import { youtubeId, spotifyTrackId } from '../lib/coverArt';
import { ensureYouTubeApi, ensureSpotifyApi } from '../lib/embedPlayers';
import { headerFrostStyle } from '../lib/headerFrost';

// ── Backing-track transport bar ────────────────────────────────────────────
// The bottom bar from docs/mockups/song-hub-v2.html. Plays the song's backing
// track from its Spotify and/or YouTube link, but with OUR OWN controls —
// play/pause, elapsed time, and a scrub bar — driving the audio. The platform's
// native player is loaded hidden (1px, in-viewport) via its JS API (YouTube
// IFrame API / Spotify iframe API) and we command it; only our controls show.
// When the song has both links the source is switched via a chevron next to the
// source name.
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

export default function SongPlayerBar({ spotifyUrl, youtubeUrl, title, artist }) {
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
        artist={artist}
        sources={sources}
        onSource={setSource}
      />
    </div>
  );
}

function TrackTransport({ active, ytId, spId, title, artist, sources, onSource }) {
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
        IFrameAPI.createController(el, { uri: `spotify:track:${spId}`, width: 300, height: 80 }, (controller) => {
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
  const loading = !ready && !failed;

  // Source picker (a real choose-from-list menu, not a blind toggle).
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

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
      {/* Hidden platform player — kept in-viewport at 1px (Spotify won't
          initialise when fully offscreen) but invisible, so only our controls
          show. */}
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
            {/* No `truncate`/overflow-hidden here — it would clip the source
                popover. The artist span truncates on its own. */}
            <div className="text-[11px] text-[var(--text-2)] flex items-center gap-1 min-w-0">
              {artist && <span className="truncate min-w-0">{artist}</span>}
              {artist && <span aria-hidden="true" className="opacity-60">·</span>}
              {sources.length > 1 ? (
                // A pick-from-list menu (opens upward; stays available even when
                // a source failed, so a broken provider isn't a dead end).
                <span className="relative inline-flex shrink-0" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(o => !o)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label={`Source: ${activeLabel}. Choose source.`}
                    className="inline-flex items-center gap-0.5 hover:text-[var(--text-1)] cursor-pointer"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    {activeLabel}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  {menuOpen && (
                    <div role="menu" className="absolute left-0 bottom-full mb-1.5 z-20 min-w-[130px] rounded-lg border border-[var(--border-2)] bg-[var(--ds-background-100)] py-1" style={{ boxShadow: '0 8px 28px rgba(0,0,0,0.45)' }}>
                      {sources.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={s.id === active}
                          onClick={() => { setMenuOpen(false); if (s.id !== active) onSource(s.id); }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] text-left text-[var(--text-1)] hover:bg-[var(--bg-2)] cursor-pointer"
                        >
                          <span className="w-3.5 shrink-0 text-[var(--color-brand)]">
                            {s.id === active && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                            )}
                          </span>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </span>
              ) : (
                <span className="shrink-0">{activeLabel}</span>
              )}
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
