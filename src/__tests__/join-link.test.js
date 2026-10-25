import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeJoinCode,
  parseJoinPath,
  joinUrl,
  toggleJoinPart,
  joinPartLabel,
  JOIN_PARTS,
  savePendingJoin,
  loadPendingJoin,
  clearPendingJoin,
  PENDING_JOIN_KEY,
  shouldResumeJoin,
  joinDecisionFor,
  alreadyInLine,
  churchInitials,
  joinStepFor,
  findJoinRequest,
  inviteMailto,
} from '@/lib/joinLink';
import { normalize } from '@/data/instruments';

describe('join code parsing', () => {
  it('normalises case and whitespace', () => {
    expect(normalizeJoinCode('  AbC23xyz9k  ')).toBe('abc23xyz9k');
  });
  it('rejects anything the DB would reject', () => {
    expect(normalizeJoinCode('short')).toBeNull();
    expect(normalizeJoinCode('has space in')).toBeNull();
    expect(normalizeJoinCode('bad-chars!!')).toBeNull();
    expect(normalizeJoinCode('a'.repeat(33))).toBeNull();
    expect(normalizeJoinCode(null)).toBeNull();
  });
  it('reads /join/<code> paths', () => {
    expect(parseJoinPath('/join/abc23xyz9kmn')).toBe('abc23xyz9kmn');
    expect(parseJoinPath('/join/ABC23XYZ9KMN/')).toBe('abc23xyz9kmn');
    expect(parseJoinPath('/JOIN/abc23xyz9kmn')).toBe('abc23xyz9kmn');
    expect(parseJoinPath('https://app.setlists.md/join/abc23xyz9kmn')).toBe('abc23xyz9kmn');
  });
  it('ignores other paths', () => {
    expect(parseJoinPath('/')).toBeNull();
    expect(parseJoinPath('/join')).toBeNull();
    expect(parseJoinPath('/join/')).toBeNull();
    expect(parseJoinPath('/join/abc23xyz9kmn/extra')).toBeNull();
    expect(parseJoinPath('/joiner/abc23xyz9kmn')).toBeNull();
    expect(parseJoinPath('/join/%E0%A4%A')).toBeNull();
    expect(parseJoinPath(undefined)).toBeNull();
  });
  it('builds the URL without doubling slashes', () => {
    expect(joinUrl('https://app.setlists.md/', 'abc23xyz9kmn')).toBe('https://app.setlists.md/join/abc23xyz9kmn');
  });
});

describe('parts', () => {
  it('toggles and keeps the canonical order', () => {
    let v = toggleJoinPart([], 'drums');
    v = toggleJoinPart(v, 'vocals');
    expect(v).toEqual(['vocals', 'drums']);
    expect(toggleJoinPart(v, 'drums')).toEqual(['vocals']);
  });
  it('labels known and unknown parts', () => {
    expect(joinPartLabel('bass-guitar')).toBe('Bass');
    expect(joinPartLabel('kazoo')).toBe('kazoo');
  });
  it('instrument chips are canonical tokens (approval copies them to team_members.instruments)', () => {
    const instrumentChips = JOIN_PARTS.filter(p => !['sound-desk', 'lyrics-slides', 'other'].includes(p.id));
    for (const p of instrumentChips) expect(normalize(p.id)).toBe(p.id);
    expect(normalize('sound-desk')).toBeNull();
  });
});

// The logic project runs in node — give it a minimal localStorage.
function installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
    clear: () => { store.clear(); },
  };
}

describe('pending join across sign-in', () => {
  beforeEach(() => { installLocalStorage(); });

  it('round-trips', () => {
    savePendingJoin('ABC23XYZ9KMN', 'auth', 1000);
    expect(loadPendingJoin(2000)).toEqual({ code: 'abc23xyz9kmn', stage: 'auth', at: 1000 });
    clearPendingJoin();
    expect(loadPendingJoin()).toBeNull();
  });
  it('keeps the request id it is waiting on', () => {
    savePendingJoin('abc23xyz9kmn', 'requested', 1000, { requestId: 'req-2' });
    expect(loadPendingJoin(2000)).toEqual({ code: 'abc23xyz9kmn', stage: 'requested', at: 1000, requestId: 'req-2' });
  });
  it('expires after a week', () => {
    savePendingJoin('abc23xyz9kmn', 'auth', 0);
    expect(loadPendingJoin(8 * 24 * 3600 * 1000)).toBeNull();
  });
  it('survives storage that throws (private mode)', () => {
    globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
    expect(() => savePendingJoin('abc23xyz9kmn')).not.toThrow();
    expect(loadPendingJoin()).toBeNull();
    expect(() => clearPendingJoin()).not.toThrow();
  });
  it('ignores junk', () => {
    localStorage.setItem(PENDING_JOIN_KEY, '{not json');
    expect(loadPendingJoin()).toBeNull();
    localStorage.setItem(PENDING_JOIN_KEY, JSON.stringify({ code: 'x' }));
    expect(loadPendingJoin()).toBeNull();
    savePendingJoin('nope');
    expect(localStorage.getItem(PENDING_JOIN_KEY)).toBe(JSON.stringify({ code: 'x' }));
  });
  it('resumes an unfinished sign-in or a request still waiting', () => {
    expect(shouldResumeJoin({ pathCode: 'abc23xyz9kmn', pending: null, signedIn: false })).toBe(true);
    expect(shouldResumeJoin({ pathCode: null, pending: { code: 'abc23xyz9kmn', stage: 'auth' }, signedIn: true })).toBe(true);
    expect(shouldResumeJoin({ pathCode: null, pending: { code: 'abc23xyz9kmn', stage: 'auth' }, signedIn: false })).toBe(false);
    // A request still being decided reopens Waiting rather than the app.
    expect(shouldResumeJoin({ pathCode: null, pending: { code: 'abc23xyz9kmn', stage: 'requested' }, signedIn: true })).toBe(true);
    expect(shouldResumeJoin({ pathCode: null, pending: null, signedIn: true })).toBe(false);
  });
});

