import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const auth = { signInWithApple: vi.fn(async () => ({})), signInWithGoogle: vi.fn(async () => ({})) };
vi.mock('@/auth/useAuth', () => ({ useAuth: () => auth }));

import WelcomeScreen from '@/features/onboarding/WelcomeScreen';

describe('WelcomeScreen', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_ENABLE_APPLE_SIGNIN', 'true');
    vi.stubEnv('VITE_ENABLE_GOOGLE_SIGNIN', 'true');
  });
  afterEach(() => vi.unstubAllEnvs());

  // A provider that isn't set up in Supabase shows no button.
  it('shows only email while Apple and Google are off', () => {
    vi.stubEnv('VITE_ENABLE_APPLE_SIGNIN', 'false');
    vi.stubEnv('VITE_ENABLE_GOOGLE_SIGNIN', '');
    render(<WelcomeScreen onSignIn={vi.fn()} onCreateAccount={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Apple/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Google/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Continue with email/ })).toBeInTheDocument();
  });

  // 2026-11-20: Apple, Google or email, for new and returning people alike.
  it('offers Apple, Google and email', () => {
    render(<WelcomeScreen onSignIn={vi.fn()} onCreateAccount={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Sunday, sorted.' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/ }));
    expect(auth.signInWithGoogle).toHaveBeenCalledTimes(1);
    // While one provider is opening, the others wait.
    expect(screen.getByRole('button', { name: /Continue with Apple/ })).toBeDisabled();
  });

  it('email: Create account on a new device, Log in where someone logged in before', () => {
    const onSignIn = vi.fn();
    const onCreateAccount = vi.fn();
    const { unmount } = render(<WelcomeScreen onSignIn={onSignIn} onCreateAccount={onCreateAccount} />);
    fireEvent.click(screen.getByRole('button', { name: /Continue with email/ }));
    expect(onCreateAccount).toHaveBeenCalledTimes(1);
    unmount();
    localStorage.setItem('setlists-md:last-email', 'a@b.c');
    render(<WelcomeScreen onSignIn={onSignIn} onCreateAccount={onCreateAccount} />);
    fireEvent.click(screen.getByRole('button', { name: /Continue with email/ }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
