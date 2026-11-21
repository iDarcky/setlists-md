import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AuthLayout } from '@/features/auth/AuthLayout';

// 2026-11-20: Android's back gesture went past the step you were on
// (Enter code → Create your account). Now a pop runs the screen's ← Back.
describe('AuthLayout back gesture', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a history pop runs the current screen’s onBack', () => {
    const onBack = vi.fn();
    render(<AuthLayout onBack={onBack}><p>Step</p></AuthLayout>);
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('← Back goes through history, so button and gesture agree', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const onBack = vi.fn();
    render(<AuthLayout onBack={onBack}><p>Step</p></AuthLayout>);
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('the next screen reuses the entry instead of piling one more on', () => {
    window.history.replaceState(null, '');
    const push = vi.spyOn(window.history, 'pushState');
    const { rerender } = render(<AuthLayout key="a" onBack={() => {}}><p>A</p></AuthLayout>);
    rerender(<AuthLayout key="b" onBack={() => {}}><p>B</p></AuthLayout>);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it('a screen without Back adds nothing and ignores pops', () => {
    const push = vi.spyOn(window.history, 'pushState');
    window.history.replaceState(null, '');
    render(<AuthLayout><p>Welcome</p></AuthLayout>);
    expect(push).not.toHaveBeenCalled();
  });
});
