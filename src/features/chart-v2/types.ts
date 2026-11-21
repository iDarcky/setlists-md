// The shapes the new chart reads. The data itself still comes from the
// JavaScript side (arrangements.js, songFlow.js), so these describe it rather
// than own it: if the stored shape changes, change it here first.

/** `{modulate: +2}` in a section body. */
export interface ModulateLine { type: 'modulate'; semitones: number; every?: boolean }
/** A guitar/bass tab block, drawn by the old TabBlock for now. */
export interface TabLine { type: 'tab'; instrument?: string; [key: string]: unknown }
export interface TabRefLine { type: 'tabref'; tab?: TabLine }

/**
 * One line of a section. The oldest trap in the app (CLAUDE.md): a line is
 * NOT always a string, so anything that calls `.trim()` must narrow first.
 */
export type Line = string | ModulateLine | TabLine | TabRefLine;

export interface Section {
  id?: string;
  type: string;
  lines: Line[];
  /** The band cue under the heading (`> Soft`). */
  note?: string;
}

/** One arrangement of a song, as `resolveSongView` returns it. */
export interface SongView {
  id: string;
  title: string;
  artist?: string;
  key?: string;
  tempo?: number | string;
  time?: string;
  sections: Section[];
  structure?: Array<string | { type: string }>;
  structureMode?: string;
  keyChanges?: unknown[];
}

export interface SetlistItem {
  songId?: string;
  songTitle?: string;
  arrangementId?: string;
  transpose?: number;
  type?: string;
  label?: string;
  placeholder?: boolean;
}

export interface Setlist { id: string; name: string; items: SetlistItem[] }

export type ChartMode = 'live' | 'practice';

/** A word on screen: the chord over it (if any) and its text. */
export interface Token { chord: string; text: string }

/** What one line draws as. */
export type LineView =
  | { kind: 'gap' }
  | { kind: 'lyrics'; groups: Token[][]; notes: string[]; hasChords: boolean }
  | { kind: 'bars'; chords: string[]; notes: string[] }
  | { kind: 'tab'; tab: TabLine }
  | { kind: 'skip' };

/** One play of a section in song order, ready to draw. */
export interface Play {
  slot: number;
  section: Section;
  /** 1 for the first time a section is played, 2 for the second… */
  nth: number;
  /** How many times in a row this section is played, on its first play. */
  runCount: number;
  /** Key offset (semitones) this play starts in, from key changes. */
  offset: number;
  marks: Array<{ line: number; semitones: number; offset: number }>;
}
