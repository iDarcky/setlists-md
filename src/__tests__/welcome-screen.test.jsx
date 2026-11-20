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

  // Email only: Create account and Log in, one tap each from the first screen.
  it('shows Create account and Log in while Apple and Google are off', () => {
    vi.stubEnv('VITE_ENABLE_APPLE_SIGNIN', 'false');
    vi.stubEnv('VITE_ENABLE_GOOGLE_SIGNIN', '');
    const onSignIn = vi.fn();
    const onCreateAccount = vi.fn();
    render(<WelcomeScreen onSignIn={onSignIn} onCreateAccount={onCreateAccount} />);
    expect(screen.queryByRole('button', { name: /Apple/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Google/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(onCreateAccount).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  // With providers on, they lead; email sign-up and Log in stay one tap away.
  it('offers Apple, Google, email sign-up and Log in', () => {
    const onSignIn = vi.fn();
    const onCreateAccount = vi.fn();
    render(<WelcomeScreen onSignIn={onSignIn} onCreateAccount={onCreateAccount} />);
    expect(screen.getByRole('heading', { name: 'Sunday, sorted.' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sign up with email/ }));
    expect(onCreateAccount).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Log in/ }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/ }));
    expect(auth.signInWithGoogle).toHaveBeenCalledTimes(1);
    // While one provider is opening, the others wait.
    expect(screen.getByRole('button', { name: /Continue with Apple/ })).toBeDisabled();
  });
});
