import { useState, useEffect } from 'react';
import { Button } from '@/ui/Button';
import { supabase } from '@/auth/supabase';
import { getSyncState } from '@/sync/tokens';
import { canonicalSongHash, stableStringify } from '@/sync/canonical';
import { parseSongMd, songToMd } from '@/parser';

// Sync doctor — on-device diagnostic for a team library. For every song it
// compares three fingerprints: the LOCAL copy (canonical hash of its
// serialized markdown), the SERVER row (canonical hash of the stored
// content), and the BASELINE this device last synced (the manifest hash).
// That's exactly the arithmetic the engine runs, so what the doctor reports
// is what the next sync will do — including naming the drifting fields when
// local and server disagree, which turns "sync is being weird" into a
// specific, reportable finding.

// Identity handles + tab library are excluded from the canonical hash; keep
// the diff aligned with it.
const EXCLUDED_FIELDS = ['tabLibrary', 'id', 'songId', 'arrangementId'];

function hashableShape(md) {
  const parsed = parseSongMd(md);
  for (const k of EXCLUDED_FIELDS) delete parsed[k];
  return parsed;
}

// Top-level fields whose canonical form differs between two markdown bodies;
// sections get a per-section drill so "sections" alone isn't the answer.
function diffFields(localMd, serverMd) {
  const a = hashableShape(localMd);
  const b = hashableShape(serverMd);
  const out = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (stableStringify(a[key]) === stableStringify(b[key])) continue;
    if (key === 'sections') {
      const max = Math.max(a.sections?.length || 0, b.sections?.length || 0);
      for (let i = 0; i < max; i++) {
        if (stableStringify(a.sections?.[i]) !== stableStringify(b.sections?.[i])) {
          out.push(`section ${i + 1} (${a.sections?.[i]?.type || b.sections?.[i]?.type || '?'})`);
        }
      }
    } else {
      out.push(key);
    }
  }
  return out;
}

async function runDiagnosis(teamId, songs) {
  const state = await getSyncState(teamId);
  const manifest = state?.syncManifest || {};

  const { data: rows, error } = await supabase
    .from('team_songs')
    .select('id, song_key, content, updated_at')
    .eq('team_id', teamId)
    .order('id')
    .limit(1000);
  if (error) throw new Error(error.message);

  const serverById = new Map();
  for (const row of rows || []) {
    let itemId = row.song_key;
    if (!itemId) {
      try { itemId = parseSongMd(row.content).id; } catch { itemId = row.id; }
    }
    serverById.set(itemId || row.id, row);
  }

  const items = [];
  const counts = { inSync: 0, pendingPush: 0, pendingPull: 0, diverged: 0, localOnly: 0, serverOnly: 0 };
  const seen = new Set();

  for (const song of songs) {
    seen.add(song.id);
    const row = serverById.get(song.id);
    if (!row) {
      counts.localOnly += 1;
      items.push({ id: song.id, title: song.title, status: 'localOnly' });
      continue;
    }
    const localMd = songToMd(song);
    const localHash = canonicalSongHash(localMd);
    const serverHash = canonicalSongHash(row.content);
    const baseline = manifest[song.id]?.lastSyncedHash ?? null;
    if (localHash === serverHash) {
      counts.inSync += 1;
      continue;
    }
    const localDirty = baseline == null || localHash !== baseline;
    const serverDirty = baseline == null || serverHash !== baseline;
    const status = localDirty && serverDirty ? 'diverged' : localDirty ? 'pendingPush' : 'pendingPull';
    counts[status] += 1;
    items.push({ id: song.id, title: song.title, status, fields: diffFields(localMd, row.content) });
  }

  for (const [itemId, row] of serverById) {
    if (seen.has(itemId)) continue;
    counts.serverOnly += 1;
    items.push({ id: itemId, title: row.content?.match?.(/\ntitle:\s*([^\n]+)/)?.[1] || 'Untitled', status: 'serverOnly' });
  }

  return { counts, items, truncated: (rows || []).length === 1000 };
}

