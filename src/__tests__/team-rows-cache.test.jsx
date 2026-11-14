import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// A tab switch unmounts Home / Schedule and mounts them again. Their team data
// hooks used to start from [] each time, so the activity feed and the band's
// availability painted empty, then filled in: "widgets draw again".

const auth = { user: { id: 'me' } };
vi.mock('@/auth/useAuth', () => ({ useAuth: () => auth }));

const rows = {
  team_activity: [{ id: 'a1', team_id: 't1' }],
  team_availability: [{ id: 'v1', team_id: 't1', user_id: 'me', date: '2026-11-15', status: 'available' }],
};
let resolveFetch;
const query = (table) => {
  const q = {
    select: () => q, eq: () => q, gte: () => q, order: () => q,
    limit: () => new Promise((r) => { resolveFetch = () => r({ data: rows[table], error: null }); }),
  };
  return q;
};
const channel = { on: () => channel, subscribe: () => channel };
vi.mock('@/auth/supabase', () => ({
  supabase: { from: (t) => query(t), channel: () => channel, removeChannel: () => {} },
}));

import { useTeamActivity } from '@/hooks/useTeamActivity';
import { useTeamAvailability } from '@/hooks/useTeamAvailability';
import { clearTeamRows } from '@/hooks/teamRowsCache';

beforeEach(() => clearTeamRows());

describe.each([
  ['useTeamActivity', (id) => useTeamActivity(id).activity, 'a1'],
  ['useTeamAvailability', (id) => useTeamAvailability(id).availability, 'v1'],
])('%s', (_, use, firstId) => {
  it('paints the last rows at once on the next visit, then refreshes', async () => {
    const first = renderHook(() => use('t1'));
    expect(first.result.current).toEqual([]); // first ever visit: nothing known yet
    resolveFetch();
    await waitFor(() => expect(first.result.current.map((r) => r.id)).toEqual([firstId]));
    first.unmount();

    const second = renderHook(() => use('t1'));
    expect(second.result.current.map((r) => r.id)).toEqual([firstId]); // no empty frame
    second.unmount();
  });

  it("never shows another team's rows", async () => {
    const a = renderHook(() => use('t1'));
    resolveFetch();
    await waitFor(() => expect(a.result.current).toHaveLength(1));
    a.unmount();
    const b = renderHook(() => use('t2'));
    expect(b.result.current).toEqual([]);
    b.unmount();
  });
});
