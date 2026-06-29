import { supabase } from '../auth/supabase';

// Cover art resolution for a song, in priority order: Spotify → YouTube →
// (caller falls back to the gradient placeholder).
//
// - YouTube thumbnails are plain images derivable from the link client-side.
// - Spotify album art comes from its oEmbed endpoint, which doesn't send CORS
//   headers — so it goes through the `cover-art` Supabase edge function. When
//   Supabase isn't configured or the function isn't deployed, it returns null
//   and the caller falls through to YouTube / the placeholder.

// Bare id extractors — shared by the cover-art thumbnail and the embedded
// backing-track player (SongPlayerBar).
export function youtubeId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}

export function spotifyTrackId(url) {
  if (!url) return null;
  const m = String(url).match(/open\.spotify\.com\/(?:intl-[\w-]+\/)?track\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

export function youtubeThumb(url) {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export async function spotifyArt(url) {
  if (!url || !supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke('cover-art', { body: { url } });
    if (error) return null;
    return data?.image || null;
  } catch {
    return null;
  }
}
