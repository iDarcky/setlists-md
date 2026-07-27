import { describe, it, expect } from 'vitest';
import {
  buildTitleIndex,
  matchSongByTitle,
  classifyItem,
  analyzeSetlistLinks,
  healSetlistLinks,
} from '@/setlist/setlistLinks';
import { songFromFlat } from '@/arrangements';

function song({ id, title, key = 'G' }) {
  return songFromFlat({ id, title, artist: 'A', key, tempo: 120, time: '4/4', sections: [] });
}

const apaVie = song({ id: 'new1', title: 'Apă vie' });
const lauda = song({ id: 'new2', title: 'Laudă' });
const songs = [apaVie, lauda];

function setlist(items) {
  return { id: 'sl1', name: 'Sunday', date: '2026-06-01', items };
}

describe('matchSongByTitle', () => {
  it('matches folding diacritics/punctuation', () => {
    expect(matchSongByTitle(songs, 'apa vie')?.id).toBe('new1');
    expect(matchSongByTitle(songs, 'Lauda')?.id).toBe('new2');
  });
  it('returns null for unknown titles and empty input', () => {
    expect(matchSongByTitle(songs, 'Unknown')).toBe(null);
    expect(matchSongByTitle(songs, '')).toBe(null);
  });
  it('does not match an ambiguous (duplicate) title', () => {
    const dup = [song({ id: 'a', title: 'Same' }), song({ id: 'b', title: 'Same' })];
    expect(matchSongByTitle(dup, 'Same')).toBe(null);
  });
});

describe('classifyItem', () => {
  const byId = new Map(songs.map(s => [s.id, s]));
  const idx = buildTitleIndex(songs);
  it('linked when songId resolves', () => {
    expect(classifyItem({ songId: 'new1', songTitle: 'Apă vie' }, byId, idx)).toBe('linked');
  });
  it('relinkable when songId missing but title matches', () => {
    expect(classifyItem({ songId: 'old', songTitle: 'Apă vie' }, byId, idx)).toBe('relinkable');
  });
  it('missing when title present but no song', () => {
    expect(classifyItem({ songId: 'old', songTitle: 'Ghost song' }, byId, idx)).toBe('missing');
  });
  it('untitled when no songId match and no title', () => {
    expect(classifyItem({ songId: 'old' }, byId, idx)).toBe('untitled');
  });
  it('break items are classified as break', () => {
    expect(classifyItem({ type: 'break' }, byId, idx)).toBe('break');
  });
});

describe('analyzeSetlistLinks', () => {
  it('counts every bucket, ignoring breaks', () => {
    const sls = [setlist([
      { songId: 'new1', songTitle: 'Apă vie' },        // linked
      { songId: 'old', songTitle: 'Laudă' },           // relinkable
      { songId: 'old', songTitle: 'Ghost' },           // missing
      { songId: 'old' },                               // untitled
      { type: 'break', label: 'Prayer' },              // ignored
    ])];
    const { counts, relinkable, missing, untitled } = analyzeSetlistLinks(sls, songs);
    expect(counts).toEqual({ total: 4, linked: 1, relinkable: 1, missing: 1, untitled: 1 });
    expect(relinkable[0].title).toBe('Laudă');
    expect(missing[0].title).toBe('Ghost');
    expect(untitled[0].songId).toBe('old');
  });
});

describe('healSetlistLinks', () => {
  it('re-links an orphaned item by title and stamps arrangement', () => {
    const sls = [setlist([{ songId: 'stale', songTitle: 'Apă vie', transpose: 2, capo: 1 }])];
    const { setlists, relinked, backfilled } = healSetlistLinks(sls, songs);
    expect(relinked).toBe(1);
    expect(backfilled).toBe(0);
    const item = setlists[0].items[0];
    expect(item.songId).toBe('new1');
    expect(item.arrangementId).toBe(apaVie.defaultArrangementId);
    expect(item.transpose).toBe(2); // preserves other fields
    expect(item.capo).toBe(1);
  });

  it('backfills a missing songTitle when songId still resolves', () => {
    const sls = [setlist([{ songId: 'new1' }])];
    const { setlists, relinked, backfilled } = healSetlistLinks(sls, songs);
    expect(backfilled).toBe(1);
    expect(relinked).toBe(0);
    expect(setlists[0].items[0].songTitle).toBe('Apă vie');
  });

  it('leaves missing/untitled items untouched', () => {
    const sls = [setlist([{ songId: 'old', songTitle: 'Ghost' }, { songId: 'old' }])];
    const { setlists, relinked, backfilled } = healSetlistLinks(sls, songs);
    expect(relinked).toBe(0);
    expect(backfilled).toBe(0);
    expect(setlists).toBe(sls); // reference-preserving: no change → same array
  });

  it('is reference-preserving for unchanged setlists', () => {
    const clean = setlist([{ songId: 'new1', songTitle: 'Apă vie' }]);
    const dirty = setlist([{ songId: 'stale', songTitle: 'Laudă' }]);
    const input = [clean, dirty];
    const { setlists } = healSetlistLinks(input, songs);
    expect(setlists).not.toBe(input);       // array changed
    expect(setlists[0]).toBe(clean);        // untouched setlist keeps identity
    expect(setlists[1]).not.toBe(dirty);    // healed setlist is a new object
  });

  it('does not re-link to an ambiguous duplicate title', () => {
    const dupSongs = [song({ id: 'a', title: 'Same' }), song({ id: 'b', title: 'Same' })];
    const sls = [setlist([{ songId: 'old', songTitle: 'Same' }])];
    const { relinked, setlists } = healSetlistLinks(sls, dupSongs);
    expect(relinked).toBe(0);
    expect(setlists).toBe(sls);
  });

  it('handles empty inputs', () => {
    expect(healSetlistLinks([], []).setlists).toEqual([]);
    expect(healSetlistLinks(undefined, undefined).relinked).toBe(0);
  });
});
