import { describe, it, expect } from 'vitest';
import {
  splitPattern, joinPattern, nextNumber, autoName, nextDates, draftFromTemplate, lastPlayed,
  templatesOf, parseTime, typeTime, draftFromSetlist, recentSetlists, isPlaceholder, placeholderItem,
} from '@/lib/newSetlist';
import { buildOrder } from '@/lib/setlistView';

const AM = { id: 'am', isTemplate: true, templateKind: 'service', templateName: 'Sunday Morning', weekday: 0, time: '10:00', location: 'Main hall',
  rehearsalOn: true, rehearsalOffset: 1, rehearsalTime: '18:00', namePattern: 'BBPT #{n} AM', startNumber: 1,
  items: [placeholderItem(), { type: 'break', label: 'Prayer', duration: 5 }, placeholderItem()] };
const PM = { ...AM, id: 'pm', templateName: 'Sunday Evening', time: '18:00', namePattern: 'BBPT #{n} PM' };

describe('numbered setlist names', () => {
  it('splits and joins a pattern', () => {
    expect(splitPattern('BBPT #{n} AM')).toEqual({ before: 'BBPT #', after: ' AM' });
    expect(splitPattern('Sunday')).toBeNull();
    expect(joinPattern('BBPT #', ' PM')).toBe('BBPT #{n} PM');
  });

  it('continues from the highest number already used', () => {
    const setlists = [{ id: 'a', name: 'BBPT #423 AM', date: '2026-11-01' }, { id: 'b', name: 'BBPT #422 PM', date: '2026-10-25' }];
    expect(nextNumber('BBPT #{n} AM', setlists, '2026-11-08')).toBe(424);
    expect(autoName(AM, setlists, '2026-11-08')).toBe('BBPT #424 AM');
  });

  it('gives the evening the morning’s number on the same Sunday', () => {
    const setlists = [{ id: 'a', name: 'BBPT #423 AM', date: '2026-11-01' }, { id: 'b', name: 'BBPT #424 AM', date: '2026-11-08' }];
    expect(autoName(PM, setlists, '2026-11-08')).toBe('BBPT #424 PM');
    expect(autoName(PM, setlists, '2026-11-15')).toBe('BBPT #425 PM');
  });

  it('starts at the template’s start number and pads to three digits', () => {
    expect(autoName({ ...AM, startNumber: 424 }, [], '2026-11-08')).toBe('BBPT #424 AM');
    expect(autoName(AM, [], '2026-11-08')).toBe('BBPT #001 AM');
  });

  it('ignores the setlist being edited and templates', () => {
    const setlists = [AM, { id: 'me', name: 'BBPT #500 AM', date: '2026-11-08' }];
    expect(nextNumber('BBPT #{n} AM', setlists, '2026-11-08', 1, 'me')).toBe(1);
  });

  it('uses the template name without a pattern', () => {
    expect(autoName({ ...AM, namePattern: '' }, [], '2026-11-08')).toBe('Sunday Morning');
  });
});

describe('draft from a template', () => {
  it('dates it on the next free service day, with the rehearsal the day before', () => {
    const setlists = [AM, { id: 'x', name: 'BBPT #423 AM', templateId: 'am', date: '2026-11-08' }];
    const d = draftFromTemplate(AM, setlists, '2026-11-03');
    expect(d.date).toBe('2026-11-15');
    expect(d.rehearsalDate).toBe('2026-11-14');
    expect(d.rehearsalTime).toBe('18:00');
    expect(d.rehearsalLocation).toBe('Main hall');
    expect(d.name).toBe('BBPT #424 AM');
    expect(d.templateId).toBe('am');
    expect(d.items.filter(isPlaceholder)).toHaveLength(2);
  });

  it('a blank draft is dated next Sunday', () => {
    expect(draftFromTemplate(null, [], '2026-11-03').date).toBe('2026-11-08');
  });

  it('lists the next free days of the weekday', () => {
    expect(nextDates(0, new Set(['2026-11-15']), 3, '2026-11-03')).toEqual(['2026-11-08', '2026-11-22', '2026-11-29']);
  });
});

describe('templates are their own kind', () => {
  it('lists only templates made in the editor', () => {
    const setlists = [
      { id: 'a', name: 'Youth', service: 'Youth', date: '2026-10-30', items: [] },
      { id: 'old', isTemplate: true, name: 'Christmas template', items: [{ songId: 's1' }] },
      AM,
    ];
    expect(templatesOf(setlists).map(t => t.id)).toEqual(['am']);
  });
});

