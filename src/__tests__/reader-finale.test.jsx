// Element 13 — the finale, mounted.
//
// One screen for both kinds. Time is the only stat, by decision. The reflection
// has THREE cases and the middle one is the whole point of the element: in a team
// it is leaders-only, and a member must not get a fallback that puts the text
// back on their device.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReaderFinale from '@/features/reader/ReaderFinale';

// Team context is swapped per test via this mutable box.
const teamState = { team: null, members: [], isAdmin: false };
vi.mock('@/auth/useTeam', () => ({ useTeam: () => teamState }));

const scheduleState = { schedules: [] };
vi.mock('@/hooks/useTeamSchedules', () => ({ useTeamSchedules: () => scheduleState }));
vi.mock('@/hooks/useTeamSetlistMap', () => ({ useTeamSetlistMap: () => ({ map: {}, loading: false }) }));

// The leaders-only note's cloud layer. `enabled` is what the component keys the
// whole section off, so it stands in for "am I a leader, and does the table
// exist".
const leaderNote = { enabled: false, ready: true, note: '', save: vi.fn() };
vi.mock('@/hooks/useLeaderNote', () => ({ useLeaderNote: () => leaderNote }));

const setlist = { id: 'sl-1', name: 'Sunday Morning', items: [] };

beforeEach(() => {
  teamState.team = null;
  teamState.members = [];
  teamState.isAdmin = false;
  scheduleState.schedules = [];
  leaderNote.enabled = false;
  leaderNote.note = '';
  leaderNote.save = vi.fn();
});

const renderFinale = (props = {}) =>
  render(<ReaderFinale setlist={setlist} mode="live" {...props} />);

describe('element 13 — one screen, two flavours', () => {
  it('wears the Live badge and a live phrase', () => {
    renderFinale({ mode: 'live' });
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('Sunday Morning')).toBeTruthy();
    expect(screen.getByText('How did it feel?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View setlist' })).toBeTruthy();
  });

  it('wears the Practice badge and practice copy from the SAME component', () => {
    renderFinale({ mode: 'practice' });
    expect(screen.getByText('Practice')).toBeTruthy();
    expect(screen.getByText('For the leaders')).toBeTruthy();
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

describe('element 13 — the reflection, and who can read it', () => {
  it('outside a team, writes the setlist’s own field', () => {
    const onUpdateSetlist = vi.fn();
    renderFinale({ onUpdateSetlist });
    const box = screen.getByLabelText('How did it feel?');
    fireEvent.change(box, { target: { value: 'Pads carried the bridge.' } });
    fireEvent.blur(box);
    expect(onUpdateSetlist).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sl-1', serviceNote: 'Pads carried the bridge.' }),
    );
    expect(screen.getByText('Saved with this setlist.')).toBeTruthy();
  });

  it('shows the existing note without being typed into', () => {
    render(<ReaderFinale setlist={{ ...setlist, serviceNote: 'Last time it dragged.' }} mode="live" />);
    expect(screen.getByLabelText('How did it feel?').value).toBe('Last time it dragged.');
  });

  it('as a team LEADER, writes the leaders-only note and says so', () => {
    teamState.team = { id: 't1' };
    teamState.isAdmin = true;
    leaderNote.enabled = true;
    const onUpdateSetlist = vi.fn();
    renderFinale({ onUpdateSetlist });
    const box = screen.getByLabelText('How did it feel?');
    fireEvent.change(box, { target: { value: 'Keys were a semitone high.' } });
    fireEvent.blur(box);
    expect(leaderNote.save).toHaveBeenCalledWith('Keys were a semitone high.');
    // And crucially NOT onto the setlist, which syncs to every member.
    expect(onUpdateSetlist).not.toHaveBeenCalled();
    expect(screen.getByText(/Only leaders can read this/)).toBeTruthy();
  });

  it('as a team MEMBER, there is no reflection at all', () => {
    // The critical case. A fallback to the setlist field here would put a
    // leader's candid note straight back onto every member's device — the exact
    // thing the leaders-only table exists to prevent.
    teamState.team = { id: 't1' };
    teamState.isAdmin = false;
    leaderNote.enabled = false;
    renderFinale();
    expect(screen.queryByLabelText('How did it feel?')).toBeNull();
    expect(screen.queryByText(/Only leaders can read this/)).toBeNull();
  });

  it('a member cannot even read a legacy note through this screen', () => {
    teamState.team = { id: 't1' };
    teamState.isAdmin = false;
    leaderNote.enabled = false;
    render(<ReaderFinale setlist={{ ...setlist, serviceNote: 'Old shared note.' }} mode="live" />);
    expect(screen.queryByText('Old shared note.')).toBeNull();
  });
});

describe('element 13 — leaving', () => {
  it('saves before it navigates, on every way out', () => {
    const onUpdateSetlist = vi.fn();
    const onGoHome = vi.fn();
    renderFinale({ onUpdateSetlist, onGoHome });
    fireEvent.change(screen.getByLabelText('How did it feel?'), { target: { value: 'Good one.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(onUpdateSetlist).toHaveBeenCalled();
    expect(onGoHome).toHaveBeenCalled();
  });

  it('does not write when the note was never touched', () => {
    const onUpdateSetlist = vi.fn();
    const onGoOverview = vi.fn();
    renderFinale({ onUpdateSetlist, onGoOverview });
    fireEvent.click(screen.getByRole('button', { name: 'View setlist' }));
    expect(onUpdateSetlist).not.toHaveBeenCalled();
    expect(onGoOverview).toHaveBeenCalled();
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
