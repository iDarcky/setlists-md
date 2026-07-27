import { useMemo, useState } from 'react';
import { Button } from '../ui/Button';
import PopMenu from '../ui/PopMenu';
import { inferSections } from '../../lib/detectSections';
import { rejoinSplitWords } from '../../lib/cleanPastedText';
import { sectionStyle } from '../../music';

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
  'Instrumental', 'Interlude', 'Tag', 'Vamp', 'Outro', 'Ending', 'Refrain',
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

export default function PasteReview({ text, onApply, onEditText, onCancel }) {
  // Words the source split with a real space ("mul țumesc"). Only joins the
  // song itself vouches for are offered, and it stays the user's call.
  const [joined, setJoined] = useState(false);
  const repair = useMemo(() => rejoinSplitWords(text), [text]);
  const working = joined ? repair.text : text;

  const initial = useMemo(() => inferSections(working).map(s => ({
    lines: s.lines,
    type: baseType(s.type),
    confident: s.confident,
  })), [working]);

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
    onApply(`${body}\n`);
  };

  if (blocks.length === 0) {
    return (
      <div className="flex-1 min-h-0 grid place-items-center p-6 text-center">
        <div>
          <p className="text-copy-14 text-[var(--ds-gray-700)] m-0">Nothing left to import.</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={onEditText}>Back to the text</Button>
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="shrink-0 flex items-center gap-2 flex-wrap">
        <p className="text-copy-13 text-[var(--ds-gray-700)] m-0 flex-1 min-w-0">
          <span className="font-semibold">{numbered.length} sections</span>
          <span className="text-[var(--ds-gray-600)]"> — {summary}</span>
        </p>
        <Button variant="ghost" size="sm" onClick={onEditText}>Edit the text</Button>
      </div>

      <p className="shrink-0 text-label-11 text-[var(--ds-gray-500)] m-0">
        Solid labels repeat in the song, so we're confident. Dashed ones are a
        guess — tap any of them to change it.
      </p>

      {repair.joins.length > 0 && (
        <div className="shrink-0 flex items-center gap-2 rounded-lg border border-[var(--ds-amber-400)] bg-[var(--ds-amber-100)] px-3 py-2">
          <span className="text-copy-12 text-[var(--ds-amber-1000)] flex-1 min-w-0">
            {joined
              ? `Joined ${repair.joins.length} split ${repair.joins.length === 1 ? 'word' : 'words'} — e.g. “${repair.joins[0].from}” → “${repair.joins[0].to}”.`
              : `${repair.joins.length} ${repair.joins.length === 1 ? 'word looks' : 'words look'} split by a stray space — e.g. “${repair.joins[0].from}” → “${repair.joins[0].to}”.`}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setJoined(v => !v)}>
            {joined ? 'Undo' : 'Fix spacing'}
          </Button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-0.5">
        {numbered.map((b, i) => {
          const st = sectionStyle(b.type, null, []);
          return (
            <div
              key={i}
              className="rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] overflow-hidden"
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
              <pre className="m-0 px-3 py-2 text-copy-13 font-mono whitespace-pre-wrap break-words text-[var(--ds-gray-1000)]">
                {b.lines.join('\n')}
              </pre>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <span className="ml-auto" />
        <Button variant="brand" size="sm" onClick={apply}>Turn into chart</Button>
      </div>
    </div>
  );
}
