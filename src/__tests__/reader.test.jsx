// The reader, mounted — elements 1–6 only.
//
// Scope is deliberate. An earlier cut carried presets, paging, a tools bar and
// a note column before the element-by-element design had settled any of them,
// which buried the decisions that HAD been made. These tests cover exactly the
// six elements that are designed, so the next one has a clean floor to build on.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Reader from '@/features/reader/Reader';
import { songFromFlat } from '@/arrangements';

// ⚠ Element 5 moved the click and Edit out of the top bar and into the
// floating action (owner, 2026-08-09: *"move everything else there"*). The
// contract these tests encode is unchanged — Edit exists in practice, not in
// live, not in a read-only library — it is just one tap deeper. This is that
// tap, in one place.
const openSongActions = () => {
  const fab = screen.queryByRole('button', { name: 'Song actions' });
  if (fab) fireEvent.click(fab);
};


// The Aa popover gates Pro chart styling behind useEntitlement -> useTeam,
// which needs a provider the app supplies at its root but a unit render does not.
vi.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => ({ allowed: true, requiredPlan: 'free', currentPlan: 'free' }),
  checkEntitlement: () => true,
}));

// jsdom has no matchMedia; the reader uses it for the wide/narrow split.
//
// It answers PER QUERY, against a real width. The old version returned one
// boolean for every query, which was fine while the reader asked exactly one
// question ("am I wide?") and became wrong the moment element 28 added a second
// (the ☰'s sheet/popover split): a desktop mock answered `true` to both, so the
// desktop tests were exercising the phone shape.
function mockWidth(px) {
  const w = px === true ? 1024 : px === false ? 390 : px;
  window.innerWidth = w;
  window.matchMedia = vi.fn().mockImplementation(query => {
    const min = /min-width:\s*([\d.]+)px/.exec(query);
    const max = /max-width:\s*([\d.]+)px/.exec(query);
    const matches = (!min || w >= parseFloat(min[1])) && (!max || w <= parseFloat(max[1]));
    return { matches, media: query, addEventListener: () => {}, removeEventListener: () => {} };
  });
}
beforeEach(() => { mockWidth(true); });

function makeSong(over = {}) {
  return songFromFlat({
    id: 'song-1',
    title: 'Amazing Grace',
    artist: 'John Newton',
    key: 'G',
    tempo: 90,
    time: '3/4',
    structure: ['Verse 1', 'Chorus', 'Verse 2', 'Chorus'],
    sections: [
      { type: 'Verse 1', note: 'Start soft', lines: ['A[G]mazing [G7]grace, how [C]sweet the [G]sound'] },
      { type: 'Chorus', note: 'Full band', lines: ['[C]Praise the [G]Lord{!lift}'] },
      { type: 'Verse 2', lines: ["T'was [G]grace that [G7]taught my [C]heart"] },
    ],
    ...over,
  });
}
const renderReader = (props = {}) =>
  render(<Reader song={makeSong()} settings={{}} onExit={() => {}} {...props} />);

