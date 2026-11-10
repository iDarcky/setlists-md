import { describe, it, expect } from 'vitest';
import { churchRequestText, sendChurchRequest, sentChurchRequest, rememberChurchRequest, CHURCH_REQUEST_TAG } from '@/lib/churchRequest';

const memory = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
};

describe('churchRequest', () => {
  it('writes one line per answer, tag first, skipping blanks', () => {
    const text = churchRequestText({ church: ' Grace Chapel ', place: 'Cluj, Romania', people: '', note: '', email: 'a@b.c', name: 'Ana', from: 'site' });
    expect(text).toBe(`${CHURCH_REQUEST_TAG} Grace Chapel\nWhere: Cluj, Romania\nFrom: Ana · a@b.c\nCame from: site`);
  });

  it('inserts into feedback as a general row', async () => {
    const rows = [];
    const fake = { from: (t) => ({ insert: async (row) => { rows.push({ t, row }); return { error: null }; } }) };
    await sendChurchRequest(fake, { userId: 'u1', church: 'X', place: 'Y', email: 'e@x.y' });
    expect(rows[0].t).toBe('feedback');
    expect(rows[0].row).toMatchObject({ user_id: 'u1', type: 'general' });
    expect(rows[0].row.description.startsWith(`${CHURCH_REQUEST_TAG} X`)).toBe(true);
  });

  it('surfaces a failed insert', async () => {
    const fake = { from: () => ({ insert: async () => ({ error: new Error('nope') }) }) };
    await expect(sendChurchRequest(fake, { church: 'X', place: 'Y' })).rejects.toThrow('nope');
    await expect(sendChurchRequest(null, { church: 'X', place: 'Y' })).rejects.toThrow();
  });

  it('remembers a sent request per account', () => {
    const s = memory();
    rememberChurchRequest('u1', 'Grace', s);
    expect(sentChurchRequest('u1', s)).toMatchObject({ church: 'Grace' });
    expect(sentChurchRequest('u2', s)).toBe(null);
  });
});
