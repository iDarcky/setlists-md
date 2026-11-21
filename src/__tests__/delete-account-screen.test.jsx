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

  it('an owner with others: the team passes on; DELETE unlocks the button', async () => {
    Object.assign(team, { teams: [grace], team: grace, members: [{ user_id: 'u1' }, { user_id: 'u2' }] });
    const onSignOut = vi.fn();
    render(<DeleteAccountScreen onCancel={vi.fn()} onSignOut={onSignOut} />);
    expect(screen.getByText(/It passes to another leader/)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Delete account' });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'delete' } });
    fireEvent.click(button);
    await waitFor(() => expect(onSignOut).toHaveBeenCalled());
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });

  it('an owner alone: says the team and its songs go too', () => {
    Object.assign(team, { teams: [grace], team: grace, members: [{ user_id: 'u1' }] });
    render(<DeleteAccountScreen onCancel={vi.fn()} />);
    expect(screen.getByText(/so it’s deleted too/)).toBeInTheDocument();
  });

  it('a member: no team warning, their songs stay', () => {
    Object.assign(team, { teams: [{ ...grace, owner_id: 'u9' }], team: { ...grace, owner_id: 'u9' }, members: [] });
    render(<DeleteAccountScreen onCancel={vi.fn()} />);
    expect(screen.getByText(/Songs you added stay with Grace Church/)).toBeInTheDocument();
    expect(screen.queryByText(/passes to another leader/)).toBeNull();
  });
});
