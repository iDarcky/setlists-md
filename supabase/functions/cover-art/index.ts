// cover-art
//
// Resolves a song's cover image from a Spotify or YouTube link. Spotify's
// oEmbed endpoint doesn't send CORS headers, so the browser can't call it
// directly — this function fetches it server-side and returns the album art
// with permissive CORS. YouTube thumbnails are derived from the video id
// (the client can do that itself, but we handle it here too as a fallback).
//
// Deploy: `supabase functions deploy cover-art`
// (no secrets needed — it only calls public oEmbed / thumbnail URLs).
//
// Request:  POST { url: "https://open.spotify.com/track/…" | "https://youtu.be/…" }
// Response: { image: "https://…" | null }

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function ytThumb(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const { url } = await req.json().catch(() => ({ url: '' }));
    if (!url || typeof url !== 'string') return json({ image: null });

    let image: string | null = null;

    if (/open\.spotify\.com|spotify:/.test(url)) {
      const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, {
        headers: { 'User-Agent': 'setlists.md cover-art' },
      });
      if (r.ok) {
        const j = await r.json().catch(() => null);
        image = j?.thumbnail_url ?? null;
      }
    } else if (/youtu\.?be/.test(url)) {
      image = ytThumb(url);
    }

    return json({ image });
  } catch (e) {
    return json({ image: null, error: String((e as Error)?.message ?? e) }, 200);
  }
});
