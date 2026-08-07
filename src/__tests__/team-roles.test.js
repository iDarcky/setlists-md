import { describe, it, expect } from 'vitest';
import {
  TEAM_ROLES, roleDef, canWriteLibrary, canPlanServices, canManageMembers,
} from '@/lib/teamRoles';

describe('team roles — the administrative axis', () => {
  it('defines exactly the four stored roles', () => {
    expect(TEAM_ROLES.map(r => r.id)).toEqual(['admin', 'leader', 'editor', 'member']);
  });

  // The change of 2026-08-07. `leader` planned services but could not change a
  // song in one, which is what forced "ask an admin to write it for me".
  it('lets a leader write the library', () => {
    expect(canWriteLibrary('leader')).toBe(true);
  });

  it('lets admin, leader and editor write; member may not', () => {
    expect(canWriteLibrary('admin')).toBe(true);
    expect(canWriteLibrary('editor')).toBe(true);
    expect(canWriteLibrary('member')).toBe(false);
  });

  it('lets only admin and leader plan services', () => {
    expect(canPlanServices('admin')).toBe(true);
    expect(canPlanServices('leader')).toBe(true);
    expect(canPlanServices('editor')).toBe(false);
    expect(canPlanServices('member')).toBe(false);
  });

  it('lets only admin manage members', () => {
    expect(TEAM_ROLES.filter(r => r.canManageMembers).map(r => r.id)).toEqual(['admin']);
    expect(canManageMembers('leader')).toBe(false);
  });

  // A role that arrives from the DB that this build does not know about must
  // not be handed power by accident — the writer set is the thing RLS also
  // guards, so the safe fallback is the least-privileged role.
  it('falls back to member for unknown, empty and absent roles', () => {
    for (const bad of ['owner', 'Admin ', '', null, undefined, 42]) {
      expect(canWriteLibrary(bad)).toBe(false);
      expect(canPlanServices(bad)).toBe(false);
      expect(canManageMembers(bad)).toBe(false);
    }
    expect(roleDef('nonsense').id).toBe('member');
  });

  it('trims a stored role before matching', () => {
    expect(canWriteLibrary(' leader ')).toBe(true);
  });

  it('gives every role a label and a blurb for the picker', () => {
    for (const r of TEAM_ROLES) {
      expect(r.label).toBeTruthy();
      expect(r.blurb).toBeTruthy();
    }
  });
});
