// Element 12 — the practice tools, mounted.
//
// Round 1 is metronome + slow-down, by decision. No count-in, no section loop,
// no wake lock. The click and the backing track slow down INDEPENDENTLY — they
// are not locked to one another.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Reader from '@/features/reader/Reader';
import { songFromFlat } from '@/arrangements';

vi.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => ({ allowed: true, requiredPlan: 'free', currentPlan: 'free' }),
  checkEntitlement: () => true,
}));

// The backing-track half mounts a real YouTube IFrame player otherwise.
const setPlaybackRate = vi.fn();
vi.mock('@/lib/embedPlayers', () => ({
  ensureYouTubeApi: () => Promise.resolve({
    PlayerState: { PLAYING: 1 },
    Player: class {
      constructor(el, opts) {
        this.opts = opts;
        this.getDuration = () => 210;
        this.getCurrentTime = () => 0;
        this.getAvailablePlaybackRates = () => [0.5, 0.75, 1, 1.25, 1.5];
        this.setPlaybackRate = setPlaybackRate;
        this.playVideo = () => {};
        this.pauseVideo = () => {};
        this.seekTo = () => {};
        this.destroy = () => {};
        // SYNCHRONOUS, not `setTimeout(…, 0)`. A real embed signals ready on a
        // later task, but reproducing that here bought nothing and cost a
        // flake: `trackReady` had to POLL for it, and under 56 test files in
        // parallel the timer was occasionally serviced late enough that a test
        // about playback rates failed for reasons that had nothing to do with
        // playback rates. Firing in the constructor makes readiness arrive at a
        // known point — the resolution of `ensureYouTubeApi` — so the test can
        // flush exactly one microtask and assert, with no clock in the loop.
        // Safe because the hook's `onReady` only touches `e.target`; the
        // `player` binding it doesn't have yet is used solely by
        // `onStateChange`, which fires later.
        opts.events.onReady({ target: this });
      }
    },
  }),
}));

function mockWidth(wide) {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: wide, media: query, addEventListener: () => {}, removeEventListener: () => {},
  }));
}

// jsdom has no Web Audio. The engine degrades to "no click" without one, so a
// minimal stub is needed to assert that the click actually runs.
class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = 'running';
    this.destination = {};
    FakeAudioContext.scheduled = [];
  }
  createOscillator() {
    const osc = { frequency: {}, connect: () => {}, start: (at) => FakeAudioContext.scheduled.push(at), stop: () => {} };
    return osc;
  }
  createGain() {
    return {
      gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {},
    };
  }
  resume() { this.state = 'running'; }
  close() {}
}

beforeEach(() => {
  mockWidth(true);
  setPlaybackRate.mockClear();
  window.AudioContext = FakeAudioContext;
});
afterEach(() => { delete window.AudioContext; });

function makeSong(over = {}) {
  return songFromFlat({
    id: 'song-1',
    title: 'Amazing Grace',
    key: 'G',
    tempo: 90,
    time: '3/4',
    structure: ['Verse 1'],
    sections: [{ type: 'Verse 1', lines: ['A[G]mazing [G7]grace'] }],
    ...over,
  });
}
// ⚠ `mode="practice"` is load-bearing now. These tests used to render in the
// DEFAULT mode, which resolves to LIVE, and that worked only because live once
// carried the click. It does not as of 2026-08-09 (owner: *"live gets no fab at
// all, not even metronome"*) — `readerConfig` sets `practiceTools: false` there,
// so element 12 exists in practice and nowhere else. Rendering the mode the
// feature actually lives in is the point, not a workaround.
const renderReader = (props = {}) =>
  render(<Reader song={makeSong()} settings={{}} mode="practice" onExit={() => {}} {...props} />);

// ⚠ Element 5 moved the click out of the top bar and into the floating action
// (owner, 2026-08-09: *"move everything else there"*). It kept its aria-label,
// so this is a relocation, not a rename.
//
// These tests render the reader in its default mode, which is LIVE — and live
// can do exactly one thing to a song, so the FAB collapses to BE the click
// rather than offering a stack of one. Hence the query: there is no 'Song
// actions' to open here, and that absence is the collapse working. In practice,
// where the stack is real, the same helper opens it.
const openSongActions = () => {
  const fab = screen.queryByRole('button', { name: 'Song actions' });
  if (fab) fireEvent.click(fab);
};
const openTools = () => {
  openSongActions();
  fireEvent.click(screen.getByRole('button', { name: 'Practice tools' }));
};
// Starting is the ROW's job, not the icon's.
const startClick = () => fireEvent.click(screen.getByRole('button', { name: 'Start the click' }));

// The play button is in the DOM (disabled) from the first frame, so its mere
// presence is NOT readiness — the rate list only arrives with the player's
// onReady, and pressing before that steps against a stale one-entry list.
//
// Readiness is exactly ONE microtask away: the hook builds the player inside
// `ensureYouTubeApi().then(...)` and the mock signals ready in the constructor.
// So this FLUSHES rather than polls. `waitFor` with a raised timeout was the
// previous shape and it was the wrong tool — a longer timeout makes a flake
// rarer, it does not remove the race. Nothing here waits on a clock, so a
// loaded event loop cannot change the outcome.
const trackReady = async () => {
  await act(async () => {});
  expect(screen.getByRole('button', { name: 'Play backing track' }).disabled).toBe(false);
};

