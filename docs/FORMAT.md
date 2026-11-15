# The .md song format

The interchange format: YAML frontmatter, `## Section` headers, `[Chord]lyrics`, `> cues`, `{tab}…{/tab}` and `{modulate}` markers. Parsed and written by `src/parser.js`. Moved out of CLAUDE.md on 2026-11-15; nothing here changed.

## Quick reference

```
---
title: Song Name
artist: Artist
key: C
tempo: 120
time: 4/4
capo: 2
structure: [Verse 1, Chorus, Bridge, Chorus]
ccli: "1234567"
tags: [worship, fast]
spotify: https://...
youtube: https://...
notes: Performance notes
---

## Verse 1
> Band cue text
[C]Lyrics with [G]inline chords
Plain lyrics line

## Chorus
{tab, time: 4/4}
e|--0--2--3--|
B|--1--3--5--|
G|--0--2--4--|
D|-----------|
A|--3--------|
E|-----------|
{/tab}
[Am]More [F]lyrics {!inline note}
{modulate: +2}
[Bm]Chords after modulate are shifted +2 semitones
```

## Modulate markers

Modulate markers shift all subsequent chords by N semitones. Parsed into
`{ type: 'modulate', semitones: N }` — plus `every: true` when the marker says so
— in `section.lines[]`. `modulateMarker()` / `serializeModulate()` in `parser.js`
keep the regex, the object and the text together.

```
{modulate: +2}          fires the FIRST time this section is played
{modulate: +2, every}   fires on every repeat (a chorus that climbs)
```

- **A marker lives in the section BODY, so a repeated section replays it.** That
  is why `every` exists: without it a chorus containing "+2" climbed a step every
  single time it was played, and "modulate, then repeat in the new key" — the
  commoner intention — was unsayable.
- `sectionModPlan()` (`lib/songFlow.js`) decides per SLOT and returns
  `{ offsets, fires }`. "First time" is per section BY IDENTITY, which works
  because `orderSections` resolves a repeat to the same object reference.
  `SectionBlock` takes `modFires` and must agree with it exactly — the incoming
  offset and the in-section offsets otherwise describe two different songs.
- An inert marker draws **no chip**: "↗ A" over a chorus that does not change key
  is the chart telling a story the chords do not support.
- `every` is **absent** rather than `false` on a bare marker. The sync engines
  hash these objects; a new always-present key would make every stored song look
  changed on the first load after it ships.
- Cumulative: multiple `{modulate}` markers stack across sections
- Applied at render time on top of user transpose and capo
- A solid `--chord` chip names the **arrival key**, not the interval
- Round-trip: serialized back through `serializeModulate()` in `songToMd()`

⚠ **A key change CAN belong to a slot now — and it is not these markers.**
"Chorus in C, Verse 2, Chorus in D" is unrepresentable in the body (`once` gives
you C then C, `every` climbs Verse 2 and everything after), so it is carried by
an **overlay on the arrangement** instead: `arrangement.keyChanges`, resolved
per slot by `src/lib/keyChanges.js`. That kept the `.md` format — and the
MAJOR-version conversation — out of it. `SectionBlock` takes `keyMarks`, and
when a caller passes an overlay the section's own `{modulate}` markers go
**silent** rather than drawing the same change twice; a song mid-conversion
carries both.

## Tab blocks

Tab blocks live inside sections. Parsed into `{ type: 'tab', strings: [{note, content}], time, raw }`.

- `strings` — array of `{ note: 'e'|'B'|'G'|'D'|'A'|'E', content: string }`
- `raw` — original lines preserved for round-trip serialization
- `time` — optional time signature from `{tab, time: 4/4}`
- Technique markers in content: `h` hammer-on, `p` pull-off, `s` slide, `b` bend, `x` mute, `~` vibrato

**Serialization**: `songToMd()` calls `serializeTabBlock(tab)` for tab objects in `section.lines[]`.
**FormTab**: Uses `serializeTabBlock` when converting `s.lines` to lyrics string (avoids `[object Object]`).
