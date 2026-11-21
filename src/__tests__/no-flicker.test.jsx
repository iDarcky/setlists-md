import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cacheTeams, cacheActivity, cachedActivity, expectsTeam, rememberedUserId } from '@/lib/launchCache';
import AppSkeleton, { HomeSkeleton, PlainLoading } from '@/ui/AppSkeleton';

describe('launch: no team space before the welcome or set-up screens', () => {
  beforeEach(() => localStorage.clear());

  it('expects a team only when this device saw the user in one', () => {
    expect(expectsTeam('u1')).toBe(false);
    cacheTeams('u1', []);
    expect(expectsTeam('u1')).toBe(false);
    cacheTeams('u1', [{ id: 't1' }]);
    expect(expectsTeam('u1')).toBe(true);
  });

  it('finds the remembered user from the Supabase session before auth settles', () => {
    expect(rememberedUserId()).toBe(null);
    localStorage.setItem('sb-abc-auth-token', JSON.stringify({ user: { id: 'u9' } }));
    expect(rememberedUserId()).toBe('u9');
    cacheTeams('u9', [{ id: 't1' }]);
    expect(expectsTeam(null)).toBe(true);
  });

  it('keeps Home’s activity feed per user and team, newest 60', () => {
    cacheActivity('u1', 't1', Array.from({ length: 80 }, (_, i) => ({ id: i })));
    expect(cachedActivity('u1', 't1')).toHaveLength(60);
    expect(cachedActivity('u1', 't2')).toBe(null);
    expect(cachedActivity('u2', 't1')).toBe(null);
  });

  it('the plain placeholder has no app shape; the skeletons do', () => {
    const { container, unmount } = render(<PlainLoading />);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0);
    unmount();
    render(<AppSkeleton />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(5);
  });

  it('Home’s skeleton is labelled as loading', () => {
    render(<HomeSkeleton />);
    expect(screen.getByLabelText('Loading')).toBeTruthy();
  });
});
