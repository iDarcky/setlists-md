import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls = { rpc: null, select: null, inserts: [] };
let rpcResult = { data: null, error: null };
let insertErrors = [];

vi.mock('@/auth/supabase', () => {
  const table = () => {
    const q = {
      insert: (row) => { calls.inserts.push(row); return Promise.resolve({ error: insertErrors.shift() || null }); },
      select: () => q, eq: () => q, gt: () => q, order: () => q, limit: () => q,
      maybeSingle: () => Promise.resolve(calls.select || { data: null, error: null }),
    };
    return q;
  };
  return { supabase: { from: table, rpc: (name, args) => { calls.rpc = { name, args }; return Promise.resolve(rpcResult); } } };
});

const { shareEndsAt, createSetlistShare, fetchSharedSetlist } = await import('@/lib/setlistShare');
const { buildPrintDocument } = await import('@/pdf/printSetlist');
const { songFromFlat } = await import('@/arrangements');

const H = 3600000;
const local = (s) => new Date(s).getTime();

beforeEach(() => {
  calls.rpc = null; calls.select = null; calls.inserts = [];
  rpcResult = { data: null, error: null };
  insertErrors = [];
});

describe('shareEndsAt', () => {
  const now = local('2026-10-30T12:00:00');
  it('ends 3 hours after the end time', () => {
    expect(shareEndsAt({ date: '2026-11-01', time: '10:00', endTime: '11:30' }, now)).toBe(local('2026-11-01T14:30:00'));
  });
  it('a service with no end time runs 3 hours', () => {
    expect(shareEndsAt({ date: '2026-11-01', time: '10:00' }, now)).toBe(local('2026-11-01T16:00:00'));
  });
  it('undated: 24 hours from now', () => {
    expect(shareEndsAt({}, now)).toBe(now + 24 * H);
  });
  it('a service that already ended still gets a day', () => {
    expect(shareEndsAt({ date: '2026-10-01', time: '10:00' }, now)).toBe(now + 24 * H);
  });
});

describe('createSetlistShare', () => {
  const setlist = { id: 'sl1', name: 'Sunday', date: '2026-11-01', time: '10:00', items: [{ songId: 'a' }] };
  it('a church setlist makes a live link with no copy of the songs', async () => {
    const r = await createSetlistShare(setlist, [{ id: 'a' }], { ownerId: 'u', teamId: 't', rowId: 'r', now: local('2026-10-30T12:00:00') });
    expect(r.live).toBe(true);
    expect(calls.inserts[0]).toMatchObject({ team_id: 't', setlist_row_id: 'r', setlist: { id: 'sl1' }, songs: [] });
  });
  it('falls back to a snapshot when the migration has not run', async () => {
    insertErrors = [{ code: 'PGRST204' }];
    const r = await createSetlistShare(setlist, [{ id: 'a' }, { id: 'b' }], { ownerId: 'u', teamId: 't', rowId: 'r' });
    expect(r.live).toBe(false);
    expect(calls.inserts[1].songs).toEqual([{ id: 'a' }]);
    expect(calls.inserts[1].setlist_row_id).toBeUndefined();
  });
});

describe('fetchSharedSetlist', () => {
  it('reads a live link through the RPC and builds the songs', async () => {
    rpcResult = { data: {
      live: true, title: 'Sunday',
      setlist: { name: 'Sunday', items: [{ songId: 'a', leadBy: 'u1' }] },
      songs: [{ key: 'a', doc: null, content: '---\ntitle: Way Maker\nkey: E\n---\n\n## Verse\n[E]Way maker' }],
      church: { name: 'Grace', logo_url: null }, expires_at: '2026-11-01T14:30:00Z',
    }, error: null };
    const d = await fetchSharedSetlist('abcdefghijklmnop');
    expect(calls.rpc.name).toBe('get_shared_setlist');
    expect(d.live).toBe(true);
    expect(d.church.name).toBe('Grace');
    expect(d.songs[0]).toMatchObject({ id: 'a', title: 'Way Maker' });
    expect(d.setlist.items[0].leadBy).toBeUndefined();
  });
  it('before the migration, reads the table and still hides who leads', async () => {
    rpcResult = { data: null, error: { code: 'PGRST202' } };
    calls.select = { data: { title: 'Old', setlist: { items: [{ songId: 'a', leadBy: 'u1' }] }, songs: [{ id: 'a', title: 'X', arrangements: [] }] }, error: null };
    const d = await fetchSharedSetlist('abcdefghijklmnop');
    expect(d.live).toBe(false);
    expect(d.songs[0].id).toBe('a');
    expect(d.setlist.items[0].leadBy).toBeUndefined();
  });
  it('an ended link is null', async () => {
    expect(await fetchSharedSetlist('abcdefghijklmnop')).toBeNull();
  });
});

describe('the printout', () => {
  const song = songFromFlat({ id: 'a', title: 'Way Maker', key: 'E', tempo: 68, sections: [] });
  const setlist = { name: 'Sunday', items: [{ songId: 'a', leadBy: 'u1', note: 'Soft start' }] };
  const nameOf = () => 'Joe';
  it('names who leads, the notes, the band and the church', () => {
    const html = buildPrintDocument(setlist, [song], {
      nameOf, band: ['Joe (Vocals)', 'Ana (Keys)'], church: { name: 'Grace Church' },
    });
    expect(html).toContain('Joe leads · 68 bpm · Soft start');
    expect(html).toContain('Band:</b> Joe (Vocals) · Ana (Keys)');
    expect(html).toContain('Grace Church · setlists');
    expect(html).not.toContain('class="sheet"><div class="head"><div><div class="eyebrow" style');
  });
  it('the switches leave them out', () => {
    const html = buildPrintDocument(setlist, [song], { nameOf, notes: false, leads: false });
    expect(html).not.toContain('Joe leads');
    expect(html).not.toContain('Soft start');
    expect(html).not.toContain('Band:');
  });
  it('Charts adds a page per song, in the key it is played in', () => {
    const s = songFromFlat({ id: 'a', title: 'Way Maker', key: 'E', sections: [{ type: 'Verse 1', lines: ['[E]Way [B]maker'] }] });
    const html = buildPrintDocument({ name: 'Sunday', items: [{ songId: 'a', transpose: 2 }] }, [s], { mode: 'full' });
    expect(html).toContain('1 of 1 · Sunday');
    expect(html).toContain('<div class="kk">Gb');
    expect(html).toContain('>Db</span>');
  });
});
