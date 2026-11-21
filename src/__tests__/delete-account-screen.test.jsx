import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const deleteAccount = vi.fn(async () => ({ ok: true }));
const auth = { user: { id: 'u1' }, deleteAccount: (...a) => deleteAccount(...a) };
const team = { teams: [], team: null, members: [] };
vi.mock('@/auth/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/auth/useTeam', () => ({ useTeam: () => team }));
vi.mock('@/auth/supabase', () => ({ supabase: null }));
vi.mock('@/storage', () => ({ clearAll: vi.fn(async () => {}) }));

import DeleteAccountScreen from '@/features/settings/DeleteAccountScreen';

const grace = { id: 't1', name: 'Grace Church', owner_id: 'u1' };

describe('DeleteAccountScreen', () => {
  beforeEach(() => deleteAccount.mockClear());

  it('an owner with others: names who gets the team; only the team name unlocks the button', async () => {
    Object.assign(team, { teams: [grace], team: grace, members: [
      { user_id: 'u1', role: 'admin', joined_at: '2026-01-01' },
      { user_id: 'u2', role: 'member', joined_at: '2026-01-02', profile: { display_name: 'Ana' } },
    ] });
    const onSignOut = vi.fn();
    render(<DeleteAccountScreen onCancel={vi.fn()} onSignOut={onSignOut} />);
    expect(screen.getByText(/Ana will own Grace Church/)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Delete account' });
    expect(button).toBeDisabled();
    const field = screen.getByLabelText('Type Grace Church to confirm');
    fireEvent.change(field, { target: { value: 'DELETE' } });
    expect(button).toBeDisabled();
    fireEvent.change(field, { target: { value: 'grace church' } });
    fireEvent.click(button);
    await waitFor(() => expect(onSignOut).toHaveBeenCalled());
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });

  it('an owner alone: says the team and its songs go too', () => {
    Object.assign(team, { teams: [grace], team: grace, members: [{ user_id: 'u1' }] });
    render(<DeleteAccountScreen onCancel={vi.fn()} />);
    expect(screen.getByText(/so it’s deleted too/)).toBeInTheDocument();
  });

  it('a member: no team warning, DELETE confirms, their songs stay', () => {
    Object.assign(team, { teams: [{ ...grace, owner_id: 'u9' }], team: { ...grace, owner_id: 'u9' }, members: [] });
    render(<DeleteAccountScreen onCancel={vi.fn()} />);
    expect(screen.getByText(/Songs you added stay with Grace Church/)).toBeInTheDocument();
    expect(screen.queryByText(/will own/)).toBeNull();
    expect(screen.getByLabelText('Type DELETE to confirm')).toBeInTheDocument();
  });
});
