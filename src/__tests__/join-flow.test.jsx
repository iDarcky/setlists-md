import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const auth = { user: null, profile: null, loading: false, updateProfile: vi.fn(() => Promise.resolve()) };
vi.mock('@/auth/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/auth/supabase', () => ({ supabase: null }));

const api = {
  peekJoinLink: vi.fn(),
  requestToJoin: vi.fn(),
};
vi.mock('@/features/join/joinApi', () => ({
  peekJoinLink: (...a) => api.peekJoinLink(...a),
  requestToJoin: (...a) => api.requestToJoin(...a),
  listMyJoinRequests: () => Promise.resolve([]),
}));

vi.mock('@/features/start/GetAppScreen', () => ({
  default: ({ teamName, onOpen }) => <button type="button" onClick={onOpen}>Open {teamName}</button>,
}));

import JoinFlow from '@/features/join/JoinFlow';

const CODE = 'abc23xyz9kmn';
const PEEK = { status: 'ok', team_name: 'Grace Church', member_count: 12, leader_name: 'Ana', initials: 'GC' };

describe('JoinFlow', () => {
  beforeEach(() => {
    auth.user = null;
    auth.profile = null;
    api.peekJoinLink.mockReset();
    api.requestToJoin.mockReset();
    localStorage.clear();
  });

  it('shows the invite and parks the code for after sign-in', async () => {
    api.peekJoinLink.mockResolvedValue(PEEK);
    const onPasswordSignIn = vi.fn();
    render(<JoinFlow code={CODE} onPasswordSignIn={onPasswordSignIn} />);
    expect(await screen.findByText('Join Grace Church on Setlists.md')).toBeInTheDocument();
    expect(screen.getByText('Ana invited you. A leader lets you in.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue with Apple/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continue with email/ }));
    expect(onPasswordSignIn).toHaveBeenCalledWith('signup', { name: 'Grace Church', logoUrl: null, initials: 'GC' });
    expect(JSON.parse(localStorage.getItem('setlists-md:pending-join'))).toMatchObject({ code: CODE, stage: 'auth' });
  });

  it('explains a reset link', async () => {
    api.peekJoinLink.mockResolvedValue({ status: 'invalid' });
    render(<JoinFlow code={CODE} />);
    expect(await screen.findByText('This invite doesn’t work')).toBeInTheDocument();
  });

  it('signed in: one screen, what you play, then the request goes with the account name', async () => {
    auth.user = { id: 'u1', email: 'kid@x.com', user_metadata: { name: 'Maria Pop' } };
    auth.profile = { id: 'u1', display_name: 'Maria Pop' };
    api.peekJoinLink.mockResolvedValue({ ...PEEK, is_member: false, my_status: null, team_id: 't1' });
    api.requestToJoin.mockResolvedValue({ status: 'pending', request_id: 'r1', team_id: 't1' });
    render(<JoinFlow code={CODE} />);
    expect(await screen.findByText('What do you play?')).toBeInTheDocument();
    // The name is known, so no name field and no skippable "Not now".
    expect(screen.queryByLabelText('Your name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Drums' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Waiting for a leader')).toBeInTheDocument();
    expect(api.requestToJoin).toHaveBeenCalledWith(CODE, 'Maria Pop', ['drums']);
    expect(JSON.parse(localStorage.getItem('setlists-md:pending-join'))).toMatchObject({ code: CODE, stage: 'requested', requestId: 'r1' });
  });

  it('a failed send says why and can retry', async () => {
    auth.user = { id: 'u1', email: 'kid@x.com' };
    auth.profile = { id: 'u1', display_name: 'kid' };
    api.peekJoinLink.mockResolvedValue({ ...PEEK, is_member: false, my_status: null, team_id: 't1' });
    api.requestToJoin
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce({ status: 'pending', request_id: 'r1', team_id: 't1' });
    render(<JoinFlow code={CODE} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Network down')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(api.requestToJoin).toHaveBeenLastCalledWith(CODE, 'kid', []));
    expect(await screen.findByText('Waiting for a leader')).toBeInTheDocument();
  });

  it('already a member: you’re in, then get the app, then open the church', async () => {
    auth.user = { id: 'u1', email: 'kid@x.com' };
    api.peekJoinLink.mockResolvedValue({ ...PEEK, is_member: true, team_id: 't1' });
    const onJoined = vi.fn();
    const onSkipHome = vi.fn();
    render(<JoinFlow code={CODE} onJoined={onJoined} onSkipHome={onSkipHome} />);
    expect(await screen.findByText('You’re in Grace Church')).toBeInTheDocument();
    // `onJoined` fires from an effect AFTER the screen renders, so on a busy CI
    // runner `findByText` can resolve first. Wait for it rather than assume.
    await waitFor(() => expect(onJoined).toHaveBeenCalledWith('t1'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Grace Church' }));
    expect(onSkipHome).toHaveBeenCalledWith('t1');
  });
});