describe('element 1 — top bar', () => {
  it('is one row: menu, title, key, tempo/time, exit', () => {
    renderReader();
    expect(screen.getByRole('button', { name: 'Display options' })).toBeTruthy();
    expect(screen.getByText('Amazing Grace')).toBeTruthy();
    // 'G' is also a chord in the chart, so assert the two facts that are
    // unique to the bar. The key control itself is covered by the transpose test.
    expect(screen.getByText('♩90')).toBeTruthy();
    expect(screen.getByText('3/4')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Exit' })).toBeTruthy();
  });

  it('always offers a way out', () => {
    const onExit = vi.fn();
    renderReader({ onExit });
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    expect(onExit).toHaveBeenCalled();
  });

  it('always shows the title — element 1 is fixed, with no density knob', () => {
    // A stored density of 'min' used to hide it, which is a setting nobody
    // asked for silently breaking the one thing the bar is for.
    render(<Reader song={makeSong()} settings={{ readerHeader: 'min' }} onExit={() => {}} />);
    expect(screen.getByText('Amazing Grace')).toBeTruthy();
  });

  it('hands the chrome to the hub when embedded', () => {
    renderReader({ embedded: true });
    expect(screen.queryByRole('button', { name: 'Display options' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Exit' })).toBeNull();
  });

});

describe('the chart-theme token remap', () => {
  it('never lets a custom property name itself in its own fallback', () => {
    // `--ds-gray-1000: var(--chart-text, var(--ds-gray-1000))` is a dependency
    // cycle. CSS counts a var() inside a fallback, so the property is invalid
    // at computed-value time and becomes UNSET for the whole subtree — which
    // is how the header title lost its colour and rendered invisible.
    renderReader();
    const root = document.querySelector('[data-section-index]')
      .closest('div[style]').parentElement.closest('div[style*="--bg-1"]')
      || document.body.firstElementChild.firstElementChild;
    const inline = root.getAttribute('style') || '';
    for (const decl of inline.split(';')) {
      const [rawProp, ...rest] = decl.split(':');
      const prop = rawProp.trim();
      if (!prop.startsWith('--')) continue;
      expect(rest.join(':')).not.toContain(`var(${prop}`);
    }
  });
});

describe('element 2 — structure ribbon', () => {
  it('renders and can be hidden', () => {
    const r = renderReader();
    const before = document.querySelectorAll('[data-section-index]').length;
    expect(before).toBe(4);   // structure plays Chorus twice
    r.unmount();

    render(<Reader song={makeSong()} settings={{ structurePosition: 'off' }} onExit={() => {}} />);
    expect(document.querySelectorAll('[data-section-index]').length).toBe(before);
  });
});

describe('element 3 — section heading', () => {
  it('pins on a phone when asked, and never on a desktop', () => {
    mockWidth(false);
    let r = render(<Reader song={makeSong()} settings={{ readerSticky: 'on' }} onExit={() => {}} />);
    expect(document.querySelector('[data-section-index] > div').style.position).toBe('sticky');
    r.unmount();

    r = render(<Reader song={makeSong()} settings={{ readerSticky: 'off' }} onExit={() => {}} />);
    expect(document.querySelector('[data-section-index] > div').style.position).toBe('');
    r.unmount();

    // Desktop: pinning is off regardless of the setting.
    mockWidth(true);
    render(<Reader song={makeSong()} settings={{ readerSticky: 'on' }} onExit={() => {}} />);
    expect(document.querySelector('[data-section-index] > div').style.position).toBe('');
  });

  it('offers the original all-caps heading alongside name and code', () => {
    render(<Reader song={makeSong()} settings={{ readerHeading: 'caps' }} onExit={() => {}} />);
    // The old chart wrote "VERSE 1:" — same text as `name`, different weight.
    expect(screen.getAllByText('Verse 1:').length).toBeGreaterThan(0);
  });

  it('switches between the name and the ribbon code', () => {
    const r = render(<Reader song={makeSong()} settings={{ readerHeading: 'name' }} onExit={() => {}} />);
    expect(screen.getAllByText('Verse 1').length).toBeGreaterThan(0);
    r.unmount();

    render(<Reader song={makeSong()} settings={{ readerHeading: 'code' }} onExit={() => {}} />);
    expect(screen.getAllByText('V1').length).toBeGreaterThan(0);
  });

  it('changes the frame with the section style — and none of them takes width', () => {
    // Redesigned 2026-08-06. A frame says only WHERE THE SECTION'S COLOUR
    // LIVES; `block` and `card` are gone because they boxed the text (a Card
    // chorus on a 390px phone spent 58px before a lyric started). The rule this
    // asserts is the one that matters: no frame adds side padding to the
    // section, so the words start in the same place under all four.
    const sec = () => document.querySelector('[data-section-index]');
    const frame = () => sec().style;

    let r = render(<Reader song={makeSong()} settings={{ readerSectionStyle: 'bar' }} onExit={() => {}} />);
    // The bar hangs in the MARGIN, absolutely positioned — not a border with
    // padding beside it, which cost 15px of lyric width to show a 3px mark.
    expect(frame().borderLeft).toBeFalsy();
    expect(frame().position).toBe('relative');
    expect(sec().querySelector('span[aria-hidden="true"]').style.position).toBe('absolute');
    r.unmount();

    r = render(<Reader song={makeSong()} settings={{ readerSectionStyle: 'tint' }} onExit={() => {}} />);
    // Edge to edge: the tint pulls out to the chart's own padding and pushes it
    // back in, so it bleeds to the screen instead of drawing a box.
    expect(frame().background).toBeTruthy();
    expect(frame().borderRadius).toBeFalsy();
    // Read the attribute, not the CSSOM: jsdom drops `calc(-1 * var(…))` on
    // parse, so `style.marginLeft` comes back empty for a value React really
    // did write.
    expect(sec().getAttribute('style')).toContain('--chart-pad-left');
    r.unmount();

    r = render(<Reader song={makeSong()} settings={{ readerSectionStyle: 'rule' }} onExit={() => {}} />);
    // The hairline is on the HEADING row, not around the section.
    expect(frame().borderBottom).toBeFalsy();
    expect(document.querySelector('[data-section-anchor]').style.borderBottom).toBeTruthy();
    r.unmount();

    // 'plain' is the original chart's look: the heading carries the section,
    // with no rule beside it. Still the default.
    render(<Reader song={makeSong()} settings={{ readerSectionStyle: 'plain' }} onExit={() => {}} />);
    expect(frame().borderLeft).toBeFalsy();
    expect(frame().background).toBeFalsy();
  });

  it('renders a repeat as a reference pill, and in full when asked', () => {
    // The reference is the PDF export's pill now — `↩ Chorus`, tappable to jump
    // to the first one — rather than a heading plus "— as before".
    let r = render(<Reader song={makeSong()} settings={{ duplicateSections: 'ref' }} onExit={() => {}} />);
    expect(screen.getAllByRole('button', { name: /same as before/i }).length).toBe(1);
    r.unmount();

    render(<Reader song={makeSong()} settings={{ duplicateSections: 'full' }} onExit={() => {}} />);
    expect(screen.queryByRole('button', { name: /same as before/i })).toBeNull();
  });

  it('condensed repeats use the SAME pill, not SectionBlock’s full-width box', () => {
    // `condensed` used to fall through to SectionBlock, which drew a bordered
    // box that outweighed the sections it stood in for.
    render(<Reader song={makeSong()} settings={{ duplicateSections: 'condensed' }} onExit={() => {}} />);
    expect(screen.getAllByRole('button', { name: /same as before/i }).length).toBe(1);
  });
});

describe('the sticky chrome', () => {
  it('pins section headings BELOW the header, not underneath it', () => {
    mockWidth(false);
    renderReader({ settings: { readerSticky: 'on' } });
    const head = document.querySelector('[data-section-index] > div');
    expect(head.style.position).toBe('sticky');
    // `top` is the measured header height. jsdom reports 0 for it, but the
    // value must come from the measurement, not a hard-coded 0 literal —
    // assert the scroll offset uses it too.
    expect(head.style.top).toBeDefined();
  });

  it('offsets a section jump by the header height', () => {
    renderReader();
    const sec = document.querySelector('[data-section-index]');
    // scrollMarginTop is headH + 8; jsdom measures 0, so 8px is the floor.
    expect(sec.style.scrollMarginTop).toBe('8px');
  });
});

describe('element 4 — band cue', () => {
  it('shows on the heading line and can be turned off', () => {
    const r = renderReader();
    expect(screen.getAllByText('Start soft').length).toBeGreaterThan(0);
    r.unmount();

    render(<Reader song={makeSong()} settings={{ readerNotes: 'off' }} onExit={() => {}} />);
    expect(screen.queryByText('Start soft')).toBeNull();
  });

  it('renders a loud cue differently', () => {
    // Their team writes "!!! sing up an octave !!!" because the format has no
    // emphasis. A leading ! is that convention, made real.
    const song = songFromFlat({
      id: 's', title: 'T', key: 'G',
      sections: [{ type: 'Verse 1', note: '!Sing up an octave', lines: ['[G]a'] }],
    });
    render(<Reader song={song} settings={{}} onExit={() => {}} />);
    const el = screen.getAllByText('!Sing up an octave')[0];
    expect(el.style.fontStyle).toBe('normal');
    expect(el.style.fontWeight).toBe('600');
  });
});

describe('elements 5–6 — notes and chords', () => {
  it('renders chords above the lyrics', () => {
    renderReader();
    expect(screen.getAllByText('G').length).toBeGreaterThan(0);
    // Lyrics split into per-word spans so a line only wraps at a space.
    expect(screen.getAllByText(/mazing/).length).toBeGreaterThan(0);
  });

  it('transposes on a key change', () => {
    renderReader({ selectedKey: 'A' });
    expect(screen.getAllByText('A').length).toBeGreaterThan(0);
  });

  it('sets both font-size vars — chords size off the var, not inherited size', () => {
    render(<Reader song={makeSong()} settings={{ defaultFontSize: 'L', chordFontSize: 13 }} onExit={() => {}} />);
    // The whole surface is one scroll container now, so the vars live on the
    // song wrapper between it and the sections.
    // The vars live on the same element as the width constraint and columns.
    const body = document.querySelector('[data-section-index]').parentElement;
    expect(body.style.getPropertyValue('--chart-font-size-lyric')).toBe('22px');
    expect(body.style.getPropertyValue('--chart-font-size-chord')).toBe('13px');
  });
});

describe('the ☰ menu', () => {
  it('opens the reader\'s own menu, with the chart still visible behind it', () => {
    renderReader();
    expect(screen.queryByRole('dialog', { name: 'Reader menu' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    expect(screen.getByRole('dialog', { name: 'Reader menu' })).toBeTruthy();
    // The panel rule: the chart it changes stays on screen.
    expect(document.querySelectorAll('[data-section-index]').length).toBe(4);
  });

  it('is three tabs and no more, and Notes is not one of them', () => {
    renderReader();
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    ['Style', 'Layout', 'Music'].forEach(label => {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    });
    // Cut rows, each for a recorded reason (READER.md → "Cut down to three").
    expect(screen.queryByText('Jump to')).toBeNull();
    expect(screen.queryByText('Practice')).toBeNull();
    expect(screen.queryByText('Fix it')).toBeNull();
    expect(screen.queryByText('Share')).toBeNull();
    expect(screen.queryByText('The screen')).toBeNull();
    // Notes went to the setlist rail (owner, 2026-08-04) — element 29.
    expect(screen.queryByRole('button', { name: 'Notes' })).toBeNull();
  });

  it('opens straight into a panel, with no root list and nothing to go back to', () => {
    renderReader();
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    // Zero taps to the first panel, not one. Style is open on arrival.
    expect(screen.getAllByText('Theme').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();

    // And every other panel is one tap from it, in either direction.
    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    // 4+ options are dropdowns now; 2–3 stay as pills.
    expect(screen.getByLabelText('Structure style')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Uppercase' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Style' }));
    expect(screen.getAllByText('Theme').length).toBeGreaterThan(0);
  });

  it('does not put the song title in the menu — the top bar already says it', () => {
    renderReader();
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    // One "Amazing Grace" on screen: the top bar's. The root list is a list,
    // not a page with a header.
    expect(screen.getAllByText('Amazing Grace').length).toBe(1);
  });

  // ── Element 28, round 1 — the shell ───────────────────────────────────────

  it('wears the READER theme, not the app theme', () => {
    renderReader();
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    const panel = screen.getByRole('dialog', { name: 'Reader menu' });
    // It portals to document.body, so it inherits nothing from the reader's
    // subtree and has to carry the remap itself. Without this it was an
    // app-coloured panel with `--chord` and `--chart-text` leaking into it.
    expect(panel.style.getPropertyValue('--ds-background-100')).toBe('var(--chart-bg, #ffffff)');
    expect(panel.style.getPropertyValue('--text-1')).toBe('var(--chart-text, #111111)');
    // Hover must NOT collapse onto the panel's own colour, which is what
    // chartSurface's --bg-2 would have done.
    expect(panel.style.getPropertyValue('--bg-2')).toContain('color-mix');
  });

  it('shows Columns at 768 and not below — the control matches where it applies', () => {
    mockWidth(false);
    const { unmount } = renderReader();
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    fireEvent.click(screen.getByText('Layout'));
    // 700–767 (iPad mini portrait is 744) used to show a switch that wrote a
    // setting resolveReaderConfig then forced back to 1.
    expect(screen.queryByText('Columns')).toBeNull();
    unmount();

    mockWidth(true);
    renderReader();
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    fireEvent.click(screen.getByText('Layout'));
    expect(screen.getByText('Columns')).toBeTruthy();
  });

  // Owner, 2026-08-05: "the default column is one and if I press the reset it
  // goes from two → one but it doesn't change."
  //
  // Both halves were one lie. `defaultColumns` is 'auto' until you touch it and
  // `resolveColumns('auto', wide)` is TWO, but the control compared against
  // `settings.defaultColumns === 2` and so said One over a two-column chart.
  // Reset then wrote 'auto' — where it already was — so the highlight moved and
  // the chart could not.
  it('shows the columns the chart is ACTUALLY in, and offers no reset', () => {
    mockWidth(true);
    // No stored value: 'auto' on a wide screen resolves to two.
    renderReader({ settings: {} });
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    fireEvent.click(screen.getByText('Layout'));
    expect(screen.getByRole('button', { name: 'Two' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'One' }).getAttribute('aria-pressed')).toBe('false');

    // A Reset here could only ever put back the value the control is already
    // showing, so there is nothing for it to do.
    const row = screen.getByText('Columns').closest('div').parentElement;
    expect(row.textContent).not.toContain('Reset');
  });

  it('groups the Style tab, and pairs two controls to a row', () => {
    renderReader();
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    // Eleven fields in one column was a list you read rather than a panel you
    // aim at — the same objection that cut the root menu from nine rows.
    ['Lyrics', 'Chords', 'Spacing', 'Tabs'].forEach(g => {
      expect(screen.getByText(g)).toBeTruthy();
    });
  });

  it('uses ONE pill, at the reader size, on every tab', () => {
    renderReader();
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    // Style's pills were `Pick` and Layout's were the concept mockup's own
    // `Seg` — two pill styles at two sizes in one menu. And both were sized for
    // a browsing panel, not for a music stand at arm's length (owner,
    // 2026-08-04: "everything is way too small").
    const stylePill = screen.getByRole('button', { name: 'S' });
    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    const layoutPill = screen.getByRole('button', { name: 'Uppercase' });
    expect(stylePill.className).toContain('h-11');
    expect(layoutPill.className).toContain('h-11');
    // The steppers take the same size.
    fireEvent.click(screen.getByRole('button', { name: 'Style' }));
    expect(screen.getByRole('button', { name: 'Increase lyric size' }).className).toContain('h-11');
  });

  it('groups Layout, and gives the two orphaned knobs a home at last', () => {
    renderReader();
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    ['Page', 'Sections', 'Structure', 'Navigation'].forEach(g => {
      expect(screen.getByText(g)).toBeTruthy();
    });
    // `readerNotes` and `readerFooter` were WIRED and read by the renderer, and
    // had no control anywhere in the app — permanently stuck at their defaults.
    // The cue and the inline note are two settings now, not one.
    expect(screen.getByRole('switch', { name: 'Band cues' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Inline notes' })).toBeTruthy();
    // "Bottom bar" is both the Controls value and the field below it, which
    // only exists while that value is chosen.
    expect(screen.getAllByText('Bottom bar').length).toBe(2);
    // The rail's own switch is gone with the strip it used to hide (2026-08-06):
    // the rail draws nothing until the footer's `x / x` counter opens it, so
    // there is no longer anything for a "Setlist rail: off" to mean.
    expect(screen.queryByRole('switch', { name: 'Setlist rail' })).toBeNull();
  });

  it('moved "In a pinch" to Music, as what it actually is', () => {
    renderReader();
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    // Nobody could tell what the name meant, and it is not a layout choice.
    expect(screen.queryByText('In a pinch')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Music' }));
    // It is `displayMode` — the same setting as "show chords" — so it sits
    // beside the instrument picker that writes it.
    expect(screen.getByText('Show')).toBeTruthy();
    expect(screen.getByLabelText('What the chart shows')).toBeTruthy();
  });

  it('does not offer a Reset for a value that IS the default', () => {
    // Picking the option that is already the default still writes the key, so
    // comparing against `undefined` alone put a Reset on a change nobody made
    // (owner: "even if I select the current option I still get the reset").
    render(<Reader song={makeSong()} onExit={() => {}}
      settings={{ readerHeading: 'name', duplicateSections: 'full', displayMode: 'chords' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    expect(screen.queryAllByRole('button', { name: /^Reset / }).length).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Music' }));
    expect(screen.queryByRole('button', { name: 'Reset Show' })).toBeNull();
  });

  it('resetting Show retires the legacy showChords rather than falling into it', () => {
    const onUpdateSettings = vi.fn();
    render(<Reader song={makeSong()} onExit={() => {}} onUpdateSettings={onUpdateSettings}
      settings={{ displayMode: 'lyrics', showChords: false }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Music' }));

    // Clearing `displayMode` alone hands the decision back to `showChords`,
    // which the old Performance/Practice views write — so "put it back to
    // default" produced lyrics-only, with the chords gone.
    fireEvent.click(screen.getByRole('button', { name: 'Reset Show' }));
    expect(onUpdateSettings).toHaveBeenCalledWith('displayMode', undefined);
    expect(onUpdateSettings).toHaveBeenCalledWith('showChords', undefined);
  });

  it('offers a Reset per OPTION, and only where there is something to reset', () => {
    const { unmount } = renderReader();
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    // Pristine: no clutter, and no button that would do nothing.
    expect(screen.queryAllByRole('button', { name: /^Reset / }).length).toBe(0);
    unmount();

    const onUpdateSettings = vi.fn();
    render(<Reader song={makeSong()} onExit={() => {}}
      settings={{ chartLyricFont: 'serif', sectionSpacing: 40 }} onUpdateSettings={onUpdateSettings} />);
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    // Per option, not per group: resetting the font must not also throw away
    // the size you spent a minute getting right.
    expect(screen.getByRole('button', { name: 'Reset Font' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset Between sections' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset Size' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset Line spacing' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Reset Font' }));
    // Cleared, not set to a copy of the default — the default lives at the
    // point of use, in one place.
    expect(onUpdateSettings).toHaveBeenCalledWith('chartLyricFont', undefined);
  });

  it('gives the themes AND the colours arrows, so they read as scrollable', () => {
    renderReader();
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    // A bare overflow strip with the scrollbar hidden gives no sign there is
    // more than what you can see — as true of ten swatches as of ten themes.
    expect(screen.getAllByRole('button', { name: 'More themes' }).length).toBe(1);
    // Lyric colour, chord colour, and the three tab colours.
    expect(screen.getAllByRole('button', { name: 'More colours' }).length).toBe(5);
    expect(screen.getAllByRole('button', { name: 'Previous colours' }).length).toBe(5);
  });

  it('offers any colour as the LAST stop, through the app\'s OWN picker', () => {
    renderReader();
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    // NOT a native `<input type="color">`, which opens the OS picker: a
    // different set of colours, and on iOS a full-screen sheet over the chart
    // being adjusted. It opens the same picker Settings → Chart Style uses.
    const wells = screen.getAllByRole('button', { name: 'Any colour' });
    expect(wells.length).toBe(5);
    expect(document.querySelector('input[type="color"]')).toBeNull();

    // Closed until asked, so it costs no height on a 40% dock until it is used.
    expect(screen.queryByLabelText('Hex colour')).toBeNull();
    fireEvent.click(wells[0]);
    expect(screen.getByLabelText('Hex colour')).toBeTruthy();
  });

  it('reads displayMode, so Show can actually bring the chords back', () => {
    // The bug: the ☰'s Show control and the role picker both write
    // `displayMode`, and the reader read `settings.showChords` — a different
    // key. So "Chords + lyrics" did nothing, and once `showChords` had been set
    // false anywhere (the old Performance/Practice views both write it) there
    // was no way back to chords at all.
    const { unmount } = render(
      <Reader song={makeSong()} onExit={() => {}} settings={{ showChords: false, displayMode: 'chords' }} />
    );
    expect(screen.getAllByText('G').length).toBeGreaterThan(0);
    unmount();

    render(<Reader song={makeSong()} onExit={() => {}} settings={{ displayMode: 'lyrics' }} />);
    expect(screen.queryByText('G7')).toBeNull();
  });

  it('can render chords ONLY — the third state was impossible before', () => {
    // `ReaderSection` passed a bare `showLyrics`, i.e. always true, so
    // 'chordsonly' was offered by every Show control and never worked.
    render(<Reader song={makeSong()} onExit={() => {}} settings={{ displayMode: 'chordsonly' }} />);
    expect(screen.queryByText(/Amazing grace, how/)).toBeNull();
    expect(screen.getAllByText('G7').length).toBeGreaterThan(0);
  });

  it('lets the chord diagrams be switched off', () => {
    // `showDiagrams` was a fourth orphan: synced, and read by the reader
    // nowhere. Default on — a diagram you ask for costs nothing until you ask.
    const { unmount } = renderReader();
    expect(screen.getAllByRole('button', { name: 'G chord shape' }).length).toBeGreaterThan(0);
    unmount();

    render(<Reader song={makeSong()} onExit={() => {}} settings={{ showDiagrams: false }} />);
    expect(screen.queryByRole('button', { name: 'G chord shape' })).toBeNull();
  });

  it('applies a role as VISIBLE settings, never as a hidden override', () => {
    const onUpdateSettings = vi.fn();
    renderReader({ onUpdateSettings });
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Music' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vocals' }));

    // A role that silently overrode the display panel is the bug that turned
    // the hub's Chart tab into a second Lyrics tab. It writes real settings.
    expect(onUpdateSettings).toHaveBeenCalledWith('displayRole', 'vocalist');
    expect(onUpdateSettings).toHaveBeenCalledWith('displayMode', 'lyrics');
  });
});

// The phone shape — element 28, round 4.
//
// Three shapes were tried on the device: a bottom sheet (covers the chart, so
// it had to be capped), a push-down panel under the top bar (works, but puts
// the controls at the far end of the screen from the thumb), and this — a DOCK
// that splits the screen 70/30, reader over settings. Owner: "we split the
// screen in two sections, the reader above and the setting below… and there we
// give the 3 tabs but without the drag, ☰ transforms into an x?"
// What a free plan can and cannot reach in the ☰. The split, agreed 2026-08-04:
// anything that makes the chart READABLE is free — it is an accessibility
// floor, not a feature to sell — and taste is Pro.
// The two bugs the owner found in beta.66, both in the same place: the chart's
// per-element colours and fonts.
describe('the lyric colour and font belong to the LYRICS', () => {
  it('paints the lyrics from --chart-lyric, never the ink token', async () => {
    const { default: SectionBlock } = await import('@/features/chart/SectionBlock');
    const src = await import('node:fs').then(fs =>
      fs.readFileSync('src/features/chart/SectionBlock.jsx', 'utf8'));
    expect(SectionBlock).toBeTruthy();
    // `--chart-text` is the chart's INK — the top bar's title, the section
    // headings, and through `chartSurface` every control in the reader's
    // chrome. Writing the lyric colour into it repainted the whole reader UI.
    expect(src).toContain('var(--chart-lyric, var(--chart-text, var(--text-1)))');
    // And the lyric FONT has to be set on the lyric itself. `ChartView` put it
    // on its own wrapper, so it worked there and did nothing in the Reader,
    // which has no such wrapper.
    expect(src).toContain("fontFamily: 'var(--chart-font-lyric, var(--font-sans))'");
  });

  it('keeps the section gap out of the space between LINES', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync('src/features/chart/SectionBlock.jsx', 'utf8'));
    // A line's margin used to be `calc(var(--chart-section-gap) / 3)`, so
    // "Between sections" quietly moved the lyrics apart too: 24→48 took every
    // line inside every section from 8px to 16px. 8px IS 24/3, so the default
    // is unchanged — they are simply not wired together any more.
    expect(src).toContain('marginBottom: 8,');
    expect(src).not.toContain('var(--chart-section-gap, 24px) / 3');
    // …and it is a NUMBER, not `var(--chart-line-gap, 8px)`. Nothing ever wrote
    // that variable, so the fallback was the only value it had — a var nobody
    // writes tells the next reader "this is configurable" and it is not.
    // `var(`-prefixed so the comment naming the retired token stays legal — it
    // is the READ that was the problem, not the memory of it.
    expect(src).not.toContain('var(--chart-line-gap,');
    // ⚠ And it is NOT conditional on the line having words. It used to be
    // `hasLyrics ? gap : 0`, so a chord-only line — an intro, an instrumental —
    // had no gap under it and sat on the lyric below, reading as that line's
    // chords.
    expect(src).not.toContain("marginBottom: hasLyrics ?");
  });

  it('keeps the chart ink separate from the lyric colour at the source', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync('src/hooks/useChartTheme.js', 'utf8'));
    // The regression to guard: `const text = settings?.chartLyricColor || …`.
    expect(src).toContain('const text = theme.text;');
    expect(src).toContain("root.style.setProperty('--chart-lyric', lyric)");
  });

  it('does not let the lyric colour reach the hub', async () => {
    const { hubSurface } = await import('@/features/reader/readerSurface');
    // The hub is the Reader with the settings wire cut; --chart-lyric is a new
    // wire and needed cutting too.
    expect(hubSurface['--chart-lyric']).toBe('var(--ds-gray-1000)');
  });

  // ── Element 6/7, 2026-08-10 ──────────────────────────────────────────────
  it('declares the word gap instead of inheriting a space glyph', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync('src/features/chart/SectionBlock.jsx', 'utf8'));
    // The gap between two words on a CHORDED line is this span, and it carries
    // no font of its own — so it used to be whatever space the surrounding
    // surface supplied. Measured at 390px on one song: the old PracticeView
    // hard-codes mono on its chart wrapper (space = 10.81px), the Reader sets
    // nothing (space = 4.50px), with identical words in both. Declare it.
    expect(src).toContain('var(--chart-word-gap-em');
    // The words either side are `nowrap` and cannot shrink, so a shrinkable gap
    // is the only thing that gives — the gaps would close on the longest line
    // of the song, which is the one that needs them most.
    expect(src).toContain('flexShrink: 0');
  });

  it('offers a note field where the note itself will land', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync('src/features/chart/SectionBlock.jsx', 'utf8'));
    // `--chart-chord-size` is written by NOBODY, so the `+` hint and the input
    // fell back to `1em` — of their own 0.72em text, i.e. 16px against the
    // committed note's 20px. Three call sites, one var, no exceptions.
    // `var(`-prefixed, so the comment naming the dead token stays legal — it is
    // the READ that was the bug, not the memory of it.
    expect(src).not.toContain('var(--chart-chord-size');
    // The `+` hint, the input, and the committed note. (The chord-clearance
    // arithmetic reads the same var, hence >= rather than a fixed count.)
    expect(src.match(/--chart-font-size-chord, 17px/g).length).toBeGreaterThanOrEqual(3);
  });

  // ⚠ The one that mattered. A chord standing alone between two spaces on a
  // line WITH lyrics took the next chord down with it: `pending = pending ??
  // p.chord` kept the held chord and discarded the arriving one. Nothing showed
  // — the chart just drew fewer chords than the song has, which is a wrong chord
  // played on a Sunday with no error anywhere. `parser.js` was innocent: it
  // returns every pair and round-trips the line byte-exact.
  it.each([
    ['[C]word [G] [D]more', ['C', 'G', 'D']],
    ['[Ab]mea [Cm] [Bb]', ['Ab', 'Cm', 'Bb']],
    ['[C]a [G] [D] [Em]b', ['C', 'G', 'D', 'Em']],
    // The turnaround that ends half the choruses in the library.
    ['[Ab]setea [Cm]mea [Bb]', ['Ab', 'Cm', 'Bb']],
    // Control: chords that already had words never regressed.
    ['[C]a [G]b [D]c', ['C', 'G', 'D']],
  ])('renders every chord in %s', async (line, expected) => {
    const { default: SectionBlock } = await import('@/features/chart/SectionBlock');
    const { container } = render(
      <SectionBlock
        section={{ type: 'Verse 1', note: '', lines: [line] }}
        transpose={0}
        songKey="C"
        notation="letters"
        // 'flats' so the assertion is about which chords survive, not about how
        // an Ab is spelled in C — that is the open accidentals question.
        accidentals="flats"
      />
    );
    const chords = [...container.querySelectorAll('span')]
      .filter(s => String(s.className).includes('text-[var(--chord)]'))
      .map(s => s.textContent);
    expect(chords).toEqual(expected);
  });

  // A zero-width chord is invisible to the flex row, so the row cannot wrap on
  // its account and the chart's right padding cannot contain it — measured at
  // 390px, a trailing `Cmaj9` painted 15.1px beyond the window and a solfège
  // `Fa#m` 7.3px past the edge. So the overhang is now spent only where it buys
  // something: a chord that has a word of its own AND more words after it to
  // paint across. jsdom does not lay out, but it does carry the inline style,
  // and the style IS the decision.
  const chordStyles = async (line) => {
    const { default: SectionBlock } = await import('@/features/chart/SectionBlock');
    const { container } = render(
      <SectionBlock section={{ type: 'Verse 1', note: '', lines: [line] }}
        transpose={0} songKey="C" notation="letters" accidentals="flats" />
    );
    return [...container.querySelectorAll('span')]
      .filter(s => String(s.className).includes('text-[var(--chord)]'))
      .map(s => ({ chord: s.textContent, width: s.style.width, marginRight: s.style.marginRight }));
  };

  it('overhangs a last chord only when there are words left to paint across', async () => {
    const [, , cmaj9] = await chordStyles('[C]a [G]b [Cmaj9]x more words after');
    expect(cmaj9.chord).toBe('Cmaj9');
    expect(cmaj9.width).toBe('0px');
  });

  it('does not overhang a chord that has no word under it', async () => {
    const styles = await chordStyles('[Ab]setea [Cm]mea [Bb]');
    const trailing = styles[styles.length - 1];
    expect(trailing.chord).toBe('Bb');
    // Real width, so the flex row can wrap it instead of painting it off-screen.
    expect(trailing.width).not.toBe('0px');
    // …and no clearance, so containing it costs the line no air.
    expect(trailing.marginRight).toBe('0px');
  });

  it('does not overhang a chord sitting on the LAST word of a line', async () => {
    const styles = await chordStyles('[C]a [G]last');
    const last = styles[styles.length - 1];
    expect(last.chord).toBe('G');
    expect(last.width).not.toBe('0px');
  });

  it('asks only for the room the words between two chords do not already give', async () => {
    // `[Gmaj7]I` — five characters of chord over one letter, with `Am7` next:
    // the shortfall is real and a margin is asked for. `[C]a lot of words here
    // [G]x` — the words already provide far more than `C` needs, so the max()
    // floor takes it to nothing.
    const tight = (await chordStyles('[Gmaj7]I [Am7]once'))[0];
    const loose = (await chordStyles('[C]a lot of words here [G]x'))[0];
    expect(tight.marginRight).toMatch(/^max\(0px, calc\(/);
    expect(loose.marginRight).toMatch(/^max\(0px, calc\(/);
    // Both are `max(0px, …)`; what differs is the arithmetic inside, which the
    // browser resolves. The contract asserted here is that it is CSS — the two
    // font sizes are live variables and a number baked in at render would be
    // stale the moment the Aa menu moved one.
    expect(tight.marginRight).toContain('var(--chart-font-size-chord');
    expect(tight.marginRight).toContain('var(--chart-font-size-lyric');
  });

  // ── Element 5/6, 2026-08-10 — a note is not a lyric ───────────────────────
  it('marks an inline note with the same glyph a band cue uses', async () => {
    const { default: SectionBlock } = await import('@/features/chart/SectionBlock');
    const { container } = render(
      <SectionBlock
        section={{ type: 'Verse 1', note: '', lines: ['[C]Set me [G]free {!build here}'] }}
        transpose={0} songKey="C" notation="letters" notePlacement="below"
      />
    );
    // Grey italic text level with the words reads AS words. `>` says someone is
    // talking to the band — which is exactly what it already means one level up
    // on a section heading, so there is nothing new to learn.
    expect(container.textContent).toContain('>');
    expect(container.textContent).toContain('build here');
    // …and it is hidden from a screen reader, which does not need "greater-than"
    // announced before every note.
    const mark = [...container.querySelectorAll('[aria-hidden="true"]')]
      .find(el => el.textContent === '>');
    expect(mark).toBeTruthy();
  });

  it('joins a word a chord broke, and only when it actually broke', async () => {
    const { default: SectionBlock } = await import('@/features/chart/SectionBlock');
    const { container } = render(
      <SectionBlock
        section={{ type: 'Verse 1', note: '', lines: ['[Cmaj7]ran[G]somed me now'] }}
        transpose={0} songKey="C" notation="letters"
      />
    );
    // A rule, not a hyphen character: measured, one case left 2.1px of clearance
    // and a "-" glyph drew a 2.1px sliver, which reads as damage. A rule is the
    // same shape at every width. Its WIDTH is the clearance expression, so the
    // browser decides whether anything shows — zero clearance, zero width.
    const rule = [...container.querySelectorAll('span[aria-hidden="true"]')]
      .find(el => el.style.borderTopStyle === 'solid');
    expect(rule).toBeTruthy();
    expect(rule.style.width).toContain('max(0px, calc(');
    // Absolute, so it costs nothing when there is nothing to say — in flow it
    // was measured adding 7.5px to every syllable it was meant to be silent on.
    expect(rule.style.position).toBe('absolute');
  });

  it('gives a lyric-only line the same air as a chorded one — but only on a chart', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync('src/features/chart/SectionBlock.jsx', 'utf8'));
    // A plain line had 0px under it while a chorded line had 8px, so on a chart
    // it ran into the chord row below and read as having taken those chords.
    // In Lyrics mode every line comes through that branch and the tight rhythm
    // is correct, so the gap is gated on chords being shown.
    expect(src).toContain('marginBottom: showChords ? 8 : 0');
  });
});

describe('the ☰ — free and Pro', () => {
  // The suite's global mock says "allowed" to everything; this one says no.
  const asFree = () => {
    vi.doMock('@/hooks/useEntitlement', () => ({
      useEntitlement: () => ({ allowed: false, requiredPlan: 'sync', currentPlan: 'free' }),
      checkEntitlement: () => false,
    }));
  };

  it('never charges for legibility — sizes and spacing are free', async () => {
    vi.resetModules();
    asFree();
    const { default: FreeReader } = await import('@/features/reader/Reader');
    render(<FreeReader song={makeSong()} settings={{}} onExit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));

    // Both steppers, and both spacing steppers, all live.
    expect(screen.getByRole('button', { name: 'Increase lyric size' }).disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Increase chord size' }).disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Increase line height' }).disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Increase section gap' }).disabled).toBe(false);
    vi.resetModules();
  });

  it('SHOWS the locked themes rather than hiding them, and offers a way in', async () => {
    vi.resetModules();
    asFree();
    const { default: FreeReader } = await import('@/features/reader/Reader');
    const onUpgrade = vi.fn();
    render(<FreeReader song={makeSong()} settings={{}} onExit={() => {}} onUpgrade={onUpgrade} />);
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));

    // It used to FILTER them out: only the free themes existed on a free plan
    // and the rest did not, so there was nothing to want. Seeing them is the
    // pitch. Counted from the data so the number cannot rot.
    const { CHART_THEMES, FREE_CHART_THEME_IDS } = await import('@/data/chartThemes');
    const n = CHART_THEMES.filter(t => !FREE_CHART_THEME_IDS.has(t.id)).length;
    expect(screen.getAllByRole('button', { name: /upgrade to use$/ }).length).toBe(n);
    // And the CTA is a button, not a sentence telling you what you can't do.
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Unlock ${n} more themes`) }));
    expect(onUpgrade).toHaveBeenCalled();
    vi.resetModules();
  });
});

// The chart's own scroll. One scroller, and the row the desktop ☰ sits in must
// not cap it.
describe('the reader scrolls once', () => {
  it('lets nothing between the scroller and the chart cap its height', () => {
    renderReader();
    const scroller = document.querySelector('.reader-head').parentElement;
    expect(scroller.className).toContain('overflow-y-auto');

    // `min-h-0` on any wrapper between the two pins the chart to ONE screen:
    // it lays itself out inside a box the height of the viewport while its
    // content runs past it, so the scroller's scrollHeight comes from the box
    // rather than the song and the two disagree about how long the song is.
    // The row the desktop ☰ sits in had it, and it was unconditional — so it
    // hit the phone too, where that row holds nothing but the chart.
    let el = document.querySelector('[data-section-index]');
    const capped = [];
    while (el && el !== scroller) {
      if (String(el.className || '').includes('min-h-0')) capped.push(el.className);
      el = el.parentElement;
    }
    expect(capped).toEqual([]);
  });

  // The second double scroll, measured in Chromium at 1280×900 (2026-08-05):
  // menu closed, the column was 74 + 777 + 49 = 900 in a 900px scroller and
  // nothing scrolled. Menu open, the panel claimed `viewH - headH` = 826 and
  // the column became 949 — the reader scrolled by 49px, which is EXACTLY the
  // nav bar. The bottom block is `sticky bottom-0`, and sticky is still in
  // flow, so it takes real height under the row the panel sits in.
  //
  // jsdom has no layout, so this reads the arithmetic at the source. That is
  // the point: a render test cannot see a height nobody computes.
  it('sizes the desktop ☰ panel with the bottom bar taken off', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync('src/features/reader/Reader.jsx', 'utf8'));
    expect(src).toContain('height: viewH ? Math.max(0, viewH - headH - footH) : undefined');
    // …and `footH` has to be MEASURED off the block, not guessed: the row is
    // taller with the practice tools open, and taller again with a bottom
    // ribbon.
    expect(src).toContain('ref={footRef}');
    expect(src).toContain('setFootH');
  });
});

describe('the ☰ on a phone — element 28', () => {
  beforeEach(() => { mockWidth(390); });

  const openPanel = (props = {}) => {
    renderReader(props);
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    return { panel: screen.getByRole('dialog', { name: 'Reader menu' }) };
  };

  it('DOCKS under the reader — a real split, not an overlay', () => {
    const { panel } = openPanel();
    // Not portaled: it is a sibling of the reader's scroller inside the
    // reader's own flex column, which is what makes the 30% real. An overlay
    // would leave the chart full height and hidden underneath it.
    expect(panel.parentElement).not.toBe(document.body);
    expect(panel.parentElement.style.flex).toBe('0 0 40%');
    // ...and the box it sits in is a SIBLING of the reader's scroller, which is
    // what makes the 70% real rather than an overlay pretending. Sibling, not
    // `previousElementSibling`: element 5's floating action is in that column
    // too, between the two, and the claim here was never about adjacency.
    const column = [...panel.parentElement.parentElement.children];
    expect(column).toContain(panel.parentElement);
    expect(column.some(el => el.className.includes('overflow-y-auto'))).toBe(true);
    // The chart above is all still there, and still live.
    expect(document.querySelectorAll('[data-section-index]').length).toBe(4);
  });

  it('is the same box on every tab, and scrolls inside itself', () => {
    const { panel } = openPanel();
    const box = panel.parentElement.style.flex;
    fireEvent.click(screen.getByRole('button', { name: 'Music' }));
    // Style is ten fields and Music is four; the split must not move under the
    // chart when you switch between them.
    expect(panel.parentElement.style.flex).toBe(box);
    // Without `min-h-0` a flex child refuses to shrink below its content, and
    // the body grows past the dock instead of scrolling.
    // firstChild, not last: in the dock the tab strip sits at the BOTTOM.
    const body = panel.firstChild;
    expect(body.className).toContain('flex-1');
    expect(body.className).toContain('min-h-0');
    expect(body.className).toContain('overflow-y-auto');
  });

  it('scrolls the fields inside itself rather than growing', () => {
    const { panel } = openPanel();
    // Without `min-h-0` a flex child refuses to shrink below its content and
    // the sheet grows past its own height instead of scrolling.
    // firstChild, not last: in the dock the tab strip sits at the BOTTOM.
    const body = panel.firstChild;
    expect(body.className).toContain('flex-1');
    expect(body.className).toContain('min-h-0');
    expect(body.className).toContain('overflow-y-auto');
  });

  it('has no drag and no scrim', () => {
    const { panel } = openPanel();
    // No scrim: the chart above stays live, so element 11's chord taps still
    // work while you are changing the type size.
    expect(screen.queryByRole('button', { name: 'Close menu' })).toBeNull();
    // No handle: a dock has one size, so there is no gesture to learn and
    // nothing that can feel blocked.
    expect(panel.querySelector('[style*="touch-action"]')).toBeNull();
  });

  it('carries its OWN close, beside the tabs', () => {
    const { panel } = openPanel();
    // The ☰ that opened it is at the top of the screen and the dock is at the
    // bottom — a phone's height away from the thumb using the panel. Both work;
    // this is the near one.
    const closers = screen.getAllByRole('button', { name: 'Close display options' });
    expect(closers.some(b => panel.contains(b))).toBe(true);
    fireEvent.click(closers.find(b => panel.contains(b)));
    expect(screen.queryByRole('dialog', { name: 'Reader menu' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Display options' })).toBeTruthy();
  });

  it('docks down the LEFT on a desktop, rather than covering the chart', () => {
    mockWidth(1024);
    openPanel();
    const panel = screen.getByRole('dialog', { name: 'Reader menu' });
    // A popover anchored to a top-LEFT button covers the chart it is changing.
    // A panel down the left pushes it across, like the setlist rail does on
    // the other edge.
    expect(panel.parentElement).not.toBe(document.body);
    // Responsive: a fixed 320 is a third of a 1024px laptop and a sliver of a
    // big display.
    expect(panel.parentElement.style.width).toBe('min(320px, 30vw)');
    // FIRST in the row, so the chart moves right rather than being overlaid...
    expect(panel.parentElement.previousElementSibling).toBeNull();
    // ...and INSIDE the scroller, below the top bar, which is what keeps the
    // header — and the ☰ in it — from moving when the panel opens. An earlier
    // round made the panel a SIBLING of the scroller: the header shrank with
    // the column, the ☰ moved sideways anyway, and offsetting the panel by the
    // header height only left an empty band above it.
    const head = document.querySelector('.reader-head');
    const scroller = head.parentElement;
    expect(scroller.className).toContain('overflow-y-auto');
    expect(scroller.contains(panel)).toBe(true);
    // The header is the scroller's own child, so it spans the full width and
    // the panel cannot push it.
    expect(head.contains(panel)).toBe(false);
    expect(head.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    // Tabs on top here: a full-height panel is read top-down. (On the phone
    // dock they sit at the bottom, nearest the thumb.)
    expect(panel.firstChild.className).toContain('border-b');
  });
});

describe('element 11 — tap a chord', () => {
  it('opens a popover for the chord you tapped, and only that one', () => {
    renderReader();
    const g = screen.getAllByRole('button', { name: 'G chord shape' })[0];
    fireEvent.click(g);
    const pop = screen.getByRole('dialog', { name: 'G chord shape' });
    expect(pop).toBeTruthy();
    // No strip: exactly one chord is on screen as a diagram.
    expect(screen.queryAllByRole('dialog', { name: /chord shape$/ }).length).toBe(1);
  });

  it('names the chord AS WRITTEN — capo is not applied', () => {
    // Capo 2 in G means the player fingers G shapes while the chart says G.
    // Second-guessing that here would show a shape whose name is nowhere on
    // screen, so the capo is deliberately ignored.
    const song = songFromFlat({
      id: 's', title: 'T', key: 'G', capo: 2,
      sections: [{ type: 'Verse 1', lines: ['[G]a'] }],
    });
    render(<Reader song={song} settings={{}} onExit={() => {}} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'G chord shape' })[0]);
    expect(screen.getByRole('dialog', { name: 'G chord shape' })).toBeTruthy();
  });

  it('follows a transpose — tapping shows the chord you can see', () => {
    renderReader({ selectedKey: 'A' });
    expect(screen.getAllByRole('button', { name: 'A chord shape' }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('button', { name: 'G chord shape' }).length).toBe(0);
  });

  it('leaves chords inert without the entitlement', async () => {
    vi.resetModules();
    vi.doMock('@/hooks/useEntitlement', () => ({
      useEntitlement: () => ({ allowed: false, requiredPlan: 'sync', currentPlan: 'free' }),
      checkEntitlement: () => false,
    }));
    const { default: Gated } = await import('@/features/reader/Reader');
    render(<Gated song={makeSong()} settings={{}} onExit={() => {}} />);
    expect(screen.queryAllByRole('button', { name: /chord shape$/ }).length).toBe(0);
    vi.doUnmock('@/hooks/useEntitlement');
  });
});

// ── Embedded in the Song Hub ────────────────────────────────────────────────
// The hub renders READER (not ChartView) whenever the `unifiedReader` Labs flag
// is on. Two fixes were once made to ChartView for bugs that live here — these
// pin the behaviour to the component the hub actually mounts.
describe('embedded in the Song Hub', () => {
  it('renders chords on the Chart tab even if the global setting is off', () => {
    // The bug: `showChords:false` from any other surface silently turned the
    // Chart tab into a second Lyrics tab.
    render(
      <Reader song={makeSong()} settings={{ showChords: false }} embedded displayMode="chords" onExit={() => {}} />
    );
    expect(screen.getAllByText('G').length).toBeGreaterThan(0);
  });

  it('renders NO chords on the Lyrics tab', () => {
    render(
      <Reader song={makeSong()} settings={{}} embedded displayMode="lyrics" onExit={() => {}} />
    );
    expect(screen.queryByText('G7')).toBeNull();
  });

  it('wears the APP theme, not the stage theme', () => {
    // `style={undefined}` was not enough: the --chart-* tokens live on :root, so
    // everything inside kept reading stage colours.
    const { container } = render(
      <Reader song={makeSong()} settings={{}} embedded onExit={() => {}} />
    );
    // The reader is a column whose first child is the scroller; the desktop ☰
    // lives INSIDE that scroller now, below the top bar.
    const root = container.firstChild.firstChild;
    expect(root.style.getPropertyValue('--chart-bg')).toBe('var(--ds-background-100)');
    expect(root.style.getPropertyValue('--chart-text')).toBe('var(--ds-gray-1000)');
  });

  it('still wears the stage theme when it owns the screen', () => {
    // Standalone it must NOT override --chart-*: those come from :root, where
    // useChartTheme writes the stage palette. Overriding here would kill themes.
    const { container } = render(<Reader song={makeSong()} settings={{}} onExit={() => {}} />);
    expect(container.firstChild.firstChild.style.getPropertyValue('--chart-bg')).toBe('');
    expect(container.firstChild.style.getPropertyValue('--chart-text')).toBe('');
  });
});

describe('the ribbon and the pinned heading agree', () => {
  it('reads its active section from the PIN line, not a fraction of the viewport', () => {
    // The two halves of "where am I" (element 2's chip and element 3's pinned
    // heading) must change at the same instant. The ribbon used to spy on a
    // line at 2% of the viewport while headings pinned at the header's height —
    // 60-80px apart, so the chip changed well before the heading moved.
    mockWidth(false);                       // sticky headings are phone-only
    const { container } = render(
      <Reader song={makeSong()} settings={{}} onExit={() => {}} />,
    );
    const heading = container.querySelector('[data-section-index="1"] > div');
    const head = container.querySelector('.reader-head');
    expect(head).toBeTruthy();
    // The heading pins at a measured offset rather than at 0 — the value the
    // scroll-spy is now handed.
    expect(heading.style.position).toBe('sticky');
    expect(heading.style.top).toBeTruthy();
  });
});

describe('the bottom edge is ONE sticky block', () => {
  it('puts a bottom-positioned ribbon in the same block as the nav, not beside it', () => {
    // beta.41 shipped two `sticky bottom-0` siblings and expected z-index to
    // stack them. It cannot: they both pin to the same 0px and the higher z
    // simply covers the other, so the ribbon was invisible under the nav bar.
    mockWidth(false);
    const { container } = render(
      <Reader
        song={makeSong()} settings={{ structurePosition: 'bottom' }}
        onExit={() => {}} footer={<div>nav</div>}
      />,
    );
    const pinned = container.querySelectorAll('.sticky.bottom-0');
    expect(pinned.length).toBe(1);
    // …and the ribbon is inside it, above the nav row.
    expect(pinned[0].textContent).toContain('nav');
    expect(pinned[0].querySelectorAll('button').length).toBeGreaterThan(0);
  });
});

describe('element 3 — repeats can be hidden outright', () => {
  it('draws nothing for a repeat, but keeps it on the map', () => {
    mockWidth(true);
    const { container } = render(
      <Reader song={makeSong()} settings={{ duplicateSections: 'hide' }} onExit={() => {}} />,
    );
    // The song is V1 C V2 C — the second chorus is a repeat.
    const repeat = container.querySelector('[data-section-index="3"]');
    expect(repeat).toBeTruthy();          // still there for the scroll-spy
    expect(repeat.textContent).toBe('');  // and draws nothing at all
  });
});

// ── Element 3 — a repeat you asked to see ───────────────────────────────────
//
// Owner, 2026-08-05, option B. The rejected option was "send them back to the
// first full play", which is what the ribbon chip did: you tap chip six and
// land at chip two, and the highlight walks backwards with you. On stage that
// reads as the app losing your place.
describe('element 3 — tapping a Tag opens it where it stands', () => {
  const song = () => makeSong();

  it('a tag opens in place, and only the one you tapped', () => {
    mockWidth(true);
    const { container } = render(
      <Reader song={song()} settings={{ duplicateSections: 'condensed' }} onExit={() => {}} />,
    );
    // V1 C V2 C — slot 3 is the repeated chorus, drawn as the pill.
    const slot = () => container.querySelector('[data-section-index="3"]');
    const pill = slot().querySelector('button');
    expect(pill.getAttribute('aria-label')).toContain('show it here');

    fireEvent.click(pill);

    // It is the section now, with its words — not a pill, and not a jump.
    expect(slot().textContent).toContain('Praise the');
    // The first chorus is untouched: opening the third chorus must never open
    // the second, which is why the state is a set of play-order SLOTS.
    expect(container.querySelector('[data-section-index="1"]')).toBeTruthy();
  });

  it('the ribbon chip opens the tag too, instead of walking you backwards', () => {
    mockWidth(true);
    const { container } = render(
      <Reader song={song()} settings={{ duplicateSections: 'condensed' }} onExit={() => {}} />,
    );
    // The ribbon collapses nothing here — V1 C V2 C are four distinct runs.
    const chips = container.querySelectorAll('.reader-head [data-section-index], .reader-head button');
    const chip = [...chips].filter(b => b.textContent.trim() === 'C')[1];
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(container.querySelector('[data-section-index="3"]').textContent).toContain('Praise the');
  });

  it('a HIDDEN repeat still goes to the first play — there is nothing to open', () => {
    mockWidth(true);
    const { container } = render(
      <Reader song={song()} settings={{ duplicateSections: 'hide' }} onExit={() => {}} />,
    );
    const chip = [...container.querySelectorAll('.reader-head button')]
      .filter(b => b.textContent.trim() === 'C')[1];
    fireEvent.click(chip);
    // Hidden draws nothing at all, so opening it in place would open an empty
    // box. The slot stays empty and the jump goes to the one place those words
    // are on the page (owner, Q2).
    expect(container.querySelector('[data-section-index="3"]').textContent).toBe('');
  });
});

describe('element 3 — edit mode takes the map to the top', () => {
  it('moves a bottom ribbon up to edit, and puts it back after', () => {
    mockWidth(true);
    const { container } = render(
      <Reader song={makeSong()} settings={{ structurePosition: 'bottom' }} onExit={() => {}}
        onUpdateSong={() => {}} mode="practice" />,
    );
    // ⚠ Asserts WHERE the ribbon is, not how many buttons the head has. The
    // count was a proxy, and it has now been wrong twice for opposite reasons:
    // first element 5's control was in the bar out of edit mode and gone inside
    // it (the ribbon arriving and the button leaving cancelled exactly, 5 → 5),
    // and now the ☰ leaves on entering edit, which cancels it again. A proxy
    // that has to be re-derived every time the bar changes is not measuring the
    // thing the test is about.
    //
    // The `+` exists ONLY in edit mode and belongs to the ribbon, so finding it
    // inside `.reader-head` says exactly this test's claim: with
    // `structurePosition: 'bottom'`, editing brings the map up to the top.
    const head = () => container.querySelector('.reader-head');
    const plusInHead = () => !!head()?.querySelector('[aria-label^="Add a section"]');
    expect(plusInHead()).toBe(false);

    openSongActions();
    fireEvent.click(screen.getByRole('button', { name: /^edit this song/i }));
    // Owner, 2026-08-05: "move to the top, when exits edit everything goes back
    // to normal". It used to rescue 'off', 'left' and 'right' only — a bottom
    // ribbon stayed under the nav bar, which is the furthest possible place
    // from the change you are making.
    expect(screen.getByRole('button', { name: /add a section/i })).toBeTruthy();
    expect(plusInHead()).toBe(true);
  });
});

// ── Element 3 — the side rail, rebuilt 2026-08-05 ───────────────────────────
//
// Owner: "First thing they should be in the middle of the app not at the top
// like now. The setting and the rail should push them not open behind them.
// They should be a bit transparent. They should show maybe like 5-6 elements
// and they should scroll with the text."
describe('element 3 — the floating side rail', () => {
  const longSong = () => makeSong({
    structure: ['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Verse 1', 'Chorus',
      'Verse 2', 'Chorus', 'Verse 1', 'Chorus'],
  });
  const rail = () => document.querySelector('.sticky.h-0');

  it('shows the WHOLE map, not a window', () => {
    mockWidth(true);
    const { container } = render(
      <Reader song={longSong()} settings={{ structurePosition: 'left' }} onExit={() => {}} />,
    );
    // It was a window of six while a side rail could be chips: six spelled-out
    // names was the most a column could carry. Dots are 7px on a 13px pitch, so
    // the whole song fits — and a map you can see all of is the thing the
    // ribbon is for (owner, 2026-08-06: "now that we have dots, remove the
    // scrolling of 2 and 3, show full").
    expect(container.querySelectorAll('[data-section-index]').length).toBe(10);
    expect(rail().querySelectorAll('button').length).toBe(10);
  });

  it('hangs off the CHART COLUMN, so the ☰ pushes it instead of covering it', () => {
    mockWidth(true);
    render(<Reader song={longSong()} settings={{ structurePosition: 'right' }} onExit={() => {}} />);
    // Positioned against the row that also holds the ☰ panel, it simply sat
    // underneath the panel when it opened. Its parent is the chart column.
    expect(rail().parentElement.className).toContain('flex-1 min-w-0 relative');
  });

  it('takes no layout height and stays put while the song scrolls', () => {
    mockWidth(true);
    render(<Reader song={longSong()} settings={{ structurePosition: 'left' }} onExit={() => {}} />);
    // A zero-height sticky box: it holds its place on screen without taking a
    // pixel from the chart. `fixed` would have ignored the ☰ panel and the
    // app's own sidebar, which is the bug this replaced.
    expect(rail().className).toContain('h-0');
    // The class, not `getComputedStyle` — jsdom loads no stylesheet, so every
    // Tailwind utility computes to its initial value here.
    expect(rail().className).toContain('sticky');
    // ...and it is transparent, on the MARKS. That is only honest because the
    // side rail is dots: a frosted plate was tried first and it hid words,
    // which the owner ruled out ("the lyrics are the number one in
    // importance"), and fading text chips washes the ink out with the ground.
    // A dot has no ink to wash.
    const strip = rail().firstElementChild;
    expect(Number(strip.style.opacity)).toBeGreaterThan(0);
    expect(Number(strip.style.opacity)).toBeLessThan(1);
    expect(strip.style.backgroundColor).toBe('');
  });

  it('gives the chart the whole width — the row is a flex ITEM', () => {
    mockWidth(true);
    render(<Reader song={longSong()} settings={{ structurePosition: 'off' }} onExit={() => {}} />);
    // Without `flex-1` this row was shrink-to-fit: measured in Chromium at
    // 1280, the chart came out 840px wide in a 1236px scroller, with 400px of
    // dead window beside it. A narrower chart is still a correct chart, which
    // is why nobody saw it — it just wraps more, and wrapping more is what
    // makes an "almost fitting" song scroll.
    const chart = document.querySelector('.wide-container.py-3');
    expect(chart.parentElement.parentElement.className).toContain('flex-1');
    expect(chart.parentElement.parentElement.className).toContain('min-w-0');
  });
});

// ── Elements 3 + 8 — a key change on the map, 2026-08-05 ────────────────────
describe('the ribbon marks a key change', () => {
  const modulated = () => makeSong({
    structure: ['Verse 1', 'Chorus', 'Verse 2'],
    sections: [
      { type: 'Verse 1', lines: ['[G]one'] },
      { type: 'Chorus', lines: [{ type: 'modulate', semitones: 2 }, '[A]two'] },
      { type: 'Verse 2', lines: ['[A]three'] },
    ],
  });

  it('names the key you ARRIVE in, not the interval', () => {
    mockWidth(true);
    render(<Reader song={modulated()} settings={{}} onExit={() => {}} />);
    // Element 8's rule, reused: "we're in A now" beats "+2". G + 2 = A.
    const mark = screen.getByLabelText('Key change to A');
    expect(mark.textContent).toContain('A');
    expect(mark.textContent).not.toContain('+2');
  });

  it('marks the boundary, not the middle of a section', () => {
    mockWidth(true);
    const { container } = render(<Reader song={modulated()} settings={{}} onExit={() => {}} />);
    // The `{modulate}` is INSIDE the chorus, so the chorus itself starts in G
    // and only Verse 2 plays wholly in A. The map has nowhere to put a mark
    // mid-chip, and the chart's own key-change chip already carries that
    // moment — so the map marks the first section that is entirely in the new
    // key, and there is exactly one mark either way.
    expect(container.querySelectorAll('[aria-label^="Key change"]').length).toBe(1);
  });

  it('says nothing at all about a song that never changes key', () => {
    mockWidth(true);
    const { container } = render(<Reader song={makeSong()} settings={{}} onExit={() => {}} />);
    expect(container.querySelectorAll('[aria-label^="Key change"]').length).toBe(0);
  });
});

describe('element 3 — what the side rail does differently', () => {
  const repeated = () => makeSong({ structure: ['Verse 1', 'Chorus', 'Chorus', 'Verse 2'] });

  it('is DOTS on a side, whatever style is set', () => {
    mockWidth(true);
    const { container } = render(
      <Reader song={makeSong()} settings={{ structurePosition: 'left', ribbonStyle: 'chips' }}
        onExit={() => {}} />,
    );
    // Owner, 2026-08-06: "maybe we allow only dots to be placed left/right
    // because we can make them transparent". A dot is 10px of colour with no
    // text to cover or be covered — the only mark that survives being laid
    // over lyrics. Same shape as edit mode forcing 'codes': the POSITION
    // decides what a chip can be.
    const rail = container.querySelector('.sticky.h-0');
    expect(rail.textContent).not.toContain('Verse');
    expect(rail.querySelector('span[class*="rounded-full"]')).toBeTruthy();
  });

  it('spells repeats out instead of collapsing them to ×2', () => {
    mockWidth(true);
    const { container, unmount } = render(
      <Reader song={repeated()} settings={{ structurePosition: 'left' }} onExit={() => {}} />,
    );
    // Owner, 2026-08-05: "I don't think we should allow x2 for the side
    // left/right, because they are already long enough." A column has the room
    // a row does not, and ×2 on a chip you read one-per-line is a second thing
    // to decode.
    const rail = container.querySelector('.sticky.h-0');
    expect(rail.querySelectorAll('button').length).toBe(4);
    expect(rail.textContent).not.toContain('×2');
    unmount();

    // The top ribbon still collapses — a row is short of width, not of height.
    const top = render(
      <Reader song={repeated()} settings={{ structurePosition: 'top' }} onExit={() => {}} />,
    );
    expect(top.container.querySelector('.reader-head').textContent).toContain('×2');
  });
});

// ── The trailing space, measured — 2026-08-05 ──────────────────────────────
describe('a chip can reach the last section on every device', () => {
  it('measures the tail instead of hard-coding 60vh on phones only', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync('src/features/reader/Reader.jsx', 'utf8'));
    // Owner: "clicking on a chip at the song map won't fully scroll to that
    // item". The header was innocent — measured in Chromium, a jump lands the
    // section exactly 8px under it with the set bar on OR off. The last
    // sections simply had nothing below them to scroll into: the trailing
    // space was a flat `60vh`, and only where headings pin, which is phones.
    // Desktop, last chip, before: the section sat 536px below the header with
    // the scroller already at its maximum. After: 8px.
    expect(src).not.toContain("paddingBottom: '60vh'");
    expect(src).toContain('paddingBottom: tailPad');
    // And it is nothing when the song already fits — a flat pad on every
    // device would invent a scroll on a song that almost fits, which is the
    // "mini scroll" complaint from the other side.
    expect(src).toContain('natural > band + 4');
  });
});

// ── The jump and the highlight are ONE number — 2026-08-06 ─────────────────
describe('a chip lands the section on the reading line', () => {
  it('scrolls to the pin line, never below it', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync('src/features/reader/Reader.jsx', 'utf8'));
    // Owner, with a screenshot: "if I click on verse 2 it scrolls to verse 2
    // but not quite so I still see verse 1 selected."
    //
    // The jump used to land the section 8px BELOW the header as breathing
    // room, and the scroll-spy's rule is "the last section whose top has
    // scrolled ABOVE the reading line" — which IS `headH`. 8px below the line
    // is not above it, so the spy kept reporting the previous section: you are
    // looking at Verse 2 and the ribbon says Verse 1. Measured after the fix:
    // the section's top lands at -1 relative to the header, and the clicked
    // chip is the lit one.
    expect(src).toContain('top - headH + 1');
    expect(src).not.toContain('top - headH - 8');
  });
});

describe('element 3 — the rail never covers a word', () => {
  const longSong = () => makeSong({
    structure: ['Verse 1', 'Chorus', 'Verse 2', 'Chorus', 'Verse 1'],
  });

  it('stays reachable, and keeps clear of the words by geometry', () => {
    mockWidth(true);
    const { container } = render(
      <Reader song={longSong()} settings={{ structurePosition: 'left' }} onExit={() => {}} />,
    );
    // beta.87 painted the rail UNDER the chart — the honest reading of "the
    // lyrics are the number one in importance" — and that silently broke the
    // map: paint order is hit-test order, so the chart's own box (padding
    // included, and the strip lives in that padding) swallowed every tap. Not
    // one dot was clickable. Caught by driving the scrub in Chromium.
    //
    // The rule survives by GEOMETRY: a 26px strip of 7px dots sits inside the
    // 32px padding the chart already had, so it does not reach a word to cover
    // it. Measured in Chromium: 0 lyric lines crossing the strip.
    const rail = container.querySelector('.sticky.h-0');
    expect(rail.className).toContain('z-10');
    // ...and the strip itself takes pointer events, or the scrub drops the
    // gesture in the gap between two dots.
    expect(rail.firstElementChild.className).toContain('pointer-events-auto');
    // The chart does not move for the map — but it DOES keep the padding the
    // strip lives inside. On a phone the words come in to the left edge (12px)
    // except on the rail's own side, which holds its 32px so the dots still sit
    // in margin rather than on lyrics.
    const chart = container.querySelector('.wide-container.py-3');
    // The rail is on the LEFT here, so that side holds its 32px. The other side
    // comes in like everywhere else — see the test below.
    expect(chart.style.paddingLeft).toBe('32px');
    expect(chart.style.paddingRight).toBe('12px');
  });

  it('brings the words to the left edge at EVERY width, and keeps the rail side', () => {
    // Owner, 2026-08-06: *"on mobile the sections should start right next to
    // the left side of the screen because the right side should be for inline
    // notes"*. 32px a side on a 390px screen is 16% spent on nothing; measured,
    // coming in to 12px gained 40px of text width AND took 20px off the song's
    // height. The exception is the side the structure rail floats down, which
    // keeps its 32px — element 3 settled that the dots live inside that padding
    // so they cross no words.
    mockWidth(false);
    let r = render(<Reader song={longSong()} settings={{ structurePosition: 'top' }} onExit={() => {}} />);
    let chart = document.querySelector('.wide-container.py-3');
    expect(chart.style.paddingLeft).toBe('12px');
    expect(chart.style.paddingRight).toBe('12px');
    r.unmount();

    r = render(<Reader song={longSong()} settings={{ structurePosition: 'right' }} onExit={() => {}} />);
    chart = document.querySelector('.wide-container.py-3');
    expect(chart.style.paddingLeft).toBe('12px');
    expect(chart.style.paddingRight).toBe('32px');
    r.unmount();

    // ⚠ A WIDE screen gets it too, since 2026-08-08. It used to keep the
    // app-wide 32px both sides, which meant the iPad — the device most of this
    // is actually read on — never got the change (owner: *"we moved the lyrics
    // on mobile to the left, but we never did that on tablet"*). The argument
    // was never about screen size; the right side belongs to notes at every
    // width.
    mockWidth(true);
    r = render(<Reader song={longSong()} settings={{ structurePosition: 'top' }} onExit={() => {}} />);
    chart = document.querySelector('.wide-container.py-3');
    expect(chart.style.paddingLeft).toBe('12px');
    expect(chart.style.paddingRight).toBe('12px');
    r.unmount();

    // ...and a wide screen with a rail still keeps that one side at 32px.
    render(<Reader song={longSong()} settings={{ structurePosition: 'left' }} onExit={() => {}} />);
    chart = document.querySelector('.wide-container.py-3');
    expect(chart.style.paddingLeft).toBe('32px');
    expect(chart.style.paddingRight).toBe('12px');
  });
});

// ── The side rail scrubs — 2026-08-06 ──────────────────────────────────────
// Owner: "do you know what would be cool? to have like a scrub when user
// clicks and drags the side rail". It is also the answer to the question he
// had parked — what moving between sections in that rail should feel like.
describe('the side rail is a scrub track', () => {
  it('stamps every chip with the play-order slot the gesture hit-tests on', () => {
    mockWidth(true);
    const { container } = render(
      <Reader song={makeSong()} settings={{ structurePosition: 'left' }} onExit={() => {}} />,
    );
    const slots = [...container.querySelectorAll('.sticky.h-0 [data-slot]')]
      .map(el => el.getAttribute('data-slot'));
    // `data-run` is the EDIT index and only exists while reordering; this is
    // the slot itself, and it is always there. V1 C V2 C → 0,1,2,3.
    expect(slots).toEqual(['0', '1', '2', '3']);
  });

  it('claims the vertical axis on the strip, and only there', () => {
    mockWidth(true);
    const { container } = render(
      <Reader song={makeSong()} settings={{ structurePosition: 'left' }} onExit={() => {}} />,
    );
    // The browser decides `touch-action` when the gesture STARTS, so a scrub
    // has to claim its axis up front or the page scroll wins the first move and
    // never gives it back. 26px of the screen; the chart either side of it
    // scrolls normally.
    const strip = container.querySelector('.sticky.h-0').firstElementChild;
    expect(strip.style.touchAction).toBe('none');
  });

  it('never looks a section up in the document — two readers can be mounted', async () => {
    const src = await import('node:fs').then(fs =>
      fs.readFileSync('src/features/reader/Reader.jsx', 'utf8'));
    // The Song Hub keeps its embedded Reader behind the full-screen one, and
    // both render `id="section-N"`. `document.getElementById` returned the
    // HUB's section, so every jump in full screen measured an element in a
    // different scroller — which is why the scrub moved nothing at all until
    // this was found.
    expect(src).toContain('sc.querySelector(`[data-section-index="${idx}"]`)');
  });
});
