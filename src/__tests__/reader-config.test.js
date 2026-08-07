import { describe, it, expect } from 'vitest';
import { resolveReaderConfig, readerSettingKey, READER_KNOBS } from '@/lib/readerConfig';

const wide = { wide: true };
const narrow = { wide: false };

describe('defaults', () => {
  it('resolves a usable config from nothing', () => {
    const c = resolveReaderConfig(undefined, wide);
    expect(c.ribbon).toBe('top');
    expect(c.sectionStyle).toBe('plain');
    expect(c.sticky).toBe(false);   // wide: pinning is a phone affordance
    expect(c.notes).toBe(true);
  });

  it('falls back to the default for a value this build does not understand', () => {
    const c = resolveReaderConfig({ readerSectionStyle: 'hologram' }, wide);
    expect(c.sectionStyle).toBe('plain');
  });
});

describe('settings drive it', () => {
  it.each(Object.keys(READER_KNOBS))('reads every documented value for %s', (knob) => {
    for (const value of READER_KNOBS[knob]) {
      // `sticky` only applies on a narrow screen, so read it there.
      const ctx = knob === 'sticky' ? narrow : wide;
      const c = resolveReaderConfig({ [readerSettingKey(knob)]: value }, ctx);
      // sticky/notes resolve to booleans; the rest pass through.
      const got = typeof c[knob] === 'boolean' ? (c[knob] ? 'on' : 'off') : c[knob];
      expect(got).toBe(value);
    }
  });

  it('reuses the existing app-wide keys rather than duplicating them', () => {
    expect(readerSettingKey('ribbon')).toBe('structurePosition');
    expect(readerSettingKey('repeats')).toBe('duplicateSections');
  });
});

describe('context overrides are physical facts, not preferences', () => {
  it('places a note by the room available', () => {
    // A note belongs to its line either way; only the treatment changes.
    // Wide: a dotted leader out to the edge of its ~594px column, which costs
    // nothing. Narrow: a reserved strip down the right — but ONLY in sections
    // that actually carry a note, which `ReaderSection` decides. A permanent
    // gutter measured +24% on the song's height (549px → 682px on a phone).
    // A GUTTER at every width, since 2026-08-06. The dotted leader owned wide
    // screens until it was seen at 1280 in two columns: a 594px column with an
    // ordinary lyric left ~400px of dots running across the page, which reads
    // as a divider, not a connection. One treatment also means one place where
    // a note's alignment has to be right.
    expect(resolveReaderConfig({}, wide).notePlacement).toBe('gutter');
    expect(resolveReaderConfig({}, narrow).notePlacement).toBe('gutter');
  });

  it('pins headings at ONE column, on any screen — and never at two', () => {
    // It used to be `!wide && …`, so the switch read ON and did nothing on
    // every device 768px and wider, including a one-column desktop and an iPad
    // in portrait. The owner tested exactly that. Sticky pins fine inside a
    // 2-column multicol (measured in Chromium), but two columns have no single
    // reading line for a pinned heading to answer to — the order runs down one
    // column and up the next — so that is the one place it stays off, and the
    // ☰ hides the switch there rather than lying about it.
    const on = { readerSticky: 'on' };
    expect(resolveReaderConfig(on, narrow).sticky).toBe(true);
    expect(resolveReaderConfig({ ...on, defaultColumns: 1 }, wide).sticky).toBe(true);
    expect(resolveReaderConfig({ ...on, defaultColumns: 2 }, wide).sticky).toBe(false);
    // 'auto' on a wide screen resolves to two columns, so it is off there too.
    expect(resolveReaderConfig(on, wide).sticky).toBe(false);
    expect(resolveReaderConfig({ readerSticky: 'off' }, narrow).sticky).toBe(false);
  });

  it('lands the retired frames on the one that replaced them', () => {
    // `block` and `card` boxed the text; `tint` is the same idea without the
    // box. A MAP, not `pick`'s fallback — the fallback is 'plain', which is no
    // frame at all, and neither user asked for that.
    expect(resolveReaderConfig({ readerSectionStyle: 'block' }, narrow).sectionStyle).toBe('tint');
    expect(resolveReaderConfig({ readerSectionStyle: 'card' }, narrow).sectionStyle).toBe('tint');
    expect(resolveReaderConfig({ readerSectionStyle: 'rule' }, narrow).sectionStyle).toBe('rule');
    expect(resolveReaderConfig({ readerSectionStyle: 'nonsense' }, narrow).sectionStyle).toBe('plain');
  });

  it('keeps a side ribbon on a phone, because it floats now', () => {
    // It used to collapse to 'top' here: a DOCKED 56px rail really did have
    // nowhere to live on a 390px screen. It floats over the chart now
    // (transparent, `pointer-events-none` except the chips), so it costs no
    // layout width and the phone can have it. Owner, 2026-08-01.
    const s = { structurePosition: 'left' };
    expect(resolveReaderConfig(s, narrow).ribbon).toBe('left');
    expect(resolveReaderConfig(s, wide).ribbon).toBe('left');
  });

  it('forces one column on a narrow screen', () => {
    expect(resolveReaderConfig({ defaultColumns: 2 }, narrow).columns).toBe(1);
    expect(resolveReaderConfig({ defaultColumns: 2 }, wide).columns).toBe(2);
  });

  it('marks itself embedded so the host can own the chrome', () => {
    expect(resolveReaderConfig({}, { wide: true, embedded: true }).embedded).toBe(true);
  });
});

