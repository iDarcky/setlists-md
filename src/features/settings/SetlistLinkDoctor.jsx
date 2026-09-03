import { useMemo, useState } from 'react';
import { Button } from '@/ui/Button';
import { analyzeSetlistLinks } from '@/lib/setlistLinks';

// Setlist-link diagnostic. A setlist item references a song by a snapshotted
// `songId`; if that song was later re-imported (new id) the item orphans. The
// load-time `healSetlistLinks` pass auto-fixes items whose stored title still
// matches a song and backfills missing titles — so in a healthy library the
// "re-linkable" bucket reads zero here. What remains is what data alone can't
// fix: songs that no longer exist (re-import them) and old items with no title
// stored (unrecoverable snapshot).

function Stat({ n, label, tone }) {
  return (
    <div className="rounded-lg border border-[var(--ds-gray-300)] px-3 py-2 flex-1 min-w-[92px]">
      <div className="text-heading-20 font-bold" style={{ color: tone }}>{n}</div>
      <div className="text-label-12 text-[var(--ds-gray-700)]">{label}</div>
    </div>
  );
}

function IssueList({ title, rows, hint }) {
  if (!rows.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="text-copy-13 font-medium text-[var(--ds-gray-1000)]">{title}</div>
      {hint && <div className="text-copy-13 text-[var(--ds-gray-600)]">{hint}</div>}
      {rows.map((r, i) => (
        <div key={`${r.setlist}:${r.songId}:${i}`} className="rounded-lg border border-[var(--ds-gray-300)] px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-copy-13 font-medium text-[var(--ds-gray-1000)] truncate">{r.title || 'Untitled item'}</span>
            <span className="text-label-12 text-[var(--ds-gray-600)] shrink-0">{r.setlist}{r.date ? ` · ${r.date}` : ''}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SetlistLinkDoctor({ songs = [], setlists = [], onRepair }) {
  const [busy, setBusy] = useState(false);
  const report = useMemo(() => analyzeSetlistLinks(setlists, songs), [setlists, songs]);
  const { counts, missing, untitled, relinkable } = report;

  const clean = counts.relinkable === 0 && counts.missing === 0 && counts.untitled === 0;

  const handleRepair = async () => {
    if (!onRepair) return;
    setBusy(true);
    try { await onRepair(); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-copy-14 font-medium text-[var(--ds-gray-1000)]">Setlist links</div>
          <div className="text-copy-13 text-[var(--ds-gray-700)]">
            Checks that every setlist song still points at a real song in this library.
          </div>
        </div>
        {counts.relinkable > 0 && onRepair && (
          <Button size="sm" variant="secondary" loading={busy} onClick={handleRepair}>
            Repair {counts.relinkable}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Stat n={counts.linked} label="linked" tone="var(--ds-green-700)" />
        <Stat n={counts.relinkable} label="re-linkable" tone={counts.relinkable ? 'var(--ds-amber-700)' : 'var(--ds-gray-700)'} />
        <Stat n={counts.missing} label="song missing" tone={counts.missing ? 'var(--ds-red-800)' : 'var(--ds-gray-700)'} />
        <Stat n={counts.untitled} label="no title" tone={counts.untitled ? 'var(--ds-red-800)' : 'var(--ds-gray-700)'} />
      </div>

      {clean && (
        <div className="text-copy-13 text-[var(--ds-green-800)]">
          ✓ All {counts.total} setlist songs resolve to a song in this library.
        </div>
      )}

      {counts.relinkable > 0 && (
        <IssueList
          title="Re-linkable (fixed automatically on next load)"
          hint="These items match a song by title and will re-link themselves; tap Repair to do it now."
          rows={relinkable}
        />
      )}
      <IssueList
        title="Song no longer in the library"
        hint="Re-import the song (keeping its title) and these items re-link automatically."
        rows={missing}
      />
      <IssueList
        title="No title stored — can't auto-recover"
        hint="These items predate title snapshots; re-add the song to the setlist manually."
        rows={untitled}
      />
    </div>
  );
}
