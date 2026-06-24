import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';

// Short human-readable summary of a song/setlist version, used to help the
// user tell the two sides of a conflict apart at a glance.
function summarize(kind, item) {
  if (!item) return 'Unavailable';
  if (kind === 'song') {
    const arr = Array.isArray(item.arrangements) ? item.arrangements : [];
    const def = arr.find(a => a.id === item.defaultArrangementId) || arr[0];
    const bits = [];
    if (item.artist) bits.push(item.artist);
    if (def?.key) bits.push(`key ${def.key}`);
    bits.push(`${arr.length} arrangement${arr.length === 1 ? '' : 's'}`);
    return bits.join(' · ');
  }
  const items = Array.isArray(item.items) ? item.items : [];
  return `${items.length} song${items.length === 1 ? '' : 's'}`;
}

/**
 * ConflictResolver — surfaced when a sync pulls a remote edit that collides
 * with an unsynced local edit. The remote ("cloud") copy has already been
 * adopted into local state; the user's divergent local copy is held here so
 * no work is lost. The user explicitly chooses what to keep per item.
 *
 * @param {Array} conflicts — [{ kind, id, title, local, remote }]
 * @param {(conflict, choice) => void} onResolve — choice ∈ 'cloud' | 'mine' | 'both'
 */
export default function ConflictResolver({ conflicts = [], onResolve }) {
  const conflict = conflicts[0];
  if (!conflict) return null;

  const { kind, title, local, remote } = conflict;
  const remaining = conflicts.length - 1;
  const noun = kind === 'song' ? 'song' : 'setlist';

  return (
    <Dialog open onClose={() => {}} closeOnBackdrop={false} size="md" ariaLabel="Resolve sync conflict">
      <div className="p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-heading-18 font-semibold text-[var(--ds-gray-1000)] m-0">
            Sync conflict
          </h2>
          <p className="text-copy-13 text-[var(--ds-gray-700)] m-0">
            This {noun} — <strong>{title || `Untitled ${noun}`}</strong> — was edited both here and
            in the cloud since the last sync. Choose which version to keep.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] p-3 flex flex-col gap-1">
            <span className="text-copy-12 font-semibold uppercase tracking-wide text-[var(--ds-gray-600)]">Your version</span>
            <span className="text-copy-13 text-[var(--ds-gray-1000)]">{summarize(kind, local)}</span>
          </div>
          <div className="rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] p-3 flex flex-col gap-1">
            <span className="text-copy-12 font-semibold uppercase tracking-wide text-[var(--ds-gray-600)]">Cloud version</span>
            <span className="text-copy-13 text-[var(--ds-gray-1000)]">{summarize(kind, remote)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-1">
          <Button variant="brand" onClick={() => onResolve(conflict, 'both')}>
            Keep both (saves your copy separately)
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => onResolve(conflict, 'mine')}>
              Keep mine
            </Button>
            <Button variant="secondary" onClick={() => onResolve(conflict, 'cloud')}>
              Keep cloud
            </Button>
          </div>
        </div>

        {remaining > 0 && (
          <p className="text-copy-12 text-[var(--ds-gray-600)] text-center m-0">
            {remaining} more conflict{remaining === 1 ? '' : 's'} to review
          </p>
        )}
      </div>
    </Dialog>
  );
}
