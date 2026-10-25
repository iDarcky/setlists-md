import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WelcomeScreen from '@/features/onboarding/WelcomeScreen';

describe('WelcomeScreen', () => {
  it('offers exactly the three ways in and routes each one', () => {
    const onSignIn = vi.fn();
    const onCreateAccount = vi.fn();
    const onTrySolo = vi.fn();
    render(<WelcomeScreen onSignIn={onSignIn} onCreateAccount={onCreateAccount} onTrySolo={onTrySolo} />);

    expect(screen.getAllByRole('button')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try it solo, no account' }));

    expect(onCreateAccount).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onTrySolo).toHaveBeenCalledTimes(1);
  });
});
