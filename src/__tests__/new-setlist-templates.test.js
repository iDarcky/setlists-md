import { describe, it, expect } from 'vitest';
import {
  splitPattern, joinPattern, nextNumber, autoName, nextDates, draftFromTemplate, lastPlayed,
  serviceTemplates, isPlaceholder, placeholderItem,
} from '@/lib/newSetlist';
import { buildOrder } from '@/lib/setlistView';

const AM = { id: 'am', isTemplate: true, templateName: 'Sunday Morning', weekday: 0, time: '10:00', location: 'Main hall',
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

describe('services without a template', () => {
  it('reads one from the newest setlist of each service', () => {
    const setlists = [
      { id: 'a', name: 'Youth', service: 'Youth', date: '2026-10-30', time: '19:00', rehearsalDate: '2026-10-29', rehearsalTime: '18:00', items: [{ type: 'break', label: 'Games' }, { songId: 's1' }] },
      AM,
    ];
    const [y] = serviceTemplates(setlists);
    expect(y.templateName).toBe('Youth');
    expect(y.weekday).toBe(5);
    expect(y.rehearsalOffset).toBe(1);
    expect(y.items).toEqual([{ type: 'break', label: 'Games' }]);
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
