import { useMemo } from 'react';
import { collectNotes } from '@/lib/readerNotes';
import NoteContent from '@/ui/NoteContent';

/**
 * The right-hand note margin. Costs about 25% of the width, so
 * `resolveReaderConfig` only ever hands it a wide screen.
 */
export default function ReaderNotes({ ordered, settings, songNotes, activeSection, onSelect }) {
  const entries = useMemo(() => collectNotes(ordered, settings), [ordered, settings]);

  if (!entries.length && !songNotes) return null;

  return (
    <aside
      className="shrink-0 w-[13.5rem] overflow-y-auto border-l px-3 py-3.5"
      style={{
        borderColor: 'var(--chart-rule, var(--ds-gray-300))',
        background: 'color-mix(in srgb, var(--color-brand) 4%, transparent)',
      }}
      aria-label="Notes and cues"
    >
      {entries.length > 0 && (
        <>
          <h4 className="m-0 mb-2 text-label-10 font-bold uppercase tracking-[0.16em] text-[var(--color-brand)]">
            Cues
          </h4>
          <ul className="list-none m-0 p-0 flex flex-col gap-3 mb-5">
            {entries.map(e => (
              <li key={e.index}>
                <button
                  type="button"
                  onClick={() => onSelect?.(e.index)}
                  className={`w-full text-left bg-transparent border-none p-0 cursor-pointer ${
                    activeSection === e.index ? 'opacity-100' : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <span className="block text-label-11 font-semibold text-[var(--chart-text,var(--ds-gray-1000))]">
                    {e.label}{e.repeated ? ` (${e.occurrence})` : ''}
                  </span>
                  {e.cue && (
                    <span className="block text-copy-12 leading-snug text-[var(--chart-subtle,var(--ds-gray-700))]">
                      {e.cue}
                    </span>
                  )}
                  {e.inline.map((t, i) => (
                    <span
                      key={i}
                      className="block text-copy-12 leading-snug text-[var(--chart-subtle,var(--ds-gray-700))] italic"
                    >
                      {t}
                    </span>
                  ))}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {songNotes && (
        <>
          <h4 className="m-0 mb-2 text-label-10 font-bold uppercase tracking-[0.16em] text-[var(--color-brand)]">
            Song notes
          </h4>
          <div className="text-copy-12 leading-snug text-[var(--chart-subtle,var(--ds-gray-700))]">
            <NoteContent text={songNotes} />
          </div>
        </>
      )}
    </aside>
  );
}
