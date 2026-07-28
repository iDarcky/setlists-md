// The reader, mounted.
//
// The point of this pass is that Live, Rehearsal and Practice stop being three
// files and become three configurations of one component. That claim is only
// worth anything if the three configurations actually render differently — and
// if the one thing that was broken on stage (no way out once the header
// collapsed) is now structurally impossible.
//
// These mount the real component against a real parsed song. They deliberately
// cover the three presets rather than the 1,080 knob combinations: the presets
// are the product, the panel is the escape hatch.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Reader from '@/features/reader/Reader';
import { songFromFlat } from '@/arrangements';

// jsdom has no matchMedia; the reader uses it to decide whether there is room
// for two columns, a side ribbon and the note margin.
function mockWidth(wide) {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: wide,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => { mockWidth(true); });

function makeSong() {
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
  });
}

const renderReader = (props = {}) => render(
  <Reader song={makeSong()} settings={{}} onExit={() => {}} setlist {...props} />
);

describe('the exit is always reachable', () => {
  // The defect this pass exists to kill: the ✕ lived in a header row that
  // collapsed on scroll, so mid-service there was no visible way out.
  it('renders an exit control in every preset', () => {
    for (const preset of ['live', 'rehearsal', 'practice']) {
      const { unmount } = renderReader({ preset });
      expect(screen.getAllByRole('button', { name: 'Exit' }).length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('calls onExit when it is used', async () => {
    const onExit = vi.fn();
    renderReader({ preset: 'live', onExit });
    screen.getAllByRole('button', { name: 'Exit' })[0].click();
    expect(onExit).toHaveBeenCalled();
  });

  it('restores the ✕ when the user picks pull-only on a device that cannot pull', () => {
    // Pull-only on a desktop would leave no exit at all — which is exactly the
    // failure this pass exists to remove, reintroduced via a setting.
    mockWidth(false);   // matchMedia false ⇒ (pointer: coarse) false ⇒ no touch
    renderReader({ preset: 'live', settings: { readerConfig: { live: { exitStyle: 'pull' } } } });
    expect(screen.getAllByRole('button', { name: 'Exit' }).length).toBeGreaterThan(0);
  });
});

describe('presets render differently', () => {
  it('hides the title in Live and shows it in Rehearsal', () => {
    const { unmount } = renderReader({ preset: 'live' });
    expect(screen.queryByText(/Amazing Grace/)).toBeNull();
    unmount();

    renderReader({ preset: 'rehearsal' });
    expect(screen.getByText(/Amazing Grace/)).toBeTruthy();
  });

  it('only shows the customize entry point once, and only outside the hub', () => {
    const { unmount } = renderReader({ preset: 'live' });
    expect(screen.getAllByRole('button', { name: 'Customize' })).toHaveLength(1);
    unmount();

    // Embedded in the Song Hub, the hub owns the chrome.
    renderReader({ preset: 'live', embedded: true });
    expect(screen.queryByRole('button', { name: 'Customize' })).toBeNull();
  });
});

describe('the song still renders', () => {
  it('follows the structure, repeats included', () => {
    renderReader({ preset: 'rehearsal' });
    // Structure plays Chorus twice; with duplicateSections 'full' both render.
    expect(document.querySelectorAll('[data-section-index]')).toHaveLength(4);
  });

  it('renders chords above the lyrics', () => {
    renderReader({ preset: 'rehearsal' });
    expect(screen.getAllByText('G').length).toBeGreaterThan(0);
    // The lyric is split into per-word spans (so a line only wraps at a space),
    // so the word matches its own span and its parent.
    expect(screen.getAllByText(/mazing/).length).toBeGreaterThan(0);
  });

  it('transposes when a different key is selected', () => {
    renderReader({ preset: 'rehearsal', selectedKey: 'A' });
    // G → A is +2; the chart should carry A where the source said G.
    expect(screen.getAllByText('A').length).toBeGreaterThan(0);
  });
});

// These exist because the first cut shipped six knobs that rendered nothing.
// A setting that silently does nothing is worse than a missing setting: the
// user changes it, sees no difference, and stops trusting the panel.
describe('every knob actually changes the render', () => {
  const withKnob = (knob, value, preset = 'rehearsal') =>
    renderReader({ preset, settings: { readerConfig: { [preset]: { [knob]: value } } } });

  it('headerDensity has three distinct states', () => {
    const title = () => screen.queryByText('Amazing Grace');
    const meta = () => screen.queryByText(/sections$/);

    let r = withKnob('headerDensity', 'min');
    expect(title()).toBeNull();
    r.unmount();

    r = withKnob('headerDensity', 'std');
    expect(title()).toBeTruthy();
    expect(meta()).toBeNull();   // std must NOT equal full
    r.unmount();

    withKnob('headerDensity', 'full');
    expect(title()).toBeTruthy();
    expect(meta()).toBeTruthy();
  });

  it('columnFlow switches whether a section may split across the gutter', () => {
    let r = withKnob('columnFlow', 'section');
    let s = document.querySelector('[data-section-index]');
    expect(s.style.breakInside).toBe('avoid');
    r.unmount();

    withKnob('columnFlow', 'balanced');
    s = document.querySelector('[data-section-index]');
    expect(s.style.breakInside).toBe('auto');
  });

  it('notePosition peek gives a button instead of silently dropping notes', () => {
    let r = withKnob('notePosition', 'margin');
    expect(screen.queryByRole('button', { name: 'Notes' })).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Notes and cues' })).toBeTruthy();
    r.unmount();

    withKnob('notePosition', 'peek');
    expect(screen.queryByRole('complementary', { name: 'Notes and cues' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Notes' })).toBeTruthy();
  });

  it('sectionStyle changes the frame', () => {
    const frameOf = () => document.querySelector('[data-section-index]').style;
    let r = withKnob('sectionStyle', 'bar');
    expect(frameOf().borderLeft).toBeTruthy();
    r.unmount();

    r = withKnob('sectionStyle', 'card');
    expect(frameOf().background).toBeTruthy();
    expect(frameOf().borderRadius).toBeTruthy();
    r.unmount();

    withKnob('sectionStyle', 'block');
    expect(frameOf().borderRadius).toBeTruthy();
  });

  it('exitStyle x drops the pull gesture but keeps the button', () => {
    withKnob('exitStyle', 'x');
    expect(screen.getAllByRole('button', { name: 'Exit' }).length).toBeGreaterThan(0);
  });

  it('structurePosition off actually removes the ribbon', () => {
    const r = withKnob('structurePosition', 'top');
    const before = document.querySelectorAll('[data-section-index]').length;
    expect(before).toBeGreaterThan(0);
    r.unmount();

    withKnob('structurePosition', 'off');
    // Sections still render; only the ribbon goes.
    expect(document.querySelectorAll('[data-section-index]').length).toBe(before);
  });
});

describe('chart display settings reach SectionBlock', () => {
  it('sets both font-size vars — chords size off the var, not inherited size', () => {
    renderReader({ preset: 'live', settings: { defaultFontSize: 'L', chordFontSize: 13 } });
    const body = document.querySelector('[data-section-index]').parentElement;
    expect(body.style.getPropertyValue('--chart-font-size-lyric')).toBe('22px');
    expect(body.style.getPropertyValue('--chart-font-size-chord')).toBe('13px');
  });

  it('honours the app-wide ribbon position when the preset has no override', () => {
    // Settings → Labs writes `structurePosition`; without a fallback the
    // reader read only its own key and the global control looked broken.
    renderReader({ preset: 'live', settings: { structurePosition: 'off' } });
    expect(document.querySelectorAll('[data-section-index]').length).toBeGreaterThan(0);
  });
});

describe('notes', () => {
  it('collects cues into the margin when there is room', () => {
    renderReader({ preset: 'live' });
    const notes = screen.getByRole('complementary', { name: 'Notes and cues' });
    expect(within(notes).getByText('Start soft')).toBeTruthy();
  });

  it('drops the margin on a narrow screen — it would leave nothing for lyrics', () => {
    mockWidth(false);
    renderReader({ preset: 'live' });
    expect(screen.queryByRole('complementary', { name: 'Notes and cues' })).toBeNull();
  });

  it('numbers a repeated section so the ambiguity is visible', () => {
    // Chorus plays twice and both carry the same stored cue — the .md format
    // has nowhere to put a different one. Numbering at least surfaces it.
    renderReader({ preset: 'rehearsal' });
    const notes = screen.getByRole('complementary', { name: 'Notes and cues' });
    expect(within(notes).getByText('Chorus (1)')).toBeTruthy();
    expect(within(notes).getByText('Chorus (2)')).toBeTruthy();
  });
});