describe('last played', () => {
  const setlists = [
    { id: 'a', date: '2026-10-04', items: [{ songId: 's', transpose: 2, tempo: 74, time: '3/4', leadBy: 'ana' }] },
    { id: 'b', date: '2026-09-01', items: [{ songId: 's' }] },
    { id: 'c', date: '2026-12-01', items: [{ songId: 's' }] },
  ];
  it('finds the latest past setlist with the song, as it was played', () => {
    expect(lastPlayed('s', setlists, '2026-11-03')).toEqual({ date: '2026-10-04', transpose: 2, tempo: 74, time: '3/4', leadBy: 'ana', arrangementId: null });
    expect(lastPlayed('none', setlists, '2026-11-03')).toBeNull();
  });
});

describe('placeholders in the order', () => {
  it('count as a song slot with no key', () => {
    const { rows, songCount } = buildOrder({ items: [placeholderItem(), { songId: 'x', time: '6/8' }] }, [{ id: 'x', title: 'X', arrangements: [{ id: 'a', key: 'C', time: '4/4', sections: [] }] }]);
    expect(rows[0]).toMatchObject({ kind: 'song', placeholder: true, title: 'Song', n: 1 });
    expect(rows[1]).toMatchObject({ title: 'X', time: '6/8', n: 2 });
    expect(songCount).toBe(2);
  });
});

describe('copy a past setlist', () => {
  const past = { id: 'p1', name: 'BBPT #423 AM', service: 'Sunday Morning', date: '2026-11-01', time: '10:00', location: 'Main hall',
    rehearsalDate: '2026-10-31', rehearsalTime: '18:00',
    items: [{ songId: 's1', leadBy: 'u1', transpose: 2 }, { type: 'break', label: 'Prayer', leadBy: 'u2' }, { songId: 's2' }] };
  it('keeps the shape: moments stay, songs become empty slots, nobody leads', () => {
    const d = draftFromSetlist(past, [past], '2026-11-04');
    expect(d.id).not.toBe('p1');
    expect(d).toMatchObject({ service: 'Sunday Morning', date: '2026-11-08', time: '10:00', location: 'Main hall', rehearsalDate: '2026-11-07', rehearsalTime: '18:00', status: 'draft' });
    expect(d.items).toEqual([{ placeholder: true }, { type: 'break', label: 'Prayer' }, { placeholder: true }]);
  });
  it('follows its template when it still exists', () => {
    const tpl = { ...AM, id: 'am' };
    const d = draftFromSetlist({ ...past, templateId: 'am' }, [tpl, { ...past, templateId: 'am' }], '2026-11-04');
    expect(d.templateId).toBe('am');
  });
  it('lists the newest dated setlists, never templates', () => {
    const list = recentSetlists([past, AM, { id: 'p2', date: '2026-11-08', items: [] }, { id: 'nd', items: [] }]);
    expect(list.map(s => s.id)).toEqual(['p2', 'p1']);
  });
});

describe('typed times', () => {
  it('reads what people type', () => {
    expect(parseTime('1030')).toBe('10:30');
    expect(parseTime('930')).toBe('09:30');
    expect(parseTime('18')).toBe('18:00');
    expect(parseTime('25:00')).toBe(null);
    expect(parseTime('abc')).toBe(null);
  });
});

describe('rehearsal picked each week', () => {
  it('brings the time and place, not the day', () => {
    const d = draftFromTemplate({ ...AM, rehearsalOn: true, rehearsalPick: true, rehearsalTime: '18:00' }, [], '2026-11-04');
    expect(d.rehearsalDate).toBeUndefined();
    expect(d.rehearsalTime).toBe('18:00');
  });
});

describe('typing a time', () => {
  it('moves on to the minutes by itself', () => {
    expect(typeTime('1', '')).toBe('1');
    expect(typeTime('10', '1')).toBe('10:');
    expect(typeTime('10:3', '10:')).toBe('10:3');
    expect(typeTime('10:30', '10:3')).toBe('10:30');
    expect(typeTime('9', '')).toBe('09:');
    expect(typeTime('10:305', '10:30')).toBe('10:30');
  });
  it('lets a backspace through', () => {
    expect(typeTime('10', '10:')).toBe('1');
    expect(typeTime('10:', '10:3')).toBe('10:');
  });
});
