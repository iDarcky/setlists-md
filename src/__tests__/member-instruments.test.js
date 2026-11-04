import { describe, it, expect, vi } from 'vitest';
import { cleanParts, saveMemberInstruments, canSetOthersParts, membersWithoutParts, NOT_SAVED } from '@/lib/memberInstruments';
import { needsYou } from '@/lib/homeData';

function fake({ rpc, updateRows = [{ id: 'm1' }], updateError = null }) {
  const update = vi.fn(() => ({ eq: () => ({ select: async () => ({ data: updateRows, error: updateError }) }) }));
  return { rpc: vi.fn(async () => rpc), from: vi.fn(() => ({ update })), update };
}

describe('cleanParts', () => {
  it('trims, drops blanks and repeats, keeps order', () => {
    expect(cleanParts([' drums', 'keys', 'drums', '', null, 'vocals:alto'])).toEqual(['drums', 'keys', 'vocals:alto']);
    expect(cleanParts(null)).toEqual([]);
  });
});

describe('saveMemberInstruments', () => {
  it('saves through set_member_instruments', async () => {
    const sb = fake({ rpc: { data: ['drums', 'vocals:alto', 'vocals:tenor'], error: null } });
    const out = await saveMemberInstruments(sb, { memberId: 'm1', instruments: ['drums', 'vocals:alto', 'vocals:tenor'] });
    expect(sb.rpc).toHaveBeenCalledWith('set_member_instruments', { p_member_id: 'm1', p_instruments: ['drums', 'vocals:alto', 'vocals:tenor'] });
    expect(out).toEqual(['drums', 'vocals:alto', 'vocals:tenor']);
    expect(sb.from).not.toHaveBeenCalled();
  });

  it('throws the server refusal (not a leader)', async () => {
    const sb = fake({ rpc: { data: null, error: { code: '42501', message: 'Only leaders can change what someone else plays.' } } });
    await expect(saveMemberInstruments(sb, { memberId: 'm2', instruments: ['drums'] })).rejects.toMatchObject({ code: '42501' });
    expect(sb.from).not.toHaveBeenCalled();
  });

  it('falls back to a direct update before the SQL is run', async () => {
    const sb = fake({ rpc: { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } } });
    expect(await saveMemberInstruments(sb, { memberId: 'm1', instruments: ['keys'] })).toEqual(['keys']);
    expect(sb.update).toHaveBeenCalledWith({ instruments: ['keys'] });
  });

  it('fails loudly when the update changed no row (the old silent bug)', async () => {
    const sb = fake({ rpc: { data: null, error: { code: 'PGRST202', message: 'x' } }, updateRows: [] });
    await expect(saveMemberInstruments(sb, { memberId: 'm1', instruments: ['keys'] })).rejects.toThrow(NOT_SAVED);
  });
});

describe('who may set parts, and who has none', () => {
  it('owner, admin and leader; not editor or member', () => {
    expect(canSetOthersParts({ role: 'member', isOwner: true })).toBe(true);
    expect(canSetOthersParts({ role: 'admin' })).toBe(true);
    expect(canSetOthersParts({ role: 'leader' })).toBe(true);
    expect(canSetOthersParts({ role: 'editor' })).toBe(false);
    expect(canSetOthersParts({ role: 'member' })).toBe(false);
  });
  it('lists members with nothing set', () => {
    const ms = [{ id: 1, instruments: [] }, { id: 2, instruments: ['drums'] }, { id: 3 }, { id: 4, instruments: [' '] }];
    expect(membersWithoutParts(ms).map(m => m.id)).toEqual([1, 3, 4]);
  });
  it('Needs you lists them for leaders', () => {
    const items = needsYou({ noParts: ['Ana', 'Ben'] });
    expect(items).toEqual([{ kind: 'parts', count: 2, names: ['Ana', 'Ben'] }]);
    expect(needsYou({})).toEqual([]);
  });
});

import { saveMemberRole, deleteMember } from '@/lib/memberInstruments';

function fakeWrite({ rpcError = null, rows = [{ id: 'm1' }] }) {
  const tail = { eq: () => ({ select: async () => ({ data: rows, error: null }) }) };
  const update = vi.fn(() => tail);
  const del = vi.fn(() => tail);
  return { rpc: vi.fn(async () => ({ data: null, error: rpcError })), from: vi.fn(() => ({ update, delete: del })), update, del };
}

describe('roles and removing people', () => {
  it('uses set_member_role / remove_member', async () => {
    const sb = fakeWrite({});
    await saveMemberRole(sb, { memberId: 'm1', role: 'editor' });
    await deleteMember(sb, { memberId: 'm1' });
    expect(sb.rpc).toHaveBeenNthCalledWith(1, 'set_member_role', { p_member_id: 'm1', p_role: 'editor' });
    expect(sb.rpc).toHaveBeenNthCalledWith(2, 'remove_member', { p_member_id: 'm1' });
    expect(sb.from).not.toHaveBeenCalled();
  });
  it('passes the server refusal on', async () => {
    const sb = fakeWrite({ rpcError: { code: '42501', message: 'Only the church owner can let someone change roles.' } });
    await expect(saveMemberRole(sb, { memberId: 'm1', role: 'admin' })).rejects.toThrow('Only the church owner');
  });
  it('fails loudly when the old write changed nothing (before the SQL)', async () => {
    const missing = { code: 'PGRST202', message: 'Could not find the function' };
    await expect(saveMemberRole(fakeWrite({ rpcError: missing, rows: [] }), { memberId: 'm1', role: 'member' })).rejects.toThrow(NOT_SAVED);
    await expect(deleteMember(fakeWrite({ rpcError: missing, rows: [] }), { memberId: 'm1' })).rejects.toThrow(NOT_SAVED);
    await expect(deleteMember(fakeWrite({ rpcError: missing }), { memberId: 'm1' })).resolves.toBeUndefined();
  });
});
