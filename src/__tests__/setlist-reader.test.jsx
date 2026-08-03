// Element 10 — the footer, and the break that shares it.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SetlistReader from '@/features/reader/SetlistReader';
import { songFromFlat } from '@/arrangements';

vi.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => ({ allowed: true, requiredPlan: 'free', currentPlan: 'free' }),
  checkEntitlement: () => true,
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {},
  }));
});

const songs = [
  songFromFlat({ id: 's1', title: 'Amazing Grace', key: 'G', sections: [{ type: 'Verse 1', lines: ['[G]a'] }] }),
  songFromFlat({ id: 's2', title: 'Goodness of God', key: 'A', sections: [{ type: 'Verse 1', lines: ['[A]b'] }] }),
];
const setlist = {
  id: 'sl1',
  items: [
    { songId: 's1' },
    { type: 'break', label: 'Offering', duration: 5, note: 'Keys stay under' },
    { songId: 's2' },
  ],
};
const renderIt = (settings = {}) => render(
  <SetlistReader setlist={setlist} songs={songs} settings={settings} onBack={() => {}} onFinish={() => {}} />
);

describe('element 10 — the footer', () => {
  it('names the next song by default, with its key', () => {
    renderIt();
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(screen.getByText('Offering')).toBeTruthy();   // the next item is the break
  });

  it('drops to the count alone when asked', () => {
    renderIt({ readerFooter: 'count' });
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(screen.queryByText('· Next')).toBeNull();
  });

  it('is the SAME row on a break — no exit stranded inside it', () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Next song' }));

    // Still the footer, still in the same shape.
    expect(screen.getByText('2 / 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous song' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next song' })).toBeTruthy();
    // ...and it names what follows, exactly as it does on a song.
    expect(screen.getAllByText('Goodness of God').length).toBeGreaterThan(0);
    // Exit lives in the top bar on a break too, never in the nav row.
    expect(screen.getByRole('button', { name: 'Exit' })).toBeTruthy();
  });

  it('offers Finish only on the last item', () => {
    renderIt();
    expect(screen.queryByRole('button', { name: 'Finish' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next song' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next song' }));
    expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
    expect(screen.getByText('· Last song')).toBeTruthy();
  });

  it('opens the setlist from the counter', () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Open setlist' }));
    // Every item is reachable, not just the neighbours.
    expect(screen.getAllByText('Goodness of God').length).toBeGreaterThan(0);
  });

  it('pins to the bottom of the screen, not to the end of the song', () => {
    // The reader is ONE scroll container, so a plain last-in-flow child sits
    // below the final section instead of on the bottom edge.
    renderIt();
    const bar = screen.getByText('1 / 3').closest('div[class*="sticky"]');
    expect(bar).toBeTruthy();
    expect(bar.className).toContain('bottom-0');
  });
});

