import { buildSongFlow, repeatRuns } from '@/lib/songFlow';
import { resolveKeyChanges, fromBodyMarkers } from '@/lib/keyChanges';
import type { Play, Section, SongView } from './types';

interface Flow { ordered: Section[]; repeats: number[] }
interface KeyPlan { slotOffsets: number[]; slotMarks: Play['marks'][]; slotSignatures: unknown[] }
type Run = { lead: true; count: number; slots: number[] } | { lead: false } | null;

/**
 * The song in play order, every play written out (owner, 2026-11-17: "×2"
 * shows a second copy, not a pill). Each play knows which time it is and the
 * key it starts in, so a chorus after a key change shows the new chords.
 */
export function songPlays(song: SongView): Play[] {
  const { ordered, repeats } = buildSongFlow(song) as Flow;
  const stored = song.keyChanges;
  const overlay = Array.isArray(stored) && stored.length > 0 ? stored : fromBodyMarkers(ordered);
  const { slotOffsets, slotMarks } = resolveKeyChanges(ordered, overlay) as KeyPlan;
  const runs = repeatRuns(ordered, repeats) as Run[];
  const seen = new Map<number, number>();
  return ordered.map((section, slot) => {
    const first = repeats[slot] >= 0 ? repeats[slot] : slot;
    const nth = (seen.get(first) || 0) + 1;
    seen.set(first, nth);
    // A first play followed straight away by its own repeats carries the count.
    const next = runs[slot + 1];
    const runCount = repeats[slot] < 0 && next && next.lead && repeats[slot + 1] === slot ? 1 + next.count : 1;
    return { slot, section, nth, runCount, offset: slotOffsets[slot] ?? 0, marks: slotMarks[slot] || [] };
  });
}

/** The structure row: one box per run of plays ("Tag ×2" is one box). */
export interface StructureBox { slot: number; type: string; count: number; slots: number[] }

export function structureBoxes(plays: Play[]): StructureBox[] {
  const out: StructureBox[] = [];
  for (const p of plays) {
    const prev = out[out.length - 1];
    if (prev && p.nth > 1 && prev.type === p.section.type && prev.slots[prev.slots.length - 1] === p.slot - 1) {
      prev.count += 1;
      prev.slots.push(p.slot);
    } else {
      out.push({ slot: p.slot, type: p.section.type, count: 1, slots: [p.slot] });
    }
  }
  return out;
}
