// The Live switch, and the trap it used to be.
//
// ⚠ THE BUG THIS FILE EXISTS FOR. The row read `config.mode === 'live'`, so the
// switch DELETED ITSELF the moment you used it. Measured 2026-08-23 in the
// reader, mid-service on a 1024×768 tablet:
//
//   live, ☰ open         switch present, checked
//   after switching OFF  switch GONE — nothing in the menu mentions live
//
// A control that only moves one way and removes itself on the way. The moment
// someone needs it most is the moment after they used it: they wanted Edit for
// one song, not to end the service, and getting back meant leaving the reader
// and re-opening the set.
//
// The rule "there is no manual way INTO live" is about the CALENDAR — a setlist
// opened on a Tuesday must not offer a stage mode nobody asked for. So the row
// asks the service WINDOW, which keeps that rule exactly while letting the
// switch work in both directions inside the window.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReaderMenu from '@/features/reader/ReaderMenu';
import { resolveReaderConfig } from '@/lib/readerConfig';

vi.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => ({ allowed: true, requiredPlan: 'free', currentPlan: 'church' }),
  checkEntitlement: () => true,
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: /min-width:\s*(76[0-9]|7[7-9]\d|[89]\d\d|\d{4,})px/.test(query),
    media: query, addEventListener: () => {}, removeEventListener: () => {},
  }));
});

const open = (props = {}) => {
  const { mode = 'live', liveAvailable = false, onModeChange = () => {} } = props;
  return render(
    <ReaderMenu
      dock="side" onClose={() => {}} settings={{}} onUpdateSettings={() => {}}
      song={null} config={resolveReaderConfig({}, { wide: true, mode })}
      mode={mode} onModeChange={onModeChange} liveAvailable={liveAvailable}
      lyricSize={18} onLyricSize={() => {}} chordSize={16} onChordSize={() => {}}
    />
  );
};

const liveSwitch = () => screen.queryByRole('switch', { name: 'Live' });

describe('the switch survives being used', () => {
  it('is there while live', () => {
    open({ mode: 'live', liveAvailable: true });
    expect(liveSwitch()).toBeTruthy();
    expect(liveSwitch().getAttribute('aria-checked')).toBe('true');
  });

  // ⚠ THE REGRESSION. `mode` has already flipped to practice by the time this
  // renders — that is exactly the state the old condition dropped the row in.
  it('is STILL there after you switch it off, so you can switch it back', () => {
    open({ mode: 'practice', liveAvailable: true });
    expect(liveSwitch()).toBeTruthy();
    expect(liveSwitch().getAttribute('aria-checked')).toBe('false');
  });

  it('reports the way back, not just the way out', () => {
    const onModeChange = vi.fn();
    open({ mode: 'practice', liveAvailable: true, onModeChange });
    fireEvent.click(liveSwitch());
    expect(onModeChange).toHaveBeenCalledWith('live');
  });
});

describe('and the calendar rule it must not break', () => {
  // Open a setlist on a Tuesday and live is not on the table. This is the rule
  // the old condition was protecting, and the fix has to keep it.
  it('says nothing about live outside the service window', () => {
    open({ mode: 'practice', liveAvailable: false });
    expect(liveSwitch()).toBeNull();
  });

  // ⚠ Belt and braces for the window closing mid-service: whatever the clock
  // says, a reader that IS live keeps its way out.
  it('but a reader that is live always keeps its way out', () => {
    open({ mode: 'live', liveAvailable: false });
    expect(liveSwitch()).toBeTruthy();
  });

  // One mode, no switch — the hub, the editor preview, a shared link. That
  // surface passes no `onModeChange` at all, and this is the end of the wire
  // that decides.
  it('and a surface with one mode never shows it', () => {
    open({ mode: 'live', liveAvailable: true, onModeChange: null });
    expect(liveSwitch()).toBeNull();
  });
});
