// Two questions the reader's bar answers: *can I open this?* and *what is the
// number I play by?*
//
// Owner, 2026-08-23: *"How do we hint to the user that they can tap on the
// title? Also, for drummers I think we can change, instead of key, we can show
// tempo."*
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Reader from '@/features/reader/Reader';
import { songFromFlat } from '@/arrangements';
import { isPitched } from '@/data/instruments';
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

describe('saying the title is a control', () => {
  // ⚠ THE BUG. It was a `<button>` that looked exactly like the `<span>` in the
  // branch beside it — same weight, same colour, same everything. The only hint
  // was a `title` attribute, and a tablet has no pointer to hover with.
  it('carries a caret, so it does not look like a label', () => {
    open();
    expect(titleButton().querySelector('svg')).toBeTruthy();
  });

  // ⚠ It rotates on `aria-expanded`, which the button was already setting. That
  // is what makes it self-explaining rather than decorative: closed it points
  // down at the panel that will appear, open it points back at the title that
  // closes it.
  it('and the caret turns over when the panel is open', () => {
    open();
    const caret = () => titleButton().querySelector('svg');
    expect(caret().getAttribute('style')).not.toContain('rotate');
    expect(titleButton().getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(titleButton());
    expect(titleButton().getAttribute('aria-expanded')).toBe('true');
    expect(caret().getAttribute('style')).toContain('rotate(180deg)');
  });

  // ⚠ OUTSIDE the truncating span, and `shrink-0`. Inside it, the caret is the
  // first thing an ellipsis eats — so on the phone, where the hint is needed
  // most, it would be the width that disappears. (Measured cost to a title that
  // IS truncating: 17px, at 390px and 1024px alike.)
  it('and it is not what gets truncated away', () => {
    open();
    const btn = titleButton();
    const svg = btn.querySelector('svg');
    expect(svg.getAttribute('class')).toContain('shrink-0');
    expect(svg.closest('.truncate')).toBeNull();
    expect(btn.querySelector('.truncate').textContent).toBe(song.title);
  });

  // ⚠ READER.md trap 23, and the reason the caret cannot simply be added to the
  // title unconditionally: a song with nothing to say renders a plain label, so
  // there is no caret promising a panel that would open empty.
  it('stays a plain label — no caret — where there is nowhere to go', () => {
    const bare = songFromFlat({
      id: 'b', title: 'Bare', artist: 'X', key: 'C',
      sections: [{ type: 'Verse 1', lines: ['[C]w'] }], structure: ['Verse 1'],
    });
    const { container } = render(
      <Reader song={bare} settings={{}} mode="practice" onSelectKey={() => {}} />
    );
    expect(container.querySelector('button[aria-label="Bare — song info"]')).toBeNull();
    expect(container.textContent).toContain('Bare');
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
    expect(resolveDisplayInstrument({ myInstrument: 'drums', displayRole: 'guitar' })).toBe('electric-guitar');
    expect(resolveDisplayInstrument({ myInstrument: 'acoustic-guitar', displayRole: 'drums' })).toBe('drums');
  });

  it('and drums is the only instrument with no pitch', () => {
    for (const id of ['acoustic-guitar', 'electric-guitar', 'bass-guitar', 'keys', 'piano', 'vocals']) {
      expect(isPitched(id)).toBe(true);
    }
    expect(isPitched('drums')).toBe(false);
  });
});
