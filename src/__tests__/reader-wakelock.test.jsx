// Who keeps the screen on, and why.
//
// ⚠ This file exists because the graduation nearly shipped a silent regression
// of exactly this: `SetlistPlayer` and `PerformanceView` called
// `useWakeLock(true)` unconditionally, and the Reader that replaced them asked
// `settings.keepAwake`, which has no entry in DEFAULT_SETTINGS and is therefore
// `undefined` for anyone who never opened Settings. Nothing would have thrown.
// Screens would just have started sleeping mid-service.
//
// The rule now has two halves and they are different KINDS of thing, so both
// are pinned: LIVE is a fact (not a setting), everything else is the user's
// switch (default off).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import Reader from '@/features/reader/Reader';
import { songFromFlat } from '@/arrangements';

const wakeLockCalls = [];
vi.mock('@/hooks/useWakeLock', () => ({
  useWakeLock: (active) => { wakeLockCalls.push(active); },
}));
vi.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => ({ allowed: true, requiredPlan: 'free', currentPlan: 'free' }),
  checkEntitlement: () => true,
}));

beforeEach(() => {
  wakeLockCalls.length = 0;
  window.innerWidth = 1024;
  window.matchMedia = vi.fn().mockImplementation(query => {
    const m = /\(min-width:\s*(\d+)px\)/.exec(query);
    const mx = /\(max-width:\s*([\d.]+)px\)/.exec(query);
    let matches = false;
    if (m) matches = window.innerWidth >= parseInt(m[1], 10);
    else if (mx) matches = window.innerWidth <= parseFloat(mx[1]);
    return { matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() };
  });
});

const song = () => songFromFlat({
  id: 's1', title: 'Amazing Grace', artist: 'John Newton', key: 'G',
  structure: ['Verse 1'],
  sections: [{ type: 'Verse 1', lines: ['A[G]mazing grace'] }],
});

// The last value is what the component settled on for this render.
const held = () => wakeLockCalls[wakeLockCalls.length - 1];

describe('keeping the screen on', () => {
  it('LIVE holds it, with the setting off', () => {
    // The half that is NOT a preference. Nobody goes live wanting the screen to
    // sleep, so this must not consult `keepAwake` at all.
    render(<Reader song={song()} settings={{}} mode="live" onExit={() => {}} />);
    expect(held()).toBe(true);
  });

  it('LIVE holds it even with the setting explicitly OFF', () => {
    render(<Reader song={song()} settings={{ keepAwake: false }} mode="live" onExit={() => {}} />);
    expect(held()).toBe(true);
  });

  it('off-live it is the user\'s switch, and the default is off', () => {
    render(<Reader song={song()} settings={{}} mode="practice" onExit={() => {}} />);
    expect(held()).toBe(false);
  });

  it('off-live the switch turns it on', () => {
    render(<Reader song={song()} settings={{ keepAwake: true }} mode="practice" onExit={() => {}} />);
    expect(held()).toBe(true);
  });

  it('never when embedded — a card in a page is not a screen you read from', () => {
    // The hub holds its own wake lock for the whole page; a second one for a
    // card inside it is the app deciding your phone should not sleep while you
    // browse. `embedded` wins over both halves of the rule.
    render(<Reader song={song()} settings={{ keepAwake: true }} embedded onExit={() => {}} />);
    expect(held()).toBe(false);
  });
});
