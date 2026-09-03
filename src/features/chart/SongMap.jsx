import { transposeChord, sectionStyle, sectionLabel } from '@/music';
import { parseLine } from '@/parser';

// Distinct, consecutive chords used in a section (transposed), so the map can
// show each section's harmonic shape at a glance without the full lyrics.
function sectionChords(section, semitones) {
  const out = [];
  for (const line of section.lines || []) {
    if (typeof line !== 'string') continue; // skip tab / modulate objects
    for (const seg of parseLine(line)) {
      if (!seg.chord) continue;
      const ch = transposeChord(seg.chord, semitones);
      if (out[out.length - 1] !== ch) out.push(ch);
    }
  }
  return out;
}

// First non-empty lyric snippet, used when a section has no chords (e.g. a
// spoken/acapella part) so the card still says something useful.
function firstLyric(section) {
  for (const line of section.lines || []) {
    if (typeof line !== 'string') continue;
    const text = parseLine(line).map(s => s.text).join('').trim();
    if (text) return text;
  }
  return '';
}

// Song map — a condensed, scannable overview of the song's section flow. Each
// section is a card with its colour, label, and chord shape. Tapping a card
// jumps back into the chord view at that section.
export default function SongMap({
  sections,
  modOffsets = [],
  transpose = 0,
  sectionColors,
  sectionLabels,
  customSectionTypes,
  onSelect,
}) {
  if (!sections?.length) {
    return (
      <div className="wide-container py-10 text-center text-copy-14 text-[var(--text-2)]">
        This arrangement has no sections yet.
      </div>
    );
  }

  return (
    <div className="wide-container pb-8">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
        {sections.map((section, idx) => {
          const s = sectionStyle(section.type, sectionColors, customSectionTypes);
          const semitones = transpose + (modOffsets[idx] || 0);
          const chords = sectionChords(section, semitones);
          const label = sectionLabel(section.type, sectionLabels) || section.type;
          const lyric = chords.length === 0 ? firstLyric(section) : '';
          return (
            <button
              key={`${section.id || section.type}-${idx}`}
              type="button"
              onClick={() => onSelect?.(idx)}
              className="text-left rounded-xl border bg-[var(--ds-background-100)] p-3 cursor-pointer transition-colors hover:bg-[var(--ds-gray-100)]"
              style={{ borderColor: 'var(--ds-gray-400)', borderLeft: `3px solid ${s.bar || s.fg || 'var(--ds-gray-500)'}` }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded text-label-10 font-bold shrink-0"
                  style={{ background: s.bg || 'var(--ds-gray-100)', color: s.fg || 'var(--ds-gray-1000)' }}
                >
                  {s.l || (label[0] || '?').toUpperCase()}
                </span>
                <span className="text-label-13 font-semibold text-[var(--text-1)] truncate">{label}</span>
              </div>
              {chords.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {chords.map((c, i) => (
                    <span key={i} className="text-label-12 font-mono font-bold text-[var(--chord)]">{c}</span>
                  ))}
                </div>
              ) : (
                <p className="m-0 text-copy-12 text-[var(--text-2)] line-clamp-2">
                  {lyric || '—'}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
