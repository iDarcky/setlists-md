// Element 10, on what "this slot" means when the same song appears twice.
//
// ⚠ The reader kept the key you are reading in twice, under two different
// identities. The PERSISTED half is per-SLOT and says so — `pickKey` writes
// `items[idx].transpose` because "it keeps it a decision about THIS set" — but
// the session map was keyed by SONG ID. Those agree until a service plays a
// song twice, which is a reprise: an ordinary thing to put in a set. Change
// the opener's key on the fly, walk to the reprise, and it opened in the
// opener's key, silently overriding the one the leader had saved for that
// slot. The slot is the identity everything else here already uses.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SetlistReader from '@/features/reader/SetlistReader';
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
  // Radix Select needs these in jsdom.
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const s1 = songFromFlat({ id: 's1', title: 'Cornerstone', key: 'C', sections: [{ type: 'Verse 1', lines: ['[C]a'] }] });
const s2 = songFromFlat({ id: 's2', title: 'Goodness of God', key: 'F', sections: [{ type: 'Verse 1', lines: ['[F]b'] }] });
// The opener, something else, then the SAME song again as a reprise — saved a
// tone up, which is the commonest reason to reprise at all.
const setlist = {
  id: 'sl1',
  items: [{ songId: 's1' }, { songId: 's2' }, { songId: 's1', transpose: 2 }],
};

const renderIt = (over = {}) => render(
  <SetlistReader setlist={setlist} songs={[s1, s2]} settings={{}} mode="live"
    onBack={() => {}} onFinish={() => {}} {...over} />
);
const keyPill = () => screen.getByRole('combobox', { name: 'Key (transpose)' });
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next song' }));
const pickKey = (letter) => {
  fireEvent.keyDown(keyPill(), { key: 'ArrowDown' });
  const opt = screen.getAllByRole('option').find(o => o.textContent.trim() === letter);
  fireEvent.click(opt);
};

describe('the key you are reading belongs to the slot, not the song', () => {
  it('opens each slot in its own saved key', () => {
    renderIt();
    expect(keyPill().textContent.trim()).toBe('C');
    next(); next();
    expect(screen.getByText('3 / 3')).toBeTruthy();
    expect(keyPill().textContent.trim()).toBe('D');
  });

  it('a key changed on the opener does not follow the song to its reprise', () => {
    renderIt();
    pickKey('A');
    expect(keyPill().textContent.trim()).toBe('A');
    next(); next();
    // Still the slot's own key — the reprise was saved at D and nobody touched it.
    expect(keyPill().textContent.trim()).toBe('D');
  });

  it('and the change is still there when you walk back to the slot you made it on', () => {
    renderIt();
    pickKey('A');
    next(); next();
    fireEvent.click(screen.getByRole('button', { name: 'Previous song' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous song' }));
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(keyPill().textContent.trim()).toBe('A');
  });

  // The footer names what is coming, and it must name the NEXT SLOT's key —
  // the same lookup, one index along.
  it('the footer names the next slot in the next slot key', () => {
    renderIt();
    next();
    expect(screen.getByText('2 / 3')).toBeTruthy();
    // Next up is the reprise of Cornerstone, at D.
    expect(screen.getAllByText('Cornerstone').length).toBeGreaterThan(0);
    expect(screen.getAllByText('D').length).toBeGreaterThan(0);
  });
});