describe('display still flows through chartDisplay', () => {
  it('keeps stage-mode notation and type sizes', () => {
    const c = resolveReaderConfig({ notation: 'nashville', defaultFontSize: 'L' }, wide);
    expect(c.display.notation).toBe('nashville');
    expect(c.display.lyricFontSize).toBe(22);
  });
});

// ── The view table ──────────────────────────────────────────────────────────
// A view is a template of the Reader; what differs between Live and Practice
// is which capabilities are on. These tests exist so the MECHANISM cannot
// regress silently — the values themselves are the owner's to set.
describe('view capabilities', () => {
  it('resolves a capability set for every mode, defaulting to live', () => {
    expect(resolveReaderConfig({}, { ...wide, mode: 'live' }).can).toBeTruthy();
    expect(resolveReaderConfig({}, { ...wide, mode: 'practice' }).can).toBeTruthy();
    // An unknown mode must not hand back `undefined` — every `config.can.x`
    // read would silently become "not allowed".
    expect(resolveReaderConfig({}, { ...wide, mode: 'nonsense' }).can)
      .toEqual(resolveReaderConfig({}, { ...wide, mode: 'live' }).can);
    expect(resolveReaderConfig({}, wide).can)
      .toEqual(resolveReaderConfig({}, { ...wide, mode: 'live' }).can);
  });

  it('separates live from practice where the owner has already decided', () => {
    const live = resolveReaderConfig({}, { ...wide, mode: 'live' }).can;
    const practice = resolveReaderConfig({}, { ...wide, mode: 'practice' }).can;
    // Element 21 — "This should be for the practice view".
    expect(live.switchArrangement).toBe(false);
    expect(practice.switchArrangement).toBe(true);
    // Element 22 — the gap is WRITING a note, and practice is where it happens.
    expect(live.writeNotes).toBe(false);
    expect(practice.writeNotes).toBe(true);
  });

  it('gives the hub view no capabilities at all — it is a browsing surface', () => {
    const can = resolveReaderConfig({}, { wide: true, embedded: true }).can;
    expect(Object.values(can).every(v => v === false)).toBe(true);
  });
});

// Element 28, round 11 — three knobs that had no control, and one new one.
describe('the knobs that reached the renderer but not the user', () => {
  it('resolves the flow and the two orphans', () => {
    const cfg = resolveReaderConfig({}, { wide: true });
    // Defaults are today's behaviour, so adding the controls changed nothing.
    expect(cfg.flow).toBe('down');
    expect(cfg.notes).toBe(true);
    expect(cfg.footer).toBe('next');

    const off = resolveReaderConfig(
      { readerFlow: 'across', readerNotes: 'off', readerFooter: 'count' },
      { wide: true },
    );
    expect(off.flow).toBe('across');
    expect(off.notes).toBe(false);
    expect(off.footer).toBe('count');
  });

  it('has no rail knob left to resolve', () => {
    // `readerRail` hid the strip the rail kept docked on a wide screen. The
    // strip is gone (2026-08-06) — the rail is nothing until the footer's
    // `x / x` counter asks for it — so the switch had nothing to turn off. A
    // knob whose reason for existing was removed is worse than no knob.
    expect(resolveReaderConfig({}, { wide: true }).rail).toBeUndefined();
    expect(resolveReaderConfig({ readerRail: 'off' }, { wide: true }).rail).toBeUndefined();
  });

  it('falls back to the default for a value that is not on the list', () => {
    const cfg = resolveReaderConfig({ readerFlow: 'sideways' }, { wide: true });
    expect(cfg.flow).toBe('down');
  });
});

// ── Element 3 — five ribbon styles became three, 2026-08-05 ────────────────
//
// Owner: "Boxes and Inline are kind of the same? Why not keeping boxes/Inline,
// Dots and Chips?" — so 'numbered' (Inline: the Boxes chip without its box) and
// 'dotlabel' (Dots with that chip's text beside it) are gone from the list.
describe('the ribbon style, and the two that were cut', () => {
  const styleOf = (ribbonStyle) => resolveReaderConfig({ ribbonStyle }, { wide: true }).ribbonStyle;

  it('keeps the three that survived', () => {
    expect(styleOf('codes')).toBe('codes');
    expect(styleOf('chips')).toBe('chips');
    expect(styleOf('dots')).toBe('dots');
  });

  it('lands a cut style on the one it was a variant of, not on the default', () => {
    // The whole point of the map. `pick`'s fallback sends everything to
    // 'codes', which would move a Dots + label user to boxes — a setting
    // silently changed to something they did not choose.
    expect(styleOf('numbered')).toBe('codes');
    expect(styleOf('dotlabel')).toBe('dots');
  });

  it('falls back to Boxes for anything it has never heard of', () => {
    expect(styleOf('sparkles')).toBe('codes');
    expect(styleOf(undefined)).toBe('codes');
  });
});
