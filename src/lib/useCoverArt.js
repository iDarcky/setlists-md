import { useState, useEffect, useMemo } from 'react';
import { youtubeThumb, spotifyArt } from './coverArt';

// Shared cover-art resolver (same priority as the Song Hub: Spotify album art →
// YouTube thumbnail → caller's placeholder). YouTube is derived synchronously;
// Spotify goes through the cover-art edge function and is cached per URL for the
// session. Only fires the (network) Spotify lookup when the song actually has a
// Spotify link, so a link-less library makes zero requests.
export function useCoverArt(song) {
  const ytArt = useMemo(() => youtubeThumb(song?.youtube), [song?.youtube]);
  const [spotifyResult, setSpotifyResult] = useState({ key: null, url: null });
  const [failed, setFailed] = useState({});

  useEffect(() => {
    const url = song?.spotify;
    if (!url) return undefined;
    let cancelled = false;
    spotifyArt(url).then(img => { if (!cancelled) setSpotifyResult({ key: url, url: img }); });
    return () => { cancelled = true; };
  }, [song?.spotify]);

  const spotifyPending = !!song?.spotify && spotifyResult.key !== song?.spotify;
  const spotifyUrl = spotifyResult.key === song?.spotify ? spotifyResult.url : null;
  const artUrl = [spotifyUrl, spotifyPending ? null : ytArt].find(u => u && !failed[u]) || null;

  const markFailed = (u) => setFailed(prev => ({ ...prev, [u]: true }));
  return { artUrl, markFailed };
}
