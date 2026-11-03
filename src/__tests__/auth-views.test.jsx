import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateAccountView, LogInView } from '@/features/auth/AuthViews';

const empty = { name: '', email: '', password: '', confirm: '' };
const noop = () => {};

describe('CreateAccountView', () => {
  it('keeps Create account off until the passwords are long enough and match', () => {
    const { rerender } = render(
      <CreateAccountView values={{ ...empty, email: 'a@b.c', password: 'short', confirm: 'short' }} onChange={noop} onSubmit={noop} />,
    );
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
    rerender(<CreateAccountView values={{ ...empty, email: 'a@b.c', password: 'password1', confirm: 'password2' }} onChange={noop} onSubmit={noop} />);
    expect(screen.getByText('Passwords don’t match.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
    const onSubmit = vi.fn();
    rerender(<CreateAccountView values={{ ...empty, email: 'a@b.c', password: 'password1', confirm: 'password1' }} onChange={noop} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('opens the Terms instead of leaving the form', () => {
    const onShowLegal = vi.fn();
    render(<CreateAccountView values={empty} onChange={noop} onSubmit={noop} onShowLegal={onShowLegal} />);
    fireEvent.click(screen.getByRole('button', { name: 'Terms' }));
    expect(onShowLegal).toHaveBeenCalledWith('terms');
  });
});

describe('LogInView', () => {
  it('says which church it is joining', () => {
    render(<LogInView values={empty} onChange={noop} onSubmit={noop} joining={{ name: 'Grace Church', initials: 'GC' }} />);
    expect(screen.getByText('Joining Grace Church')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Log in to ask to join' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in and continue' })).toBeDisabled();
  });

  it('Forgot password does not submit the form', () => {
    const onSubmit = vi.fn();
    const onForgot = vi.fn();
    render(<LogInView values={{ ...empty, email: 'a@b.c', password: 'x' }} onChange={noop} onSubmit={onSubmit} onForgot={onForgot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(onForgot).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