describe('element 12 — getting to the tools', () => {
  it('is one control, and nothing until you tap it', () => {
    renderReader();
    openSongActions();
    expect(screen.getByRole('button', { name: 'Practice tools' })).toBeTruthy();
    // The row is not chrome you pay for while reading.
    expect(screen.queryByLabelText('Click tempo up')).toBeNull();
  });

  it('the icon opens the row and does NOT start the click', () => {
    // Tapping to see the tempo used to fill a quiet room with a click — the
    // tool announcing itself before being asked.
    renderReader();
    openTools();
    expect(screen.getByLabelText('Click tempo up')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start the click' })).toBeTruthy();
    expect(FakeAudioContext.scheduled ?? []).toHaveLength(0);
  });

  it('starts from the row’s own play button', () => {
    renderReader();
    openTools();
    startClick();
    expect(screen.getByRole('button', { name: 'Stop the click' })).toBeTruthy();
    expect(FakeAudioContext.scheduled.length).toBeGreaterThan(0);
  });

  it('closing puts the click away with the row', () => {
    renderReader();
    openTools();
    // Same pill, second state — the stack closes on pick, so it takes another
    // tap to get back to it.
    openSongActions();
    fireEvent.click(screen.getByRole('button', { name: 'Close practice tools' }));
    expect(screen.queryByLabelText('Click tempo up')).toBeNull();
  });

  it('silencing the click keeps the row — the track controls must survive it', () => {
    renderReader();
    openTools();
    startClick();
    fireEvent.click(screen.getByRole('button', { name: 'Stop the click' }));
    expect(screen.getByRole('button', { name: 'Start the click' })).toBeTruthy();
    expect(screen.getByLabelText('Click tempo up')).toBeTruthy();
  });

  it('leaves the toggle off when the device has no Web Audio at all', () => {
    // Better an honest dead switch than a running click that makes no sound.
    delete window.AudioContext;
    renderReader();
    openTools();
    startClick();
    expect(screen.getByRole('button', { name: 'Start the click' })).toBeTruthy();
  });
});

describe('element 12 — slow-down', () => {
  it('starts at the song’s written tempo', () => {
    renderReader();
    openTools();
    expect(screen.getByText('90')).toBeTruthy();
  });

  it('steps in whole bpm, both ways', () => {
    renderReader();
    openTools();
    fireEvent.pointerDown(screen.getByLabelText('Click tempo down'));
    expect(screen.getByText('89')).toBeTruthy();
    fireEvent.pointerDown(screen.getByLabelText('Click tempo up'));
    fireEvent.pointerDown(screen.getByLabelText('Click tempo up'));
    expect(screen.getByText('91')).toBeTruthy();
  });

  it('offers one tap back to the written tempo, and only once you have left it', () => {
    renderReader();
    openTools();
    expect(screen.queryByLabelText('Back to the written tempo, 90')).toBeNull();
    fireEvent.pointerDown(screen.getByLabelText('Click tempo down'));
    const back = screen.getByLabelText('Back to the written tempo, 90');
    fireEvent.click(back);
    expect(screen.getByText('90')).toBeTruthy();
  });

  it('falls back to a usable tempo when the song has none written', () => {
    render(<Reader song={makeSong({ tempo: '' })} settings={{}} mode="practice" onExit={() => {}} />);
    openTools();
    // 100, not 40: `Number('')` is 0 and would have clamped to the floor.
    expect(screen.getByText('100')).toBeTruthy();
  });
});

describe('element 12 — the backing track', () => {
  it('shows no transport for a song with no track — a dead one reads as broken', () => {
    renderReader();
    openTools();
    expect(screen.queryByRole('button', { name: 'Play backing track' })).toBeNull();
    expect(screen.queryByLabelText('Backing-track speed up')).toBeNull();
  });

  it('carries its own transport and speed when the song has a link', async () => {
    render(
      <Reader
        song={makeSong({ youtube: 'https://www.youtube.com/watch?v=abcdefghijk' })}
        settings={{}}
        mode="practice"
        onExit={() => {}}
      />,
    );
    openTools();
    await trackReady();
    expect(screen.getByRole('button', { name: 'Play backing track' })).toBeTruthy();
    expect(screen.getByText('1×')).toBeTruthy();
  });

  it('slows the track independently of the click', async () => {
    render(
      <Reader
        song={makeSong({ youtube: 'https://www.youtube.com/watch?v=abcdefghijk' })}
        settings={{}}
        mode="practice"
        onExit={() => {}}
      />,
    );
    openTools();
    await trackReady();

    fireEvent.pointerDown(screen.getByLabelText('Backing-track speed down'));
    // Steps through the rates the player actually offers, so it can never land
    // on one the embed will refuse.
    expect(setPlaybackRate).toHaveBeenCalledWith(0.75);
    // The click's tempo is untouched — the two are not locked together.
    expect(screen.getByText('90')).toBeTruthy();
  });
});

describe('element 12 — leaving a song', () => {
  it('stops a click rather than carrying it into the next song', () => {
    const { rerender } = renderReader();
    openTools();
    startClick();
    expect(screen.getByRole('button', { name: 'Stop the click' })).toBeTruthy();

    rerender(
      <Reader
        song={makeSong({ id: 'song-2', title: 'Goodness of God', tempo: 130 })}
        settings={{}}
        // ⚠ `mode` MUST be repeated. It was omitted here, and `Reader` defaults
        // to LIVE — so this rerender was changing the song AND the mode, and
        // once live started closing the practice row (it has no tools at all)
        // the row vanished for a reason that has nothing to do with the subject
        // of this test. A rerender drops every prop you do not restate.
        mode="practice"
        onExit={() => {}}
      />,
    );
    // A click left running from the last song is confidently wrong.
    expect(screen.getByRole('button', { name: 'Start the click' })).toBeTruthy();
    // And the tempo is the NEW song's, not the one left over.
    expect(screen.getByText('130')).toBeTruthy();
  });
});


// ── Live takes the tools away, and the row is state ─────────────────────────
//
// ⚠ `practiceOpen` OUTLIVED the mode that allowed it. The icon is gated
// (`can.practiceTools ? togglePractice : null`) and live sets that false — but
// gating the way IN says nothing about a row already open. The ☰'s Live switch
// appears during the live window and turns live ON, so: open the tools twenty
// minutes before the service, start the click, flip the switch — and the row
// stayed on screen with the click still running, in the one mode whose
// capability table says these tools do not exist.
describe('element 12 — when the service starts', () => {
  it('takes the row away when the reader goes live, and the click with it', () => {
    const { rerender } = render(
      <Reader song={makeSong()} settings={{}} mode="practice" onExit={() => {}} />
    );
    openTools();
    startClick();
    expect(screen.getByRole('button', { name: 'Stop the click' })).toBeTruthy();

    // What App does when the ☰'s Live switch is flipped.
    rerender(<Reader song={makeSong()} settings={{}} mode="live" onExit={() => {}} />);

    expect(screen.queryByLabelText('Click tempo up')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stop the click' })).toBeNull();
  });

  it('does not re-open the row by itself on the way back to practice', () => {
    const { rerender } = render(
      <Reader song={makeSong()} settings={{}} mode="practice" onExit={() => {}} />
    );
    openTools();
    rerender(<Reader song={makeSong()} settings={{}} mode="live" onExit={() => {}} />);
    rerender(<Reader song={makeSong()} settings={{}} mode="practice" onExit={() => {}} />);
    // Closed, not remembered: live closed it, and coming back is a fresh ask.
    expect(screen.queryByLabelText('Click tempo up')).toBeNull();
  });
});

// ── Save writes a number somebody CHOSE ─────────────────────────────────────
describe('element 12 — saving a tempo', () => {
  it('offers nothing to save on an untimed song until a tempo is chosen', () => {
    // ⚠ The test used to be "different from the song's tempo", and
    // `Number(undefined)` is NaN, which differs from everything. So opening
    // the row on a song with no tempo offered to save **100** — the fallback
    // constant, not a decision anybody made — before the user had done a thing.
    render(<Reader song={makeSong({ tempo: '' })} settings={{}} mode="practice"
      onExit={() => {}} onUpdateSong={() => {}} />);
    openTools();
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Save/ })).toBeNull();

    // …and it appears the moment one is.
    fireEvent.pointerDown(screen.getByLabelText('Click tempo up'));
    expect(screen.getByRole('button', { name: /^Save/ })).toBeTruthy();
  });

  it('offers nothing to save on a timed song nobody has touched', () => {
    render(<Reader song={makeSong()} settings={{}} mode="practice"
      onExit={() => {}} onUpdateSong={() => {}} />);
    openTools();
    expect(screen.queryByRole('button', { name: /^Save/ })).toBeNull();
  });

  it('writes the chosen tempo onto the song', () => {
    const onUpdateSong = vi.fn();
    render(<Reader song={makeSong()} settings={{}} mode="practice"
      onExit={() => {}} onUpdateSong={onUpdateSong} />);
    openTools();
    fireEvent.pointerDown(screen.getByLabelText('Click tempo down'));
    fireEvent.click(screen.getByRole('button', { name: /^Save/ }));
    expect(onUpdateSong).toHaveBeenCalledWith(expect.objectContaining({ tempo: 89 }));
  });

  it('has no Save at all in a library you cannot write to', () => {
    render(<Reader song={makeSong()} settings={{}} mode="practice" onExit={() => {}} />);
    openTools();
    fireEvent.pointerDown(screen.getByLabelText('Click tempo down'));
    expect(screen.queryByRole('button', { name: /^Save/ })).toBeNull();
  });
});
