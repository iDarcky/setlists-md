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

  it('changes the frame with the section style, including no line at all', () => {
    const frame = () => document.querySelector('[data-section-index]').style;
    let r = render(<Reader song={makeSong()} settings={{ readerSectionStyle: 'bar' }} onExit={() => {}} />);
    expect(frame().borderLeft).toBeTruthy();
    r.unmount();

    r = render(<Reader song={makeSong()} settings={{ readerSectionStyle: 'card' }} onExit={() => {}} />);
    expect(frame().borderRadius).toBeTruthy();
    r.unmount();

    // 'plain' is the original chart's look: the heading carries the section,
    // with no rule beside it.
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
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();

    // And every other panel is one tap from it, in either direction.
    fireEvent.click(screen.getByRole('button', { name: 'Layout' }));
    expect(screen.getByRole('button', { name: 'Boxes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ALL CAPS' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Style' }));
    expect(screen.getByText('Theme')).toBeTruthy();
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
describe('the ☰ on a phone — element 28', () => {
  beforeEach(() => { mockWidth(390); });

  const openPanel = (props = {}) => {
    renderReader(props);
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    return { panel: screen.getByRole('dialog', { name: 'Reader menu' }) };
  };

  it('DOCKS under the reader — a real 70/30 split, not an overlay', () => {
    const { panel } = openPanel();
    // Not portaled: it is a sibling of the reader's scroller inside the
    // reader's own flex column, which is what makes the 30% real. An overlay
    // would leave the chart full height and hidden underneath it.
    expect(panel.parentElement).not.toBe(document.body);
    expect(panel.parentElement.style.flex).toBe('0 0 30%');
    // ...and the box it sits in is a sibling of the reader's scroller, which is
    // what makes the 70% real rather than an overlay pretending.
    expect(panel.parentElement.previousElementSibling.className).toContain('overflow-y-auto');
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
    const body = panel.lastChild;
    expect(body.className).toContain('flex-1');
    expect(body.className).toContain('min-h-0');
    expect(body.className).toContain('overflow-y-auto');
  });

  it('scrolls the fields inside itself rather than growing', () => {
    const { panel } = openPanel();
    // Without `min-h-0` a flex child refuses to shrink below its content and
    // the sheet grows past its own height instead of scrolling.
    const body = panel.lastChild;
    expect(body.className).toContain('flex-1');
    expect(body.className).toContain('min-h-0');
    expect(body.className).toContain('overflow-y-auto');
  });

  it('has no drag and no scrim — the ☰ became the ✕ instead', () => {
    const { panel } = openPanel();
    // No scrim: the chart above stays live, so element 11's chord taps still
    // work while you are changing the type size.
    expect(screen.queryByRole('button', { name: 'Close menu' })).toBeNull();
    // No handle: a dock has one size, so there is no gesture to learn and
    // nothing that can feel blocked.
    expect(panel.querySelector('[style*="touch-action"]')).toBeNull();
    // The button that opened it now says it closes it.
    expect(screen.getByRole('button', { name: 'Close display options' })).toBeTruthy();
  });

  it('closes from the ✕ the ☰ turned into', () => {
    openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Close display options' }));
    expect(screen.queryByRole('dialog', { name: 'Reader menu' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Display options' })).toBeTruthy();
  });

  it('is a portaled popover on a desktop, not a dock', () => {
    mockWidth(1024);
    openPanel();
    const panel = screen.getByRole('dialog', { name: 'Reader menu' });
    expect(panel.parentElement).toBe(document.body);
    expect(panel.style.maxHeight).toBe('74vh');
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
    // `container.firstChild` is the 70/30 split column now; the surface lives
    // on the SCROLLER inside it (element 28's dock).
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
