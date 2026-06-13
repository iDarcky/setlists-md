import { transposeKey } from '../music';
import BottomSheet from './ui/BottomSheet';

// The setlist song list, shared by the landscape rail and the mobile/portrait
// bottom sheet so both stay in sync. `resolved` is the same enriched item array
// the player builds (songs, breaks, missing rows).
export function SetlistList({ resolved, idx, onSelect }) {
  return (
    <div className="flex flex-col gap-1">
      {resolved.map((r, i) => {
        const active = i === idx;
        const title = r.isBreak ? (r.label || 'Break') : (r.isMissing ? 'Missing song' : r.song.title);
        const k = (!r.isBreak && !r.isMissing) ? transposeKey(r.song.key, r.transpose || 0) : null;
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
              {String(i + 1).padStart(2, '0')}
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
