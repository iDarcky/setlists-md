// Two questions the reader's bar answers: *can I open this?* and *what is the
// number I play by?*
//
// Owner, 2026-08-23: *"How do we hint to the user that they can tap on the
// title? Also, for drummers I think we can change, instead of key, we can show
// tempo."*
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Reader from '@/features/reader/Reader';
import { songFromFlat } from '@/arrangements';
import { isPitched, tabId } from '@/data/instruments';
import { resolveDisplayInstrument } from '@/lib/myInstrument';

vi.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => ({ allowed: true, requiredPlan: 'free', currentPlan: 'free' }),
  checkEntitlement: () => true,
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: /min-width/.test(query), media: query,
    addEventListener: () => {}, removeEventListener: () => {},
  }));
});

// ⚠ It needs something to SAY. `songInfoFacts` is what decides whether the
// title is a control at all — a title styled as a button that unfolds an empty
// row is READER.md's trap 23 — so a song with no story, no scripture and no key
// history renders a plain `<span>` and there is nothing here to test.
const song = songFromFlat({
  id: 's', title: 'Cel Minunat, Salvatorul', artist: 'X', key: 'C', tempo: 118, time: '4/4',
  scripture: 'Isaiah 9:6', story: 'Written after a funeral in 2019.',
  sections: [{ type: 'Verse 1', lines: ['[C]words'] }], structure: ['Verse 1'],
});

const open = (props = {}) => render(
  <Reader song={song} settings={{}} mode="practice" onSelectKey={() => {}} {...props} />
);
// ⚠ Anchored at the START. The open panel carries a "Close song info" button,
// so a `/song info$/` matcher finds two the moment the panel is open — which is
// exactly when the caret assertion runs.
const titleButton = () => screen.queryByRole('button', { name: `${song.title} — song info` });

describe('the title is a plain label (QA 11 Nov, row 170)', () => {
  // The song info panel under the title is gone: the bar carries the key,
  // capo, tempo and time, and the song page has the rest. So the title opens
  // nothing, and must not look like it does.
  it('is not a button, even for a song with a story', () => {
    open();
    expect(titleButton()).toBeNull();
    expect(screen.getByText(song.title)).toBeTruthy();
  });
});

describe('the pill says the number YOU play by', () => {
  const bar = () => screen.queryByLabelText('Key (transpose)');
  const tempo = () => screen.queryByLabelText(/^Tempo \d+/);

  it('is the key by default', () => {
    open();
    expect(bar()).toBeTruthy();
    expect(tempo()).toBeNull();
  });

  it('is the tempo for a drummer on the roster', () => {
    open({ myInstrument: 'drums' });
    expect(bar()).toBeNull();
    expect(screen.getByLabelText('Tempo 118 beats per minute')).toBeTruthy();
  });

  // ⚠ THE OTHER END OF THE SWITCH. `resolveMyInstrument` reads the team
  // schedule; the ☰'s "Your instrument" row writes `settings.displayRole`. A
  // solo drummer is in nobody's schedule, and reading only the roster would
  // have given this to the rarer of the two users.
  it('and for a drummer who just picked Drums in the ☰', () => {
    open({ settings: { displayRole: 'drums' } });
    expect(bar()).toBeNull();
    expect(screen.getByLabelText('Tempo 118 beats per minute')).toBeTruthy();
  });

  // ⚠ THE CASE THAT MAKES THIS A COLUMN AND NOT A DISPLAY-MODE CHECK. Vocals is
  // `display: 'lyrics'` too — deriving "no key" from "no chords on screen"
  // would take the key from the one player whose instrument IS the key.
  it('but a singer keeps the key — their range is the whole question', () => {
    open({ myInstrument: 'vocals:alto' });
    expect(bar()).toBeTruthy();
    expect(tempo()).toBeNull();
  });

  it('and the capo goes with the key — a kit has no frets', () => {
    open({ myInstrument: 'drums', setCapo: undefined });
    expect(screen.queryByLabelText('Capo')).toBeNull();
  });

  // The read-out below it already said ♩118 at ≥640px. Two of the same number,
  // 40px apart, is the bar contradicting nothing and cluttering anyway.
  it('never says the tempo twice', () => {
    open({ myInstrument: 'drums' });
    expect(screen.getAllByText(/118/).length).toBe(1);
  });
});

describe('what the two ends resolve to', () => {
  it('defaults to pitched when nobody has said anything', () => {
    expect(resolveDisplayInstrument({})).toBeNull();
    expect(isPitched(null)).toBe(true);
    expect(isPitched('something nothing maps')).toBe(true);
  });

  // ⚠ `leader` is ALSO the value `displayRole` falls back to when it was never
  // set, so it cannot be read as a claim — otherwise an untouched default would
  // outrank a leader's roster.
  it('reads `leader` as no answer, so the roster still wins', () => {
    expect(resolveDisplayInstrument({ myInstrument: 'drums', displayRole: 'leader' })).toBe('drums');
  });

  it('lets an explicit pick beat the roster', () => {
    expect(resolveDisplayInstrument({ myInstrument: 'drums', displayRole: 'electric' })).toBe('electric-guitar');
    expect(resolveDisplayInstrument({ myInstrument: 'acoustic-guitar', displayRole: 'drums' })).toBe('drums');
  });

  // ⚠ The ☰ offered ONE "Guitar" row and it wrote `tabInstrument: 'electric'`
  // — so an acoustic player picking the only guitar there was got element 9
  // backwards: their own tab collapsed and the electric one opened. Two rows
  // now, and the two ids must reach the two different instruments.
  it('tells the two guitars apart', () => {
    expect(resolveDisplayInstrument({ displayRole: 'acoustic' })).toBe('acoustic-guitar');
    expect(resolveDisplayInstrument({ displayRole: 'electric' })).toBe('electric-guitar');
    expect(tabId(resolveDisplayInstrument({ displayRole: 'acoustic' }))).toBe('acoustic');
    expect(tabId(resolveDisplayInstrument({ displayRole: 'electric' }))).toBe('electric');
  });

  // ⚠ `displayRole` is a SYNCED preference: profiles that picked the old row
  // still carry `guitar` and keep arriving from other devices. Retiring an id
  // from the menu does not retire it from an account, so it must keep
  // resolving — to electric, which is what that row actually wrote.
  it('still answers for the retired single Guitar pick', () => {
    expect(resolveDisplayInstrument({ myInstrument: 'drums', displayRole: 'guitar' })).toBe('electric-guitar');
  });

  it('and drums is the only instrument with no pitch', () => {
    for (const id of ['acoustic-guitar', 'electric-guitar', 'bass-guitar', 'keys', 'piano', 'vocals']) {
      expect(isPitched(id)).toBe(true);
    }
    expect(isPitched('drums')).toBe(false);
  });
});
