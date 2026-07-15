import { useState } from 'react';
import { lineToPlacement, placementToLine, extractInlineNotes } from '../../parser';
import { sectionStyle } from '../../music';
import { Button } from '../ui/Button';
import { serializeLine, serializeSectionLines } from './arrangeHelpers';

// Plain lyrics (chords + inline notes stripped) for the string lines only.
function lyricsOnly(lines) {
  return lines
    .filter(l => typeof l === 'string')
    .map(l => lineToPlacement(extractInlineNotes(l).clean).plainText)
    .join('\n');
}

// Merge edited plain-lyrics back onto the section, preserving each line's
// existing chords (clamped to the new text length) and any tab/modulate lines
// in place. Extra new lines become plain lyrics.
function mergeLyrics(originalLines, lyricsText) {
  const newLyrics = lyricsText.split('\n');
  const out = [];
  let p = 0;
  for (const line of originalLines) {
    if (typeof line !== 'string') { out.push(serializeLine(line)); continue; }
    const lyric = newLyrics[p] ?? '';
    p += 1;
    const { clean } = extractInlineNotes(line);
    const noteMatch = line.match(/\{!(.*?)\}/);
    const { chords } = lineToPlacement(clean);
    const clamped = chords.map(c => ({ chord: c.chord, pos: Math.min(c.pos, lyric.length) }));
    let merged = placementToLine({ plainText: lyric, chords: clamped });
    if (noteMatch) merged += ` {!${noteMatch[1]}}`;
    out.push(merged);
  }
  for (; p < newLyrics.length; p++) out.push(newLyrics[p]);
  return out.join('\n');
}

export default function SectionDrawer({ section, sectionIndex, onSave, onClose }) {
  const [tab, setTab] = useState('lyrics');
  const [lyricsText, setLyricsText] = useState(() => lyricsOnly(section.lines));
  const [rawText, setRawText] = useState(() => serializeSectionLines(section.lines));
  const s = sectionStyle(section.type);

  const save = () => {
    if (tab === 'lyrics') onSave(sectionIndex, mergeLyrics(section.lines, lyricsText));
    else onSave(sectionIndex, rawText);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/50" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 bg-[var(--ds-background-200)] border-t border-[var(--ds-gray-400)] rounded-t-xl flex flex-col"
        style={{ maxHeight: '70vh', boxShadow: '0 -8px 32px rgba(0,0,0,0.4)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ds-gray-300)]">
          <span className="text-label-14 font-black uppercase tracking-[0.15em]" style={{ color: s.b }}>
            {section.type}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="xs" onClick={onClose}>Cancel</Button>
            <Button variant="brand" size="xs" onClick={save}>Save</Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-2">
          {[{ id: 'lyrics', label: 'Lyrics' }, { id: 'chords', label: 'Lyrics + chords' }].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-label-12 font-semibold cursor-pointer border-none ${
                tab === t.id ? 'bg-[var(--ds-gray-200)] text-[var(--ds-gray-1000)]' : 'bg-transparent text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-auto p-4">
          {tab === 'lyrics' ? (
            <textarea
              autoFocus
              value={lyricsText}
              onChange={e => setLyricsText(e.target.value)}
              spellCheck
              placeholder="Just the words — chords stay where they are."
              className="w-full min-h-[30vh] bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-lg p-4 text-copy-14 leading-relaxed text-[var(--ds-gray-1000)] resize-y outline-none"
            />
          ) : (
            <textarea
              autoFocus
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              spellCheck={false}
              className="w-full min-h-[30vh] bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-lg p-4 text-copy-13 leading-relaxed text-[var(--ds-gray-1000)] resize-y outline-none font-mono"
              style={{ caretColor: 'var(--chord)' }}
            />
          )}
          <p className="text-copy-11 text-[var(--ds-gray-500)] mt-2 mb-0">
            {tab === 'lyrics'
              ? 'Editing words keeps your chords attached (nudged to fit). Switch to “Lyrics + chords” for full control.'
              : 'Raw format — [C]inline chords, {tab}…{/tab}, {modulate: +N}.'}
          </p>
        </div>
      </div>
    </div>
  );
}
