// Element 13 — the finale, mounted.
//
// One screen for both kinds, one screenful, no page scroll. Time is the only
// stat. THREE things were built here and cut — "What you played", "Run it again"
// and the reflection box — so the tests below also pin what must NOT come back
// without a decision to bring it back.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReaderFinale from '@/features/reader/ReaderFinale';

// Team context is swapped per test via this mutable box.
const teamState = { team: null, members: [], isAdmin: false };
vi.mock('@/auth/useTeam', () => ({ useTeam: () => teamState }));

const scheduleState = { schedules: [] };
vi.mock('@/hooks/useTeamSchedules', () => ({ useTeamSchedules: () => scheduleState }));
vi.mock('@/hooks/useTeamSetlistMap', () => ({ useTeamSetlistMap: () => ({ map: {}, loading: false }) }));

const setlist = { id: 'sl-1', name: 'Sunday Morning', items: [] };

beforeEach(() => {
  teamState.team = null;
  teamState.members = [];
  teamState.isAdmin = false;
  scheduleState.schedules = [];
});

const renderFinale = (props = {}) =>
  render(<ReaderFinale setlist={setlist} mode="live" {...props} />);

describe('element 13 — one screen, two flavours', () => {
  it('wears the Live badge and a live phrase', () => {
    renderFinale({ mode: 'live' });
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('Sunday Morning')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View setlist' })).toBeTruthy();
  });

  it('wears the Practice badge and practice copy from the SAME component', () => {
    renderFinale({ mode: 'practice' });
    expect(screen.getByText('Practice')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View setlist' })).toBeTruthy();
  });

  it('falls back to the live flavour rather than blank on an unknown mode', () => {
    renderFinale({ mode: 'nonsense' });
    expect(screen.getByText('Live')).toBeTruthy();
  });
});

describe('element 13 — the meta line', () => {
  it('puts the elapsed time on a line, not in a lone tile', () => {
    // A single stat card floating in the column read as three tiles that had
    // failed to load, which is what made the first cut of this screen look empty.
    renderFinale({ session: { startTime: Date.now() - 125_000 } });
    expect(screen.getByText('2m 05s')).toBeTruthy();
    expect(screen.queryByText('Time')).toBeNull();
  });

  it('adds date and location only when the setlist has them', () => {
    render(
      <ReaderFinale
        setlist={{ ...setlist, date: '2026-07-26', location: 'Main Hall' }}
        mode="live"
        session={{ startTime: Date.now() }}
      />,
    );
    expect(screen.getByText('Sunday, Jul 26')).toBeTruthy();
    expect(screen.getByText('Main Hall')).toBeTruthy();
  });

  it('shows no time at all without a session, rather than claiming 0s', () => {
    renderFinale({ session: null });
    expect(screen.queryByText('0s')).toBeNull();
  });

  it('carries none of the stats that were cut', () => {
    renderFinale({ session: { startTime: Date.now() - 1000 } });
    expect(screen.queryByText('Songs')).toBeNull();
    expect(screen.queryByText('Breaks')).toBeNull();
    expect(screen.queryByText('Key changes')).toBeNull();
    expect(screen.queryByText('Cues added')).toBeNull();
  });
});

describe('element 13 — you served with', () => {
  it('lists the band on a live finale in a team', () => {
    teamState.team = { id: 't1' };
    teamState.members = [{ user_id: 'u1', profile: { display_name: 'Ana' } }];
    scheduleState.schedules = [{ id: 'r1', setlist_id: 'sl-1', user_id: 'u1', role: 'Drums', availability: 'available' }];
    renderFinale({ mode: 'live' });
    expect(screen.getByText('You served with')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('· Drums')).toBeTruthy();
  });

  it('leaves out anyone who was unavailable', () => {
    teamState.team = { id: 't1' };
    teamState.members = [{ user_id: 'u1', profile: { display_name: 'Ana' } }];
    scheduleState.schedules = [{ id: 'r1', setlist_id: 'sl-1', user_id: 'u1', availability: 'unavailable' }];
    renderFinale({ mode: 'live' });
    expect(screen.queryByText('Ana')).toBeNull();
  });

  it('is live-only — solo practice has no band to thank', () => {
    teamState.team = { id: 't1' };
    teamState.members = [{ user_id: 'u1', profile: { display_name: 'Ana' } }];
    scheduleState.schedules = [{ id: 'r1', setlist_id: 'sl-1', user_id: 'u1', availability: 'available' }];
    renderFinale({ mode: 'practice' });
    expect(screen.queryByText('You served with')).toBeNull();
  });

  it('shows nothing outside a team', () => {
    renderFinale({ mode: 'live' });
    expect(screen.queryByText('You served with')).toBeNull();
  });
});

describe('element 13 — two buttons, always on screen', () => {
  it('offers exactly two ways out, and Run it again is not one of them', () => {
    renderFinale({ session: { startTime: Date.now() } });
    expect(screen.getByRole('button', { name: 'View setlist' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Home' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Run it again' })).toBeNull();
  });

  it('keeps the buttons OUT of the scrolling region', () => {
    // The way off this screen must never be something you scroll to find. The
    // page itself never scrolls; only the middle does, and the buttons are not
    // inside it.
    const { container } = renderFinale({ session: { startTime: Date.now() } });
    const scroller = container.querySelector('.overflow-y-auto');
    expect(scroller).toBeTruthy();
    expect(scroller.contains(screen.getByRole('button', { name: 'Home' }))).toBe(false);
    expect(scroller.contains(screen.getByRole('button', { name: 'View setlist' }))).toBe(false);
  });

  it('never lets the page itself scroll', () => {
    const { container } = renderFinale({ session: { startTime: Date.now() } });
    expect(container.firstChild.className).toContain('overflow-hidden');
  });
});

describe('element 13 — what was deliberately cut', () => {
  it('has no reflection box', () => {
    // Cut because a leaders-only note needs somewhere for leaders to READ it
    // later, and that surface does not exist. Deferred in PLAN.md, not deleted
    // from history.
    renderFinale({ session: { startTime: Date.now() } });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText(/Only leaders can read this/)).toBeNull();
  });

  it('writes nothing to the setlist on the way out', () => {
    const onUpdateSetlist = vi.fn();
    const onGoHome = vi.fn();
    renderFinale({ session: { startTime: Date.now() }, onUpdateSetlist, onGoHome });
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(onUpdateSetlist).not.toHaveBeenCalled();
    expect(onGoHome).toHaveBeenCalled();
  });

  it('has no running order and no third button', () => {
    renderFinale({ session: { startTime: Date.now() } });
    expect(screen.queryByText('What you played')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
