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
    expect(await screen.findByText('Ana and 11 others are already in')).toBeInTheDocument();
    expect(screen.getByText('Grace Church')).toBeInTheDocument();
    // No emailed code until a custom SMTP server is set up (VITE_EMAIL_CODES).
    expect(screen.queryByRole('button', { name: 'Email me a code' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(onPasswordSignIn).toHaveBeenCalledWith('signup');
    expect(JSON.parse(localStorage.getItem('setlists-md:pending-join'))).toMatchObject({ code: CODE, stage: 'auth' });
  });

  it('explains a reset link', async () => {
    api.peekJoinLink.mockResolvedValue({ status: 'invalid' });
    render(<JoinFlow code={CODE} />);
    expect(await screen.findByText("This invite link doesn't work")).toBeInTheDocument();
  });

  it('signed in: asks to join with name and parts, then waits', async () => {
    auth.user = { id: 'u1', email: 'kid@x.com' };
    auth.profile = { id: 'u1', display_name: 'kid' };
    api.peekJoinLink.mockResolvedValue({ ...PEEK, is_member: false, my_status: null, team_id: 't1' });
    api.requestToJoin.mockResolvedValue({ status: 'pending', request_id: 'r1', team_id: 't1' });
    render(<JoinFlow code={CODE} />);
    const nameInput = await screen.findByPlaceholderText('First and last name');
    expect(nameInput).toHaveValue('kid');
    fireEvent.change(nameInput, { target: { value: 'Maria  Pop' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drums' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vocals' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask to join' }));
    await waitFor(() => expect(api.requestToJoin).toHaveBeenCalledWith(CODE, 'Maria Pop', ['vocals', 'drums']));
    expect(await screen.findByText('Waiting for approval')).toBeInTheDocument();
    // The email-prefix default name follows what they told the church.
    expect(auth.updateProfile).toHaveBeenCalledWith({ display_name: 'Maria Pop' });
  });

  it('already a member goes straight to the next steps', async () => {
    auth.user = { id: 'u1', email: 'kid@x.com' };
    api.peekJoinLink.mockResolvedValue({ ...PEEK, is_member: true, team_id: 't1' });
    const onJoined = vi.fn();
    render(<JoinFlow code={CODE} onJoined={onJoined} />);
    expect(await screen.findByText("You're in Grace Church")).toBeInTheDocument();
    expect(onJoined).toHaveBeenCalledWith('t1');
    expect(screen.getByRole('button', { name: 'Skip to Home' })).toBeInTheDocument();
  });
});
