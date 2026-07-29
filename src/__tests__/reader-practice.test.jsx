// Element 12 — the practice tools, mounted.
//
// Round 1 is metronome + slow-down, by decision. No count-in, no section loop,
// no wake lock. The click and the backing track slow down INDEPENDENTLY — they
// are not locked to one another.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
        setTimeout(() => opts.events.onReady({ target: this }), 0);
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
const renderReader = (props = {}) =>
  render(<Reader song={makeSong()} settings={{}} onExit={() => {}} {...props} />);

const openTools = () => fireEvent.click(screen.getByRole('button', { name: 'Practice tools' }));

// The play button is in the DOM (disabled) from the first frame, so its mere
// presence is NOT readiness — the rate list only arrives with the player's
// onReady, and pressing before that steps against a stale one-entry list.
const trackReady = () => waitFor(() =>
  expect(screen.getByRole('button', { name: 'Play backing track' }).disabled).toBe(false));

describe('element 12 — getting to the tools', () => {
  it('is one icon beside the menu, and nothing until you tap it', () => {
    renderReader();
    expect(screen.getByRole('button', { name: 'Practice tools' })).toBeTruthy();
    // The row is not chrome you pay for while reading.
    expect(screen.queryByLabelText('Click tempo up')).toBeNull();
  });

  it('the icon IS the switch — opening starts the click', () => {
    renderReader();
    openTools();
    expect(screen.getByLabelText('Click tempo up')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stop the click' })).toBeTruthy();
    expect(FakeAudioContext.scheduled.length).toBeGreaterThan(0);
  });

  it('closing puts the click away with the row', () => {
    renderReader();
    openTools();
    fireEvent.click(screen.getByRole('button', { name: 'Close practice tools' }));
    expect(screen.queryByLabelText('Click tempo up')).toBeNull();
  });

  it('silencing the click keeps the row — the track controls must survive it', () => {
    renderReader();
    openTools();
    fireEvent.click(screen.getByRole('button', { name: 'Stop the click' }));
    expect(screen.getByRole('button', { name: 'Start the click' })).toBeTruthy();
    expect(screen.getByLabelText('Click tempo up')).toBeTruthy();
  });

  it('leaves the toggle off when the device has no Web Audio at all', () => {
    // Better an honest dead switch than a running click that makes no sound.
    delete window.AudioContext;
    renderReader();
    openTools();
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
    render(<Reader song={makeSong({ tempo: '' })} settings={{}} onExit={() => {}} />);
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
    expect(screen.getByRole('button', { name: 'Stop the click' })).toBeTruthy();

    rerender(
      <Reader
        song={makeSong({ id: 'song-2', title: 'Goodness of God', tempo: 130 })}
        settings={{}}
        onExit={() => {}}
      />,
    );
    // A click left running from the last song is confidently wrong.
    expect(screen.getByRole('button', { name: 'Start the click' })).toBeTruthy();
    // And the tempo is the NEW song's, not the one left over.
    expect(screen.getByText('130')).toBeTruthy();
  });
});
