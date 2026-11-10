import { supabase } from '@/auth/supabase';
import { loadVersions } from '@/storage';

/**
 * Earlier saves of a song, newest first: the server's copies (every save by
 * anyone in the Space, kept 30 per song by a database trigger) when this
 * Space syncs, else the ones this device kept. Each is
 * { ts, by (user id | null), doc (whole song) | null, md (one arrangement) | null, where: 'cloud' | 'device' }.
 */
export async function loadSongVersions({ teamId, songId }) {
  if (!songId) return [];
  if (supabase && teamId) {
    try {
      const { data, error } = await supabase
        .from('team_song_versions')
        .select('created_at, author_id, doc, content')
        .eq('team_id', teamId)
        .eq('song_key', songId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!error && data?.length) {
        return data.map(r => ({ ts: Date.parse(r.created_at), by: r.author_id || null, doc: r.doc || null, md: r.content || null, where: 'cloud' }));
      }
    } catch { /* offline: fall back to this device */ }
  }
  const local = await loadVersions(songId);
  return local.slice().reverse().map(v => ({ ts: v.ts, by: null, doc: v.doc || null, md: v.md || null, where: 'device' }));
}
