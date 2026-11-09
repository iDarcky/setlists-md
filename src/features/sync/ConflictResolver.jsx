import { Sheet } from '@/ui/shadcn/sheet';
import { Button } from '@/ui/shadcn/button';

// Short summary of one side of a conflict, so the two read differently at a
// glance.
function summarize(kind, item) {
  if (!item) return 'Not available';
  if (kind === 'song') {
    const arr = Array.isArray(item.arrangements) ? item.arrangements : [];
    const def = arr.find(a => a.id === item.defaultArrangementId) || arr[0];
    const bits = [];
    if (def?.key) bits.push(`Key ${def.key}`);
    if (def?.tempo) bits.push(`${def.tempo} BPM`);
    bits.push(`${arr.length} arrangement${arr.length === 1 ? '' : 's'}`);
    return bits.join(' · ');
  }
  const items = Array.isArray(item.items) ? item.items : [];
  const songs = items.filter(i => i?.type !== 'break').length;
  return `${songs} song${songs === 1 ? '' : 's'}`;
}

const Side = ({ label, text }) => (
  <div className="flex flex-col gap-1 rounded-card border border-border bg-raised p-3.5">
    <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</span>
    <span className="text-[14px] leading-5 text-foreground">{text}</span>
  </div>
);

/**
 * ConflictResolver — a sync pulled someone else's edit that collides with an
 * unsynced edit made here. Their copy is already in the library; ours is held
 * here so nothing is lost until the person picks. It cannot be dismissed
 * without a choice.
 *
 * @param {Array} conflicts — [{ kind, id, title, local, remote }]
 * @param {(conflict, choice) => void} onResolve — choice ∈ 'cloud' | 'mine' | 'both'
 * @param {(choice) => void} [onResolveAll] — 'cloud' | 'mine'
 */
export default function ConflictResolver({ conflicts = [], onResolve, onResolveAll }) {
  const conflict = conflicts[0];
  if (!conflict) return null;

  const { kind, title, local, remote } = conflict;
  const remaining = conflicts.length - 1;
  const noun = kind === 'song' ? 'song' : 'setlist';
  const name = title || `Untitled ${noun}`;

  return (
    <Sheet
      open
      onOpenChange={() => { /* a choice is required */ }}
      dismissible={false}
      title={`Two versions of “${name}”`}
      description={`Someone else changed this ${noun} while you were editing it.`}
      className="h-auto sm:max-w-[480px]"
    >
      <div className="flex flex-col gap-4">
        <p className="m-0 text-[15px] leading-[22px] text-muted-foreground">
          Someone else changed this {noun} while you were editing it on this device. Pick what to keep.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Side label="Yours" text={summarize(kind, local)} />
          <Side label="Theirs" text={summarize(kind, remote)} />
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={() => onResolve(conflict, 'both')}>Keep both</Button>
          <p className="m-0 text-center text-[13px] text-muted-foreground">Yours is saved as a copy next to theirs.</p>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => onResolve(conflict, 'mine')}>Keep mine</Button>
            <Button variant="outline" onClick={() => onResolve(conflict, 'cloud')}>Keep theirs</Button>
          </div>
        </div>
        {remaining > 0 && (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="m-0 text-center text-[13px] text-muted-foreground">
              {remaining} more like this.{onResolveAll ? ' Or decide them all at once:' : ''}
            </p>
            {onResolveAll && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => onResolveAll('mine')}>Keep all mine</Button>
                <Button variant="ghost" onClick={() => onResolveAll('cloud')}>Keep all theirs</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
