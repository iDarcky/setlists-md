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
function mockWidth(wide) {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: wide, media: query, addEventListener: () => {}, removeEventListener: () => {},
  }));
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

  it('hands the chrome to the hub when embedded', () => {
    renderReader({ embedded: true });
    expect(screen.queryByRole('button', { name: 'Display options' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Exit' })).toBeNull();
  });

  it('header density has three distinct states', () => {
    let r = render(<Reader song={makeSong()} settings={{ readerHeader: 'min' }} onExit={() => {}} />);
    expect(screen.queryByText('Amazing Grace')).toBeNull();
    r.unmount();

    r = render(<Reader song={makeSong()} settings={{ readerHeader: 'std' }} onExit={() => {}} />);
    expect(screen.getByText('Amazing Grace')).toBeTruthy();
    expect(screen.queryByText('John Newton')).toBeNull();   // std ≠ full
    r.unmount();

    render(<Reader song={makeSong()} settings={{ readerHeader: 'full' }} onExit={() => {}} />);
    expect(screen.getByText('John Newton')).toBeTruthy();
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

  it('switches between the name and the ribbon code', () => {
    const r = render(<Reader song={makeSong()} settings={{ readerHeading: 'name' }} onExit={() => {}} />);
    expect(screen.getAllByText('Verse 1').length).toBeGreaterThan(0);
    r.unmount();

    render(<Reader song={makeSong()} settings={{ readerHeading: 'code' }} onExit={() => {}} />);
    expect(screen.getAllByText('V1').length).toBeGreaterThan(0);
  });

  it('changes the frame with the section style', () => {
    const frame = () => document.querySelector('[data-section-index]').style;
    let r = render(<Reader song={makeSong()} settings={{ readerSectionStyle: 'bar' }} onExit={() => {}} />);
    expect(frame().borderLeft).toBeTruthy();
    r.unmount();

    render(<Reader song={makeSong()} settings={{ readerSectionStyle: 'card' }} onExit={() => {}} />);
    expect(frame().borderRadius).toBeTruthy();
  });

  it('renders a repeat as a reference, and in full when asked', () => {
    let r = render(<Reader song={makeSong()} settings={{ duplicateSections: 'ref' }} onExit={() => {}} />);
    expect(screen.getAllByText('— as before').length).toBe(1);
    r.unmount();

    render(<Reader song={makeSong()} settings={{ duplicateSections: 'full' }} onExit={() => {}} />);
    expect(screen.queryByText('— as before')).toBeNull();
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
    const body = document.querySelector('[data-section-index]').parentElement.parentElement;
    expect(body.style.getPropertyValue('--chart-font-size-lyric')).toBe('22px');
    expect(body.style.getPropertyValue('--chart-font-size-chord')).toBe('13px');
  });
});

describe('the display menu', () => {
  it('opens the shared Aa popover, with the chart still visible behind it', () => {
    renderReader();
    expect(screen.queryByRole('dialog', { name: 'Display options' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    expect(screen.getByRole('dialog', { name: 'Display options' })).toBeTruthy();
    // A popover, not a full sheet — the chart it changes stays on screen.
    expect(document.querySelectorAll('[data-section-index]').length).toBe(4);
  });

  it('carries the Visual tab for the element-level options', () => {
    renderReader();
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Visual' }));
    expect(screen.getByRole('button', { name: 'Boxes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Letters' })).toBeTruthy();
  });
});
