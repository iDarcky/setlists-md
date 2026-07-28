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

  it('keeps a ✕ even when the user asks for pull-only, unless they are embedded', () => {
    // 'pull' hides the button; the pull bar itself is still an exit control,
    // so an Exit affordance exists either way.
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
