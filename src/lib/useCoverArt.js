import { useState, useEffect, useMemo } from 'react';
import { youtubeThumb, spotifyArt } from './coverArt';

// Shared cover-art resolver (same priority as the Song Hub: Spotify album art →
// YouTube thumbnail → caller's gradient placeholder). YouTube is derived
// synchronously; Spotify goes through the cover-art edge function and is cached
// per URL across the session.
//
// `enabled` lets a caller defer the (network) Spotify lookup — e.g. a library
// grid can wait until a card scrolls into view so it doesn't fan out hundreds
// of edge-function calls on first paint.
export function useCoverArt(song, { enabled = true } = {}) {
  const ytArt = useMemo(() => youtubeThumb(song?.youtube), [song?.youtube]);
  const [spotifyResult, setSpotifyResult] = useState({ key: null, url: null });
  const [failedArt, setFailedArt] = useState({});

  useEffect(() => {
    const url = song?.spotify;
    if (!enabled || !url) return undefined;
    let cancelled = false;
    spotifyArt(url).then(img => { if (!cancelled) setSpotifyResult({ key: url, url: img }); });
    return () => { cancelled = true; };
  }, [song?.spotify, enabled]);

  const spotifyPending = enabled && !!song?.spotify && spotifyResult.key !== song?.spotify;
  const spotifyUrl = spotifyResult.key === song?.spotify ? spotifyResult.url : null;
  const artUrl = [spotifyUrl, spotifyPending ? null : ytArt].find(u => u && !failedArt[u]) || null;

  const markFailed = (u) => setFailedArt(prev => ({ ...prev, [u]: true }));
  return { artUrl, markFailed, loading: spotifyPending };
}
