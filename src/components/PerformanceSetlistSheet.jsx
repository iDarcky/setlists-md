import { transposeKey } from '../music';
import BottomSheet from './ui/BottomSheet';

// The setlist song list, shared by the landscape rail and the mobile/portrait
// bottom sheet so both stay in sync. `resolved` is the same enriched item array
// the player builds (songs, breaks, missing rows).
export function SetlistList({ resolved, idx, onSelect }) {
  // Songs are numbered by their song position; breaks are not numbered and
  // render as a labelled divider (matching the setlist overview) so they read
  // as pauses in the flow rather than another track. Numbers are precomputed
  // with a reduce accumulator (no mutable counter inside the render).
  const songNumberAt = resolved.reduce((acc, r, i) => {
    const prev = i === 0 ? 0 : acc[i - 1];
    acc.push(r.isBreak ? prev : prev + 1);
    return acc;
  }, []);
  return (
    <div className="flex flex-col gap-1">
      {resolved.map((r, i) => {
        const active = i === idx;

        if (r.isBreak) {
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              aria-current={active ? 'true' : undefined}
              aria-label={r.label || 'Break'}
              className={`flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors ${
                active ? 'bg-[var(--ds-gray-200)]' : 'hover:bg-[var(--ds-gray-100)]'
              }`}
            >
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)]">
                <span className="text-label-11 font-semibold text-[var(--ds-gray-800)]">{r.label || 'Break'}</span>
                {(r.duration || 0) > 0 && (
                  <>
                    <span className="w-[3px] h-[3px] rounded-full bg-[var(--ds-gray-600)]" aria-hidden="true" />
                    <span className="text-label-10 text-[var(--ds-gray-600)] tabular-nums">{r.duration} min</span>
                  </>
                )}
              </span>
              <span className="flex-1 border-t border-dashed border-[var(--ds-gray-400)]" aria-hidden="true" />
            </button>
          );
        }

        const title = r.isMissing ? 'Missing song' : r.song.title;
        const k = !r.isMissing ? transposeKey(r.song.key, r.transpose || 0) : null;
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            aria-current={active ? 'true' : undefined}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${
              active
                ? 'bg-[var(--color-brand)] text-white'
                : 'text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)]'
            }`}
          >
            <span className={`text-label-11-mono shrink-0 ${active ? 'text-white/80' : 'text-[var(--ds-gray-500)]'}`}>
              {String(songNumberAt[i]).padStart(2, '0')}
            </span>
            <span className="flex-1 min-w-0 truncate text-copy-14">{title}</span>
            {k && (
              <span className={`text-label-11-mono shrink-0 ${active ? 'text-white/90' : 'text-[var(--chord)]'}`}>{k}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Bottom-sheet wrapper used on mobile / portrait tablet where the side rail
// has no room. Selecting a song closes the sheet.
export default function PerformanceSetlistSheet({ open, onClose, title, resolved, idx, onSelect }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title || 'Setlist'}>
      <SetlistList
        resolved={resolved}
        idx={idx}
        onSelect={(i) => { onSelect(i); onClose?.(); }}
      />
    </BottomSheet>
  );
}
