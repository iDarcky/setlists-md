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
