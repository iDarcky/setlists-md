import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureYouTubeApi } from '@/lib/embedPlayers';

/**
 * The backing-track engine: a hidden YouTube player plus our own transport.
 *
 * Extracted from `SongPlayerBar` when element 12 put a track control in the
 * Reader as well. Two surfaces now command the same player, and the fiddly
 * parts — the ready watchdog, the position poll, teardown — are hard-won and
 * must not exist twice. `SongPlayerBar` renders the Song Hub's bar and the
 * Reader's practice row renders a compact one; both call this.
 *
 * The player is mounted hidden (1px, in-viewport, opacity 0) and driven
 * entirely through the IFrame API, so only our controls are ever visible.
 *
 * `rate` is YouTube's `playbackRate`: **pitch-preserving**, so a song slowed to
 * 0.75× is still in the same key. It cannot pitch-shift — transpose stays a
 * chart-side concern.
 */
export function useYouTubeTrack(ytId) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const pollRef = useRef(null);
  const draggingRef = useRef(false); // suppress poll-driven position while scrubbing
  const readyRef = useRef(false);    // mirrors `ready` for the watchdog closure
  const watchdogRef = useRef(null);  // re-init timer if the player never signals ready
  const rateRef = useRef(1);         // survives a re-create, so a stalled retry keeps the rate

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const [rate, setRateState] = useState(1);
  const [rates, setRates] = useState([1]);
  const [attempt, setAttempt] = useState(0); // bumped to force a clean player re-create

  // Build (and tear down) the hidden YouTube player. The `attempt` dep lets a
  // stalled init auto-recover: the embed occasionally drops its very first
  // ready callback in a hidden container (or stalls behind a slow/blocked API
  // load), and a clean re-create fixes it.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !ytId) return undefined;
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
          onReady: (e) => {
            if (disposed) return;
            markReady();
            setDuration(e.target.getDuration() || 0);
            // The rate menu is per-video, so it can only be read once ready.
            try {
              const avail = e.target.getAvailablePlaybackRates?.();
              if (Array.isArray(avail) && avail.length) setRates(avail);
            } catch { /* older embeds don't expose it; 1× only */ }
            // Re-apply across a watchdog re-create, so a retry doesn't silently
            // snap a slowed-down track back to full speed.
            if (rateRef.current !== 1) {
              try { e.target.setPlaybackRate(rateRef.current); } catch { /* ignore */ }
            }
          },
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

  const setRate = useCallback((next) => {
    const player = playerRef.current;
    rateRef.current = next;
    setRateState(next);
    if (!player) return;
    try { player.setPlaybackRate(next); } catch { /* ignore */ }
  }, []);

  const setDragging = useCallback((on) => { draggingRef.current = on; }, []);

  return {
    hostRef,
    ready,
    playing,
    position,
    duration,
    failed,
    loading: !ready && !failed,
    rate,
    rates,
    toggle,
    seek,
    setRate,
    setDragging,
  };
}

/**
 * The hidden player's host element. Both call sites render this verbatim, so it
 * lives with the hook rather than being copied.
 */
export const hiddenHostStyle = {
  position: 'fixed', left: 0, bottom: 0, width: 1, height: 1,
  overflow: 'hidden', opacity: 0, pointerEvents: 'none', zIndex: -1,
};

export default useYouTubeTrack;
