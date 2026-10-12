// Element 11 — tap a chord, see that chord. On the two ways that failed for
// the SECOND chord you ask about.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Reader from '@/features/reader/Reader';
import { songFromFlat } from '@/arrangements';

vi.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => ({ allowed: true, requiredPlan: 'free', currentPlan: 'free' }),
  checkEntitlement: () => true,
}));

beforeEach(() => {
  try { localStorage.clear(); } catch { /* private mode */ }
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {},
  }));
});

// Two G's in different places, which is what a song is: chords repeat.
const song = songFromFlat({
  id: 's1', title: 'Cornerstone', key: 'G',
  sections: [
    { type: 'Verse 1', lines: ['[G]My hope is [C]built'] },
    { type: 'Chorus', lines: ['[G]Christ alone [D]cornerstone'] },
  ],
});

const chords = (name) => screen.getAllByRole('button', { name: `${name} chord shape` });
const popover = () => document.querySelector('[role="dialog"][aria-label$="chord shape"]');

// jsdom gives every element a 0×0 rect, so the two G's would compare equal and
// the occurrence toggle could not be told from the name toggle. Stamp a
// distinct box per element, the way a browser would.
const stampRects = () => {
  let n = 0;
  for (const el of document.querySelectorAll('[data-chord-tap]')) {
    const top = 40 * (n += 1);
    el.getBoundingClientRect = () => ({ left: 10, top, right: 40, bottom: top + 20, width: 30, height: 20, x: 10, y: top });
  }
};

describe('the popover follows the chord you tapped', () => {
  it('opens on the chord you asked about', () => {
    render(<Reader song={song} settings={{}} />);
    stampRects();
    fireEvent.click(chords('G')[0]);
    expect(popover()).toBeTruthy();
    expect(popover().getAttribute('aria-label')).toBe('G chord shape');
  });

  // ⚠ THE BUG. The toggle was keyed on the chord NAME, so tapping the chorus's
  // G while the verse's G was open read as "the same chord again" and closed.
  // A tap on a chord you had not asked about yet answered by showing nothing.
  it('moves to another occurrence of the SAME chord instead of closing', () => {
    render(<Reader song={song} settings={{}} />);
    stampRects();
    const gs = chords('G');
    expect(gs.length).toBe(2);
    fireEvent.click(gs[0]);
    expect(popover()).toBeTruthy();
    fireEvent.click(gs[1]);
    expect(popover()).toBeTruthy();
    expect(popover().getAttribute('aria-label')).toBe('G chord shape');
  });

  it('and tapping the very same chord again does close it', () => {
    render(<Reader song={song} settings={{}} />);
    stampRects();
    const g = chords('G')[0];
    fireEvent.click(g);
    expect(popover()).toBeTruthy();
    fireEvent.click(g);
    expect(popover()).toBeNull();
  });

  it('moves between different chords', () => {
    render(<Reader song={song} settings={{}} />);
    stampRects();
    fireEvent.click(chords('G')[0]);
    fireEvent.click(chords('C')[0]);
    expect(popover().getAttribute('aria-label')).toBe('C chord shape');
  });

  // The backdrop is what stops a dismissing tap pressing the reader's chrome
  // underneath — including the ✕. It must still be there; what changed is that
  // it forwards a tap that lands on a chord (measured in Chromium, see
  // `ChordPopover`).
  it('still covers the screen so a dismissing tap presses nothing beneath it', () => {
    render(<Reader song={song} settings={{}} />);
    stampRects();
    fireEvent.click(chords('G')[0]);
    const backdrop = document.querySelector('.fixed.inset-0.z-\\[200\\]');
    expect(backdrop).toBeTruthy();
    expect(backdrop.getAttribute('aria-hidden')).toBe('true');
  });

  it('marks every tappable chord so the backdrop can recognise one', () => {
    render(<Reader song={song} settings={{}} />);
    expect(document.querySelectorAll('[data-chord-tap]').length).toBe(4);
  });
});