describe('the break screen', () => {
  const atBreak = (settings = {}, over = {}) => {
    const sl = { ...setlist, items: [{ songId: 's1' }, { type: 'break', ...over }, { songId: 's2' }] };
    render(<SetlistReader setlist={sl} songs={songs} settings={settings} onBack={() => {}} onFinish={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next song' }));
  };

  it('names the break ONCE, in the same bar a song uses', () => {
    atBreak({}, { label: 'Benedicție', duration: 5 });
    // Three copies of the same word — bar title, eyebrow and heading — was the
    // break answering a question nobody asked.
    expect(screen.getAllByText('Benedicție').length).toBe(1);
    expect(screen.getByRole('button', { name: 'Exit' })).toBeTruthy();
  });

  it('never renders a stray 0 for a break with no length', () => {
    // `duration && <…>` renders the literal 0 when duration is 0.
    atBreak({}, { label: 'Benedicție', duration: 0 });
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.getByText('Break')).toBeTruthy();
  });

  // The bar has now drifted away from the song's TWICE — first as a hand-rolled
  // second component, then (once that was fixed by sharing `ReaderTopBar`) by
  // passing it three props. Sharing the component is not enough on its own.
  it('carries the SAME bar as a song — ☰ and ✕, not just ✕', () => {
    atBreak({}, { label: 'Offering', duration: 5 });
    expect(screen.getByRole('button', { name: 'Display options' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Exit' })).toBeTruthy();
  });

  it('carries the set bar when the set bar is on', () => {
    atBreak({ readerTopBar: 'setlist' }, { label: 'Offering', duration: 5 });
    // Every item in the service, on the break too — losing the map of the set
    // is the one thing the reader must not do.
    expect(screen.getByRole('button', { name: 'Break: Offering' })).toBeTruthy();
    expect(screen.getAllByText('Amazing Grace').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Goodness of God').length).toBeGreaterThan(0);
  });

  it('opens the ☰ from the break, with no song to read', () => {
    atBreak({}, { label: 'Offering' });
    fireEvent.click(screen.getByRole('button', { name: 'Display options' }));
    // Look and Layout are settings, so they work with no song at all.
    expect(screen.getByRole('dialog', { name: 'Reader menu' })).toBeTruthy();
    expect(screen.getByText('Look')).toBeTruthy();
    expect(screen.getByText('Layout')).toBeTruthy();
  });
});

describe('element 10 — the other nav styles', () => {
  const at = (nav) => renderIt({ readerNav: nav });

  it('floats a pill instead of the bar', () => {
    at('pill');
    expect(screen.getByRole('button', { name: 'Next song' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open setlist' })).toBeTruthy();
  });

  it('pins arrows to the screen edges', () => {
    at('edge');
    expect(screen.getByRole('button', { name: /Next/ })).toBeTruthy();
    // Edge arrows carry no counter, so the setlist needs its own way in.
    expect(screen.getByRole('button', { name: 'Open setlist' })).toBeTruthy();
  });

  it('leaves only the counter chip when swiping', () => {
    at('swipe');
    expect(screen.queryByRole('button', { name: 'Next song' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open setlist' })).toBeTruthy();
  });

  it('keeps the keyboard and pedal working whatever the choice is', () => {
    at('swipe');
    fireEvent.keyDown(window, { key: 'PageDown' });
    expect(screen.getByRole('button', { name: 'Open setlist' }).textContent).toContain('2 / 3');
  });
});

// The rail from the top bar (owner, 2026-08-03) — BESIDE the footer counter,
// never instead of it.
describe('the rail button in the top bar', () => {
  it('is a second way in, not a replacement for the counter', () => {
    renderIt();
    expect(screen.getByRole('button', { name: 'Setlist' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open setlist' })).toBeTruthy();
  });

  it('opens the rail', () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Setlist' }));
    expect(screen.getByRole('button', { name: 'Setlist' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByText('Goodness of God').length).toBeGreaterThan(0);
  });

  it('is on the break and the missing-song screen too', () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Next song' }));
    expect(screen.getByRole('button', { name: 'Setlist' })).toBeTruthy();
  });

  it('is absent on a phone, where the footer counter is already at the thumb', () => {
    // `wide` is false — the rail is a bottom sheet there, and a second opener
    // at the TOP of the screen is element 26's reachability problem, not a fix.
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    renderIt();
    expect(screen.queryByRole('button', { name: 'Setlist' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open setlist' })).toBeTruthy();
  });
});

// ── Element 13 — what the reader hands the finale ─────────────────────────────
describe('element 13 — the session handed to the finale', () => {
  it('carries a real start time — the finale used to read 0s', () => {
    const onFinish = vi.fn();
    const before = Date.now();
    render(<SetlistReader setlist={setlist} songs={songs} settings={{}} onBack={() => {}} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next song' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next song' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    const { startTime } = onFinish.mock.calls[0][0];
    expect(startTime).toBeGreaterThanOrEqual(before);
    expect(startTime).toBeLessThanOrEqual(Date.now());
  });

  it('hands over the start time and NOTHING else', () => {
    // An earlier cut also sent the whole set (`played`) for the finale to list.
    // That list turned a full stop into a page you scroll and was cut; the
    // payload went with it rather than lingering as dead weight.
    const onFinish = vi.fn();
    render(<SetlistReader setlist={setlist} songs={songs} settings={{}} onBack={() => {}} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next song' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next song' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    expect(Object.keys(onFinish.mock.calls[0][0])).toEqual(['startTime']);
  });
});

describe('starting from a chosen song', () => {
  // The setlist overview sends the index of the row you tapped ("Open practice
  // from here"). `PracticeView` honoured it; the reader that replaced it
  // dropped it on the floor and always opened song 1.
  it('opens the item the setlist sent, not the first one', () => {
    render(
      <SetlistReader setlist={setlist} songs={songs} settings={{}} startIndex={2}
        onBack={() => {}} onFinish={() => {}} />,
    );
    expect(screen.getByText('3 / 3')).toBeTruthy();
    expect(screen.getAllByText(/Goodness of God/).length).toBeGreaterThan(0);
  });

  it('ignores an index that is out of range rather than rendering nothing', () => {
    render(
      <SetlistReader setlist={setlist} songs={songs} settings={{}} startIndex={99}
        onBack={() => {}} onFinish={() => {}} />,
    );
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });
});

// ── Edit mode ───────────────────────────────────────────────────────────────
// Practice only (owner, 2026-08-03). Editing a shared object mid-service, in a
// hurry, is the same argument MissingSongScreen uses for refusing "remove from
// setlist".
describe('edit mode', () => {
  // A song with a real play order — one section has nothing to reorder, and
  // the move handles are (correctly) disabled at the ends.
  const multi = songFromFlat({
    id: 'm1', title: 'Cornerstone', key: 'C',
    sections: [
      { type: 'Verse 1', lines: ['[C]a'] },
      { type: 'Chorus', lines: ['[F]b'] },
      { type: 'Verse 2', lines: ['[G]c'] },
    ],
  });
  const multiSet = { id: 'sl2', items: [{ songId: 'm1' }] };
  const renderMode = (mode, over = {}) => render(
    <SetlistReader
      setlist={multiSet} songs={[multi]} settings={{}} mode={mode}
      onBack={() => {}} onFinish={() => {}} onUpdateSong={vi.fn()} {...over}
    />
  );

  it('is not offered in live, at all', () => {
    renderMode('live');
    expect(screen.queryByRole('button', { name: 'Edit this song' })).toBeNull();
  });

  it('is offered in practice', () => {
    renderMode('practice');
    expect(screen.getByRole('button', { name: 'Edit this song' })).toBeTruthy();
  });

  it('needs somewhere to write — a read-only library gets no edit button', () => {
    // App passes `onUpdateSong = null` in a team library the user can't write
    // to. Without this the button would appear and silently do nothing.
    renderMode('practice', { onUpdateSong: null });
    expect(screen.queryByRole('button', { name: 'Edit this song' })).toBeNull();
  });

  it('turns the tempo and the time into fields, in place', () => {
    renderMode('practice');
    // Not a panel: the values that were already in the bar become editable
    // where they were.
    expect(screen.queryByLabelText('Tempo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit this song' }));
    expect(screen.getByLabelText('Tempo')).toBeTruthy();
    expect(screen.getByLabelText('Time signature')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stop editing' })).toBeTruthy();
  });

  it('writes a tempo on Enter, not on every keystroke', () => {
    const onUpdateSong = vi.fn();
    renderMode('practice', { onUpdateSong });
    fireEvent.click(screen.getByRole('button', { name: 'Edit this song' }));
    const field = screen.getByLabelText('Tempo');
    fireEvent.change(field, { target: { value: '96' } });
    // A half-typed "9" is a real tempo the metronome would try to use.
    expect(onUpdateSong).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(onUpdateSong).toHaveBeenCalledWith(expect.objectContaining({ tempo: 96 }));
  });

  it('gives each section a play-order handle, and reorders the STRUCTURE', () => {
    const onUpdateSong = vi.fn();
    renderMode('practice', { onUpdateSong });
    fireEvent.click(screen.getByRole('button', { name: 'Edit this song' }));
    // At the ends the handles are disabled — there is nowhere to go.
    expect(screen.getByRole('button', { name: 'Move Verse 1 earlier' }).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Move Verse 1 later' }));
    // The play order is written down and marked custom, and the section BODIES
    // are untouched — reordering must never rewrite the words.
    expect(onUpdateSong).toHaveBeenCalledWith(expect.objectContaining({
      structure: ['Chorus', 'Verse 1', 'Verse 2'],
      structureMode: 'custom',
    }));
    expect(onUpdateSong.mock.calls[0][0].sections).toHaveLength(3);
  });

  it('takes a section out of the play order without deleting it', () => {
    const onUpdateSong = vi.fn();
    renderMode('practice', { onUpdateSong });
    fireEvent.click(screen.getByRole('button', { name: 'Edit this song' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take Chorus out of the play order' }));
    const written = onUpdateSong.mock.calls[0][0];
    expect(written.structure).toEqual(['Verse 1', 'Verse 2']);
    // The words survive. The same body is referenced by every slot that names
    // it, so deleting bodies here would empty the other repeats too.
    expect(written.sections).toHaveLength(3);
  });

  it('offers the fork only once something has changed', () => {
    const onUpdateSong = vi.fn();
    const { rerender } = render(
      <SetlistReader
        setlist={multiSet} songs={[multi]} settings={{}} mode="practice"
        onBack={() => {}} onFinish={() => {}}
        onUpdateSong={onUpdateSong} onSaveAsArrangement={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit this song' }));
    // Forking an untouched song makes a duplicate, not an arrangement.
    expect(screen.queryByRole('button', { name: 'Save as a new arrangement' })).toBeNull();

    // Once the song really differs from the snapshot, it appears.
    fireEvent.click(screen.getByRole('button', { name: 'Move Verse 1 later' }));
    const edited = { ...onUpdateSong.mock.calls[0][0] };
    const nextSong = { ...multi, arrangements: [{ ...multi.arrangements[0], structure: edited.structure, structureMode: 'custom' }] };
    rerender(
      <SetlistReader
        setlist={multiSet} songs={[nextSong]} settings={{}} mode="practice"
        onBack={() => {}} onFinish={() => {}}
        onUpdateSong={onUpdateSong} onSaveAsArrangement={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Save as a new arrangement' })).toBeTruthy();
  });

  // Owner, 2026-08-03: "it should not allow me to leave while I have the editor
  // open." Leaving mid-edit stranded the change — applied, with no way back to
  // Cancel it.
  it('will not let you walk out through the exit', () => {
    renderMode('practice');
    expect(screen.getByRole('button', { name: 'Exit' }).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Edit this song' }));
    expect(screen.getByRole('button', { name: 'Exit' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Exit' }).disabled).toBe(false);
  });

  it('has nothing to undo until something is done', () => {
    renderMode('practice');
    fireEvent.click(screen.getByRole('button', { name: 'Edit this song' }));
    expect(screen.getByRole('button', { name: 'Undo the last change' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Move Verse 1 later' }));
    expect(screen.getByRole('button', { name: 'Undo the last change' }).disabled).toBe(false);
  });

  it('puts everything back on Cancel', () => {
    const onUpdateSong = vi.fn();
    renderMode('practice', { onUpdateSong });
    fireEvent.click(screen.getByRole('button', { name: 'Edit this song' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Verse 1 later' }));
    onUpdateSong.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    // Restored from the snapshot taken on entry — the same one the fork uses.
    expect(onUpdateSong).toHaveBeenCalledWith(expect.objectContaining({
      structure: multi.arrangements[0].structure,
    }));
    // ...and edit mode is over, so the exit works again.
    expect(screen.getByRole('button', { name: 'Exit' }).disabled).toBe(false);
  });
});
