import { extractInlineNotes } from '@/parser';
import { sectionLabel } from '@/music';

/**
 * Collect everything note-shaped out of a song, in playback order.
 *
 * Three kinds, and they are genuinely different things:
 *  - **cue** — `> Start soft`, a band instruction attached to a section
 *  - **inline** — `{!Full band}`, attached to a point inside a line
 *  - **song notes** — the arrangement's own markdown, handled by the caller
 *
 * ⚠️ Known limitation: a cue lives on the *section*, but a structure can play
 * that section more than once. "Chorus 1: full band / Chorus 2: acapella" has
 * nowhere to live in the current .md format — both plays share one `note`.
 * Occurrences are numbered here so the repeat is at least visible; the fix is
 * numbered cues in the format (`> 2: Acapella`) and is deliberately not in
 * this pass.
 */
export function collectNotes(ordered, settings) {
  const seen = new Map();
  const out = [];

  (ordered || []).forEach((section, idx) => {
    const label = sectionLabel(section.type, settings?.sectionLabels);
    const occurrence = (seen.get(label) || 0) + 1;
    seen.set(label, occurrence);

    const inline = [];
    (section.lines || []).forEach(line => {
      // section.lines can hold strings, tab objects or modulate objects.
      if (typeof line !== 'string') return;
      extractInlineNotes(line).notes.forEach(t => inline.push(t));
    });

    if (section.note || inline.length) {
      out.push({ index: idx, label, occurrence, repeated: false, cue: section.note || '', inline });
    }
  });

  const totals = new Map();
  out.forEach(e => totals.set(e.label, Math.max(totals.get(e.label) || 0, e.occurrence)));
  return out.map(e => ({ ...e, repeated: (totals.get(e.label) || 1) > 1 }));
}
