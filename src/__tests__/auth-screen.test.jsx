import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const auth = {
  isConfigured: true,
  user: null,
  profile: null,
  updateProfile: vi.fn(),
  signInWithOtp: vi.fn(() => Promise.resolve({ error: null })),
  verifyEmailOtp: vi.fn(() => Promise.resolve({ error: null })),
};
vi.mock('@/auth/useAuth', () => ({ useAuth: () => auth }));

import AuthScreen from '@/features/auth/AuthScreen';
import { isPlaceholderName } from '@/features/auth/placeholderName';

describe('isPlaceholderName', () => {
  it('treats empty and email-derived names as not chosen', () => {
    expect(isPlaceholderName('', 'ana@x.com')).toBe(true);
    expect(isPlaceholderName('ana.marin', 'Ana.Marin@x.com')).toBe(true);
    expect(isPlaceholderName('Ana Marin', 'ana.marin@x.com')).toBe(false);
  });
});

describe('AuthScreen', () => {
  beforeEach(() => {
    auth.user = null;
    auth.profile = null;
    auth.updateProfile.mockReset();
    localStorage.clear();
  });

  it('opens on the email code, with the password form one tap away', () => {
    render(<AuthScreen defaultMode="signup" />);
    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Email me a code' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'I have a password' }));
    expect(screen.getByRole('button', { name: 'Email me a code instead' })).toBeInTheDocument();
  });

  it('asks a brand-new account for its name, then carries on', async () => {
    auth.user = { id: 'u1', email: 'ana.marin@x.com' };
    auth.profile = { id: 'u1', email: 'ana.marin@x.com', display_name: 'ana.marin' };
    auth.updateProfile.mockResolvedValue({ display_name: 'Ana Marin' });
    const onSignedIn = vi.fn();
    render(<AuthScreen onSignedIn={onSignedIn} />);
    expect(screen.getByText('What should we call you?')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: '  Ana   Marin ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(auth.updateProfile).toHaveBeenCalledWith({ display_name: 'Ana Marin' });
  });

  it('goes straight on for an account that already has a name', () => {
    auth.user = { id: 'u1', email: 'ana@x.com' };
    auth.profile = { id: 'u1', email: 'ana@x.com', display_name: 'Ana Marin' };
    const onSignedIn = vi.fn();
    render(<AuthScreen onSignedIn={onSignedIn} />);
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });
});
