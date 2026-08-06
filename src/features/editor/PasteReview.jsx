import { useMemo, useState } from 'react';
import { Button } from '@/ui/Button';
import PopMenu from '@/ui/PopMenu';
import { inferSections } from '@/lib/detectSections';
import { sectionStyle } from '@/music';

// Review a pasted song before it becomes a chart.
//
// A lyrics site gives you blank-line-separated blocks and no labels. We infer
// the labels by repetition — a block that comes back is the chorus, whatever
// order it arrives in — and then show every one of them so they can be
// corrected. That's the answer to "this song starts on the chorus": you don't
// tell us up front, you fix the one chip that's wrong.
//
// Guesses are dashed, deductions are solid, so it's obvious which labels the
// app actually has evidence for.

const TYPES = [
  'Intro', 'Verse', 'Pre Chorus', 'Chorus', 'Bridge',
  // 'Ending' is NOT here (2026-08-06). It and 'Outro' were one thing under two
  // names, so it is retired from every picker and kept only as an alias in
  // `music.js` — a file that already says `## Ending` still reads correctly.
  'Instrumental', 'Interlude', 'Tag', 'Vamp', 'Outro', 'Refrain',
];

// Number same-typed blocks in order: Verse, Verse → Verse 1, Verse 2.
function numberTypes(blocks) {
  const totals = {};
  for (const b of blocks) totals[b.type] = (totals[b.type] || 0) + 1;
  const seen = {};
  return blocks.map(b => {
    seen[b.type] = (seen[b.type] || 0) + 1;
    // A type used once needs no number; Chorus repeated is still just "Chorus"
    // (one section, played more than once — the play order carries repeats).
    const needsNumber = totals[b.type] > 1 && b.type !== 'Chorus' && b.type !== 'Refrain';
    return { ...b, label: needsNumber ? `${b.type} ${seen[b.type]}` : b.type };
  });
}

// Strip any trailing number the inference added, so the chip menu compares types.
const baseType = (t) => String(t || '').replace(/\s*\d+$/, '').trim();

