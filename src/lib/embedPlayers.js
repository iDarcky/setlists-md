// Loaders for the YouTube IFrame Player API and the Spotify iframe API.
//
// Both let us drive playback (play/pause/seek) and read position/duration from
// OUR OWN transport controls, with the platform's native player UI hidden. Each
// API script is injected once and its "ready" promise is memoised, so multiple
// SongPlayerBar mounts share a single load.

const scriptPromises = {};
function loadScript(src) {
  if (scriptPromises[src]) return scriptPromises[src];
  scriptPromises[src] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { delete scriptPromises[src]; reject(new Error(`Failed to load ${src}`)); };
    document.head.appendChild(s);
  });
  return scriptPromises[src];
}

// Resolves with `window.YT` once `YT.Player` is constructable. On failure the
// memoised promise is cleared so a later call can retry (a one-off block or a
// flaky load shouldn't poison the API for the rest of the session).
let ytPromise;
export function ensureYouTubeApi() {
  if (ytPromise) return ytPromise;
  ytPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      resolve(window.YT);
    };
    loadScript('https://www.youtube.com/iframe_api').catch(reject);
  }).catch((e) => { ytPromise = undefined; throw e; });
  return ytPromise;
}

// Resolves with the Spotify `IFrameAPI` factory. Same retry-on-failure memo.
let spotifyPromise;
export function ensureSpotifyApi() {
  if (spotifyPromise) return spotifyPromise;
  spotifyPromise = new Promise((resolve, reject) => {
    if (window.SpotifyIframeApi) return resolve(window.SpotifyIframeApi);
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      window.SpotifyIframeApi = IFrameAPI;
      resolve(IFrameAPI);
    };
    loadScript('https://open.spotify.com/embed/iframe-api/v1').catch(reject);
  }).catch((e) => { spotifyPromise = undefined; throw e; });
  return spotifyPromise;
}

// A YouTube video's length in seconds, read by cueing it in a player that is
// never shown or played (nothing plays, so no visible-player rule applies).
// null when the API is blocked, the video is private, or it takes over 8 s.
export async function youtubeDuration(videoId) {
  if (!videoId || typeof document === 'undefined') return null;
  const YT = await ensureYouTubeApi().catch(() => null);
  if (!YT) return null;
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;width:200px;height:200px;';
    const slot = document.createElement('div');
    host.appendChild(slot);
    document.body.appendChild(host);
    let player; let tries = 0; let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      clearTimeout(limit);
      try { player?.destroy(); } catch { /* already gone */ }
      host.remove();
      resolve(v);
    };
    const limit = setTimeout(() => finish(null), 8000);
    const read = () => {
      const d = Math.round(player?.getDuration?.() || 0);
      if (d > 0) finish(d);
      else if (++tries < 20) setTimeout(read, 250);
      else finish(null);
    };
    try {
      player = new YT.Player(slot, {
        width: 200, height: 200, videoId,
        playerVars: { autoplay: 0, controls: 0 },
        events: { onReady: read, onError: () => finish(null) },
      });
    } catch { finish(null); }
  });
}

/** 225 → "3:45". */
export const formatLength = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
