import { supabase } from '@/auth/supabase';
import { SONGS_FOLDER, SETLISTS_FOLDER } from './constants';

export function createSupabaseTeamProvider(teamId, { readOnly = false } = {}) {
  if (!teamId) throw new Error('Team ID is required for SupabaseTeamProvider');

  let _tokens = null;

  return {
    name: `supabase-team:${teamId}`,
    displayName: 'Team Library',

    async connect() {
      // Supabase is always connected via the global client auth session
      return { connected: true };
    },

    async disconnect() {
      // No-op for Supabase; auth state is handled globally
    },

    isConnected() {
      return true; // Assume true, let RLS fail if they aren't signed in
    },

    setTokens(tokens) {
      _tokens = tokens;
    },

    async refreshToken(tokens) {
      // Supabase JS client handles its own token refresh automatically.
      return tokens;
    },

    async ensureFolder() {
      // No-op. Postgres tables don't need folders.
      return 'root';
    },

    async listFiles(folder) {
      if (folder === SONGS_FOLDER) {
        const { data, error } = await supabase
          .from('team_songs')
          .select('id, title, updated_at')
          .eq('team_id', teamId);
          
        if (error) throw new Error(error.message);
        
        return (data || []).map(row => ({
          id: row.id,
          name: `${row.title}.md`,
          modifiedTime: new Date(row.updated_at).toISOString(),
          size: 0 // Not tracked, engine.js doesn't strictly need it for comparison
        }));
      }
      
      if (folder === SETLISTS_FOLDER) {
        const { data, error } = await supabase
          .from('team_setlists')
          .select('id, name, updated_at')
          .eq('team_id', teamId);
          
        if (error) throw new Error(error.message);
        
        return (data || []).map(row => ({
          id: row.id,
          name: `${row.name}.json`,
          modifiedTime: new Date(row.updated_at).toISOString(),
          size: 0
        }));
      }

      return [];
    },

    async downloadFile(fileId, folder) {
      // Use the folder hint to query the correct table directly.
      // Falls back to trying both tables if no hint is provided.
      const table = folder === SETLISTS_FOLDER ? 'team_setlists'
                  : folder === SONGS_FOLDER ? 'team_songs'
                  : null;

      if (table) {
        const { data, error } = await supabase
          .from(table)
          .select('content')
          .eq('id', fileId)
          .eq('team_id', teamId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (data?.content) {
          const c = data.content;
          return typeof c === 'string' ? c : JSON.stringify(c);
        }
        throw new Error(`File not found in ${table}: ${fileId}`);
      }

      // No folder hint — try songs, then setlists
      const { data, error } = await supabase
        .from('team_songs')
        .select('content')
        .eq('id', fileId)
        .eq('team_id', teamId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data?.content) return data.content;

      const { data: slData, error: slError } = await supabase
        .from('team_setlists')
        .select('content')
        .eq('id', fileId)
        .eq('team_id', teamId)
        .maybeSingle();
      if (slError) throw new Error(slError.message);

      if (slData?.content) {
        return typeof slData.content === 'string' ? slData.content : JSON.stringify(slData.content);
      }

      throw new Error(`File not found in Postgres: ${fileId}`);
    },

    async uploadFile(folder, name, content, mimeType, existingId) {
      // Members have read-only access — skip writes silently.
      if (readOnly) {
        console.log('[supabase-team] Read-only mode, skipping upload for:', name);
        return {
          id: existingId || 'read-only-skip',
          name,
          modifiedTime: new Date().toISOString()
        };
      }
      // engine.js passes the raw content. For setlists it's JSON, for songs it's Markdown.
      // We use existingId (the manifest's remoteId) as the primary key for updates.
      // Falls back to title/name lookup only for first-time uploads (no manifest entry yet).
      
      if (folder === SONGS_FOLDER) {
        const title = name.replace('.md', '');

        const payload = {
          team_id: teamId,
          title,
          content,
          updated_at: new Date().toISOString()
        };

        let data, error;

        if (existingId) {
          // Update by UUID — the manifest already knows this row
          const res = await supabase
            .from('team_songs')
            .update(payload)
            .eq('id', existingId)
            .eq('team_id', teamId)
            .select('id, title, updated_at')
            .maybeSingle();
          data = res.data;
          error = res.error;

          // If the row was deleted remotely (e.g. another member removed it),
          // fall through to insert a fresh row.
          if (!error && !data) {
            const ins = await supabase
              .from('team_songs')
              .insert(payload)
              .select('id, title, updated_at')
              .single();
            data = ins.data;
            error = ins.error;
          }
        } else {
          // First sync — check by title to avoid duplicates, then insert
          const { data: existing } = await supabase
            .from('team_songs')
            .select('id')
            .eq('team_id', teamId)
            .eq('title', title)
            .maybeSingle();

          if (existing) {
            const res = await supabase
              .from('team_songs')
              .update(payload)
              .eq('id', existing.id)
              .select('id, title, updated_at')
              .single();
            data = res.data;
            error = res.error;
          } else {
            const res = await supabase
              .from('team_songs')
              .insert(payload)
              .select('id, title, updated_at')
              .single();
            data = res.data;
            error = res.error;
          }
        }

        if (error) throw error;
        
        return {
          id: data.id,
          name: `${data.title}.md`,
          modifiedTime: new Date(data.updated_at).toISOString()
        };
      }
      
      if (folder === SETLISTS_FOLDER) {
        const slName = name.replace('.json', '');
        let parsedContent;
        try {
          parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
        } catch (e) {
          throw new Error(`Invalid setlist JSON for "${slName}": ${e.message}`);
        }

        const payload = {
          team_id: teamId,
          name: slName,
          content: parsedContent,
          updated_at: new Date().toISOString()
        };

        let data, error;

        if (existingId) {
          const res = await supabase
            .from('team_setlists')
            .update(payload)
            .eq('id', existingId)
            .eq('team_id', teamId)
            .select('id, name, updated_at')
            .maybeSingle();
          data = res.data;
          error = res.error;

          if (!error && !data) {
            const ins = await supabase
              .from('team_setlists')
              .insert(payload)
              .select('id, name, updated_at')
              .single();
            data = ins.data;
            error = ins.error;
          }
        } else {
          const { data: existing } = await supabase
            .from('team_setlists')
            .select('id')
            .eq('team_id', teamId)
            .eq('name', slName)
            .maybeSingle();

          if (existing) {
            const res = await supabase
              .from('team_setlists')
              .update(payload)
              .eq('id', existing.id)
              .select('id, name, updated_at')
              .single();
            data = res.data;
            error = res.error;
          } else {
            const res = await supabase
              .from('team_setlists')
              .insert(payload)
              .select('id, name, updated_at')
              .single();
            data = res.data;
            error = res.error;
          }
        }

        if (error) throw error;
        
        return {
          id: data.id,
          name: `${data.name}.json`,
          modifiedTime: new Date(data.updated_at).toISOString()
        };
      }
      
      throw new Error(`Unknown folder: ${folder}`);
    },

    async deleteFile(fileId) {
      // Members have read-only access — skip deletes silently.
      if (readOnly) {
        console.log('[supabase-team] Read-only mode, skipping delete for:', fileId);
        return;
      }
      // Try deleting from both
      await supabase.from('team_songs').delete().eq('id', fileId).eq('team_id', teamId);
      await supabase.from('team_setlists').delete().eq('id', fileId).eq('team_id', teamId);
    }
  };
}
