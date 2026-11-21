import { describe, it, expect } from 'vitest';
import { pickSuccessor, memberName, deleteConfirmed } from '@/lib/deleteAccount';

describe('pickSuccessor', () => {
  const m = (user_id, role, joined_at) => ({ user_id, role, joined_at });
  it('picks the earliest leader who is not the owner', () => {
    const list = [m('o', 'admin', '2026-01-01'), m('a', 'member', '2026-01-02'), m('b', 'admin', '2026-03-01'), m('c', 'admin', '2026-02-01')];
    expect(pickSuccessor(list, 'o').user_id).toBe('c');
  });
  it('else the earliest member', () => {
    expect(pickSuccessor([m('o', 'admin', '2026-01-01'), m('x', 'member', '2026-05-01'), m('y', 'member', '2026-04-01')], 'o').user_id).toBe('y');
  });
  it('null when the owner is alone', () => {
    expect(pickSuccessor([m('o', 'admin', '2026-01-01')], 'o')).toBeNull();
  });
});

describe('deleteConfirmed', () => {
  it('needs the team name when there is one, any case', () => {
    expect(deleteConfirmed(' grace church ', 'Grace Church')).toBe(true);
    expect(deleteConfirmed('DELETE', 'Grace Church')).toBe(false);
  });
  it('needs DELETE otherwise', () => {
    expect(deleteConfirmed('delete', null)).toBe(true);
  });
  it('memberName falls back to the email', () => {
    expect(memberName({ profile: { email: 'ana@x.com' } })).toBe('ana');
  });
});