export default function PasteReview({ text, onApply, onEditText }) {
  const initial = useMemo(() => inferSections(text).map(s => ({
    lines: s.lines,
    type: baseType(s.type),
    confident: s.confident,
    repeat: s.repeat || 1,
  })), [text]);

  const [blocks, setBlocks] = useState(initial);
  // Re-derive when the source text changes (toggling "Fix spacing"), but keep
  // the user's chip edits otherwise — useState's initial value is a first-render
  // thing. Same render-phase sync idiom as MetadataPanel.
  const [syncedInitial, setSyncedInitial] = useState(initial);
  if (initial !== syncedInitial) {
    setSyncedInitial(initial);
    setBlocks(initial);
  }
  const numbered = useMemo(() => numberTypes(blocks), [blocks]);

  const setType = (i, type) => setBlocks(bs => bs.map((b, j) => (j === i ? { ...b, type, confident: true } : b)));
  const removeBlock = (i) => setBlocks(bs => bs.filter((_, j) => j !== i));
  const mergeUp = (i) => setBlocks(bs => bs.flatMap((b, j) => {
    if (j === i) return [];
    if (j === i - 1) return [{ ...b, lines: [...b.lines, ...bs[i].lines] }];
    return [b];
  }));

  const summary = numbered.map(b => b.label).join(' · ');

  const apply = () => {
    const body = numbered.map(b => `## ${b.label}\n${b.lines.join('\n')}`).join('\n\n');
    // A repeat mark means one section played N times — so it belongs in the
    // play order, not in duplicated lyrics. Only send an order when something
    // actually repeats; otherwise the order stays derived from the sections.
    const structure = numbered.some(b => b.repeat > 1)
      ? numbered.flatMap(b => Array.from({ length: b.repeat }, () => b.label))
      : null;
    onApply(`${body}\n`, { structure });
  };

  if (blocks.length === 0) {
    return (
      <div className="flex-1 min-h-0 grid place-items-center p-6 text-center">
        <div>
          <p className="text-copy-14 text-[var(--ds-gray-700)] m-0">Nothing left to import.</p>
          <div className="mt-3 flex items-center justify-center">
            <Button variant="secondary" size="sm" onClick={onEditText}>Back to text</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* One header: what we read, and how sure we are. */}
      <div className="shrink-0 pb-2.5">
        <p className="text-copy-14 text-[var(--ds-gray-1000)] m-0 font-semibold">
          {numbered.length} {numbered.length === 1 ? 'section' : 'sections'}
        </p>
        <p className="text-copy-12 text-[var(--ds-gray-600)] m-0 mt-0.5">
          {summary}
        </p>
        <p className="text-label-11 text-[var(--ds-gray-500)] m-0 mt-1.5">
          A solid label repeats in the song. A dashed one is a guess — tap it to change.
          {numbered.some(b => b.repeat > 1) && ' A ×2 badge is a repeat mark we read out of the text.'}
        </p>
      </div>

      {/* The song. Every line in full — this is the thing being checked. */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5">
        {numbered.map((b, i) => {
          const st = sectionStyle(b.type, null, []);
          return (
            <div
              key={i}
              className="shrink-0 rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)]"
            >
              <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-[var(--ds-gray-200)]">
                <PopMenu
                  align="left"
                  menuClassName="w-48 max-h-[50vh]"
                  trigger={
                    <button
                      type="button"
                      title="Change this section's type"
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-label-12 font-bold uppercase tracking-wider cursor-pointer bg-transparent ${
                        b.confident ? 'border border-solid' : 'border border-dashed'
                      }`}
                      style={{ color: st.b, borderColor: st.b }}
                    >
                      {b.label}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
                    </button>
                  }
                >
                  {TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(i, t)}
                      className="w-full text-left px-3 py-2 text-label-13 font-bold uppercase tracking-wider cursor-pointer bg-transparent border-none hover:bg-[var(--ds-gray-alpha-100)]"
                      style={{ color: sectionStyle(t, null, []).b }}
                    >
                      {t}
                    </button>
                  ))}
                </PopMenu>

                {b.repeat > 1 && (
                  <span
                    className="shrink-0 text-label-11 font-mono font-bold px-1.5 py-0.5 rounded border border-[var(--color-brand-border)] text-[var(--color-brand-text)]"
                    title={`The source marked this to be sung ${b.repeat} times — it'll appear ${b.repeat} times in the play order.`}
                  >
                    ×{b.repeat}
                  </span>
                )}

                <span className="ml-auto flex items-center gap-1">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => mergeUp(i)}
                      title="Join this block onto the one above"
                      className="px-2 py-1 rounded-md text-label-11 text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-100)] bg-transparent border-none cursor-pointer"
                    >
                      Join up
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeBlock(i)}
                    title="Drop this block — site credits, ads, anything that isn't the song"
                    className="px-2 py-1 rounded-md text-label-11 text-[var(--ds-gray-600)] hover:text-[var(--ds-red-700)] hover:bg-[var(--ds-gray-100)] bg-transparent border-none cursor-pointer"
                  >
                    Drop
                  </button>
                </span>
              </div>
              <pre className="m-0 px-3 py-2.5 text-copy-13 font-mono leading-relaxed whitespace-pre-wrap break-words text-[var(--ds-gray-1000)]">
                {b.lines.join('\n')}
              </pre>
            </div>
          );
        })}
      </div>

      {/* One footer: both ways out, side by side. */}
      <div className="shrink-0 flex items-center justify-end gap-2 pt-3">
        <Button variant="secondary" size="md" onClick={onEditText}>Back to text</Button>
        <Button variant="brand" size="md" onClick={apply}>Turn into chart</Button>
      </div>
    </div>
  );
}
