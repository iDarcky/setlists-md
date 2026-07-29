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

  it('pins to the bottom of the screen, not to the end of the song', () => {
    // The reader is ONE scroll container, so a plain last-in-flow child sits
    // below the final section instead of on the bottom edge.
    renderIt();
    const bar = screen.getByText('1 / 3').closest('div[class*="sticky"]');
    expect(bar).toBeTruthy();
    expect(bar.className).toContain('bottom-0');
  });
});