describe('which join decision to announce', () => {
  const at = Date.parse('2026-10-25T17:59:00Z');
  const old = { id: 'req-1', team_id: 't', status: 'approved', decided_at: '2026-10-25T15:08:51Z' };
  const now = { id: 'req-2', team_id: 't', status: 'pending', decided_at: null };
  it('ignores an older approval while the new request is pending', () => {
    expect(joinDecisionFor([now, old], { stage: 'requested', at, requestId: 'req-2' })).toBeNull();
    // Without a stored id: only decisions after this device asked.
    expect(joinDecisionFor([now, old], { stage: 'requested', at })).toBeNull();
  });
  it('announces the request it is waiting on', () => {
    const approved = { ...now, status: 'approved', decided_at: '2026-10-25T18:03:35Z' };
    expect(joinDecisionFor([approved, old], { stage: 'requested', at, requestId: 'req-2' })).toBe(approved);
    expect(joinDecisionFor([approved, old], { stage: 'requested', at })).toBe(approved);
    const declined = { ...now, status: 'declined', decided_at: '2026-10-25T18:03:35Z' };
    expect(joinDecisionFor([declined], { stage: 'requested', at, requestId: 'req-2' })).toBe(declined);
  });
  it('says nothing without a request being waited on', () => {
    expect(joinDecisionFor([old], null)).toBeNull();
    expect(joinDecisionFor([old], { stage: 'auth', at: 0 })).toBeNull();
  });
});

describe('landing copy', () => {
  it('names the leader and counts the others', () => {
    expect(alreadyInLine({ leaderName: 'Ana', memberCount: 12 })).toBe('Ana and 11 others are already in');
    expect(alreadyInLine({ leaderName: 'Ana', memberCount: 2 })).toBe('Ana and 1 other are already in');
    expect(alreadyInLine({ leaderName: 'Ana', memberCount: 1 })).toBe('Ana is already in');
    expect(alreadyInLine({ leaderName: null, memberCount: 3 })).toBe('3 people are already in');
    expect(alreadyInLine({ leaderName: null, memberCount: 0 })).toBe('');
  });
  it('makes initials', () => {
    expect(churchInitials('Grace Church Worship')).toBe('GC');
    expect(churchInitials('Biserica Speranța')).toBe('BS');
    expect(churchInitials('  hillsong ')).toBe('H');
    expect(churchInitials('')).toBe('?');
  });
});

describe('which screen', () => {
  const ok = { status: 'ok', team_name: 'Grace' };
  it('errors on a bad or paused link', () => {
    expect(joinStepFor({ peek: { status: 'invalid' }, signedIn: true })).toBe('error');
    expect(joinStepFor({ peek: { status: 'disabled' }, signedIn: false })).toBe('error');
    expect(joinStepFor({ peek: null, signedIn: false })).toBe('error');
  });
  it('routes by sign-in and membership', () => {
    expect(joinStepFor({ peek: ok, signedIn: false })).toBe('landing');
    expect(joinStepFor({ peek: { ...ok, is_member: true }, signedIn: true })).toBe('in');
    expect(joinStepFor({ peek: { ...ok, my_status: 'pending' }, signedIn: true })).toBe('waiting');
    expect(joinStepFor({ peek: { ...ok, my_status: 'declined' }, signedIn: true })).toBe('about');
    expect(joinStepFor({ peek: ok, signedIn: true })).toBe('about');
  });
  it('finds the request this flow is about', () => {
    const rows = [
      { id: '3', team_id: 'B', status: 'pending' },
      { id: '2', team_id: 'A', status: 'approved' },
      { id: '1', team_id: 'A', status: 'declined' },
    ];
    expect(findJoinRequest(rows, { requestId: '1' }).id).toBe('1');
    expect(findJoinRequest(rows, { teamId: 'A' }).id).toBe('2');
    expect(findJoinRequest(rows, { teamId: 'B' }).id).toBe('3');
    expect(findJoinRequest(rows, { teamId: 'C' })).toBeNull();
    expect(findJoinRequest(null, { teamId: 'A' })).toBeNull();
  });
});

describe('inviteMailto', () => {
  it('addresses the invitee and carries the join link', () => {
    const href = inviteMailto({ email: 'ana@example.com', teamName: 'Grace Church', url: 'https://app.test/join/abc23xyz9kmn' });
    expect(href.startsWith('mailto:ana%40example.com?')).toBe(true);
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('subject')).toBe('Join Grace Church on Setlists.md');
    expect(params.get('body')).toContain('https://app.test/join/abc23xyz9kmn');
  });
});
