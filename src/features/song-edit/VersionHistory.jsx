import { useEffect, useState } from 'react';
import { Button } from '@/ui/shadcn/button';
import { loadSongVersions } from '@/lib/songVersions';

const when = (ts) => new Date(ts).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function summary(v) {
  if (v.doc?.arrangements?.length) {
    const a = v.doc.arrangements;
    return [v.doc.title, a.length > 1 ? `${a.length} arrangements` : a[0].key && `in ${a[0].key}`].filter(Boolean).join(' · ');
  }
  const t = (v.md || '').match(/^title:\s*(.+)$/m)?.[1]?.trim();
  const k = (v.md || '').match(/^key:\s*(.+)$/m)?.[1]?.trim();
  return [t, k && `in ${k}`].filter(Boolean).join(' · ');
}

/**
 * Earlier saves of this song. Restore puts one in the editor; nothing is kept
 * until Save, and Undo takes it back.
 */
export default function VersionHistory({ songId, teamId, nameOf, onRestore, onClose }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    let live = true;
    loadSongVersions({ teamId, songId }).then(v => { if (live) setList(v); });
    return () => { live = false; };
  }, [teamId, songId]);
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-label="Version history" onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[16px] border border-border bg-background font-sans text-foreground shadow-[0_16px_48px_rgba(0,0,0,.5)] sm:rounded-[16px]">
        <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <b className="flex-1 text-[16px] font-semibold">Version history</b>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}>
          {list == null ? (
            <p className="m-0 px-3 py-6 text-center text-[14px] text-muted-foreground">Loading…</p>
          ) : list.length === 0 ? (
            <p className="m-0 px-3 py-6 text-center text-[14px] text-muted-foreground">No earlier versions yet. Every save keeps one here.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {list.map((v, i) => (
                <li key={`${v.ts}-${i}`} className="flex items-center gap-3 rounded-control px-3 py-2.5 hover:bg-raised">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-medium">{when(v.ts)}{i === 0 && <span className="ml-2 rounded-full bg-raised px-1.5 text-[11px] font-medium text-muted-foreground">latest</span>}</span>
                    <span className="truncate text-[13px] text-muted-foreground">{[v.by && nameOf?.(v.by), summary(v)].filter(Boolean).join(' · ')}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => onRestore(v)}>Restore</Button>
                </li>
              ))}
            </ul>
          )}
          {list?.length > 0 && <p className="m-0 px-3 pb-2 pt-3 text-[12px] leading-4 text-muted-foreground">Restore puts that version in the editor. Nothing changes until you save, and Undo takes it back.</p>}
        </div>
      </div>
    </div>
  );
}
