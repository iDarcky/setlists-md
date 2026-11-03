import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WelcomeScreen from '@/features/onboarding/WelcomeScreen';

describe('WelcomeScreen', () => {
  // "Try it solo" was dropped on 2026-10-25: an account or nothing.
  it('offers exactly the two ways in and routes each one', () => {
    const onSignIn = vi.fn();
    const onCreateAccount = vi.fn();
    render(<WelcomeScreen onSignIn={onSignIn} onCreateAccount={onCreateAccount} />);

    expect(screen.getAllByRole('button')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(onCreateAccount).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