const STATUS_LABELS = {
  localOnly: { label: 'Only on this device', tone: 'var(--ds-amber-800)', hint: 'Uploads on the next sync.' },
  serverOnly: { label: 'Only on the server', tone: 'var(--ds-amber-800)', hint: 'Downloads on the next sync.' },
  pendingPush: { label: 'Local edits waiting', tone: 'var(--ds-blue-700)', hint: 'Pushes on the next sync.' },
  pendingPull: { label: 'Newer on the server', tone: 'var(--ds-blue-700)', hint: 'Pulls on the next sync.' },
  diverged: { label: 'Diverged (will conflict)', tone: 'var(--ds-red-800)', hint: 'Both sides changed since the last sync — the next sync raises a conflict prompt.' },
};

// "Watch the watcher" row: the notify-worker (push + nudges) runs on a
// minutely cron; if its heartbeat is stale, notifications are silently dead
// and someone should look at the edge function logs / cron.job_run_details.
export function WorkerHealthRow() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_worker_health');
        if (cancelled) return;
        if (error) throw new Error(error.message);
        setHealth(data || {});
      } catch {
        if (!cancelled) setHealth({});
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (health === null) return null; // loading — keep the panel calm
  const lastRun = health.worker_last_run ? new Date(health.worker_last_run) : null;
  const ageMin = lastRun ? Math.round((Date.now() - lastRun.getTime()) / 60000) : null;
  // The worker runs every minute; >10 min of silence means it's stuck.
  const stale = ageMin == null || ageMin > 10;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-copy-14 font-medium text-[var(--ds-gray-1000)]">Notification worker</div>
        <div className="text-copy-13 text-[var(--ds-gray-700)]">
          Sends push notifications and schedule nudges every minute.
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-2 h-2 rounded-full" style={{ background: stale ? 'var(--ds-red-700)' : 'var(--ds-green-500)' }} />
        <span className="text-copy-13" style={{ color: stale ? 'var(--ds-red-800)' : 'var(--ds-gray-700)' }}>
          {lastRun
            ? (ageMin <= 1 ? 'ran just now' : `ran ${ageMin} min ago`)
            : 'no heartbeat yet'}
        </span>
      </div>
    </div>
  );
}

export default function SyncDoctor({ teamId, songs = [] }) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(await runDiagnosis(teamId, songs));
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const problems = report?.items || [];
  const allClear = report && problems.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-copy-14 font-medium text-[var(--ds-gray-1000)]">Sync doctor</div>
          <div className="text-copy-13 text-[var(--ds-gray-700)]">
            Compares every song on this device against the team cloud and names any differences.
          </div>
        </div>
        <Button size="sm" variant="secondary" loading={busy} onClick={run}>
          {report ? 'Run again' : 'Run check'}
        </Button>
      </div>

      {error && (
        <div className="text-copy-13 text-[var(--ds-red-800)]">Check failed: {error}</div>
      )}

      {allClear && (
        <div className="text-copy-13 text-[var(--ds-green-800)]">
          ✓ All {report.counts.inSync} songs match the team cloud exactly.
        </div>
      )}

      {report && !allClear && (
        <div className="flex flex-col gap-2">
          <div className="text-copy-13 text-[var(--ds-gray-700)]">
            {report.counts.inSync} in sync · {problems.length} needing attention
            {report.truncated ? ' (first 1000 server rows checked)' : ''}
          </div>
          {problems.map((item) => {
            const meta = STATUS_LABELS[item.status] || { label: item.status, tone: 'var(--ds-gray-700)' };
            return (
              <div key={`${item.status}:${item.id}`} className="rounded-lg border border-[var(--ds-gray-300)] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-copy-13 font-medium text-[var(--ds-gray-1000)] truncate">{item.title || 'Untitled'}</span>
                  <span className="text-label-12 shrink-0" style={{ color: meta.tone }}>{meta.label}</span>
                </div>
                {meta.hint && <div className="text-copy-13 text-[var(--ds-gray-600)]">{meta.hint}</div>}
                {item.fields?.length > 0 && (
                  <div className="text-copy-13 text-[var(--ds-gray-600)] mt-1">
                    Differs in: {item.fields.join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
