import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, navItemFor } from '@/app/navItems';

describe('nav pill', () => {
  it('has Home, Setlists, Songs in that order', () => {
    expect(NAV_ITEMS.map(i => i.id)).toEqual(['home', 'setlists', 'songs']);
  });
  it('lights Setlists for every setlist screen, Home for Schedule', () => {
    for (const v of ['setlists', 'setlist-view', 'setlist-build']) expect(navItemFor(v)).toBe('setlists');
    for (const v of ['home', 'schedule', 'scheduling']) expect(navItemFor(v)).toBe('home');
    for (const v of ['library', 'song-hub']) expect(navItemFor(v)).toBe('songs');
    expect(navItemFor('settings')).toBe(null);
  });
});
