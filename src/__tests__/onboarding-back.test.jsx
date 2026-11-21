import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { claimBack, releaseBack, introBackOwnsHistory } from '@/lib/introBack';
import { phoneInBrowser } from '@/lib/phoneInBrowser';
import { CheckEmailView } from '@/features/intro/IntroAuthViews';
import { InstrumentsView } from '@/features/intro/IntroStartViews';

const win = ({ standalone = false, coarse = true, w = 390, h = 844 } = {}) => ({
  matchMedia: (q) => ({ matches: q.includes('standalone') ? standalone : q.includes('coarse') ? coarse : false }),
  navigator: {},
  screen: { width: w, height: h },
});

describe('onboarding Back and small login fixes (QA 21 Nov)', () => {
  it('a screen with ← Back owns the browser back while it is up', () => {
    expect(introBackOwnsHistory()).toBe(false);
    claimBack();
    expect(introBackOwnsHistory()).toBe(true);
    releaseBack();
    releaseBack();
    expect(introBackOwnsHistory()).toBe(false);
  });

  it('"Put Setlists.md on your phone" only for a phone in the browser', () => {
    expect(phoneInBrowser(win())).toBe(true);
    expect(phoneInBrowser(win({ standalone: true }))).toBe(false);
    expect(phoneInBrowser(win({ w: 820, h: 1180 }))).toBe(false); // iPad
    expect(phoneInBrowser(win({ coarse: false, w: 1440, h: 900 }))).toBe(false); // computer
  });

  it('the reset email never says whether the account exists', () => {
    render(<CheckEmailView email="a@b.c" what="a link to pick a new password" ifAccount onResend={vi.fn()} />);
    expect(screen.getByText(/If an account uses/)).toBeTruthy();
  });

  it('Continue on "What do you play?" waits for one pick', () => {
    const { rerender } = render(<InstrumentsView parts={[]} onPartsChange={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Continue' }).disabled).toBe(true);
    rerender(<InstrumentsView parts={['keys']} onPartsChange={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Continue' }).disabled).toBe(false);
  });
});
