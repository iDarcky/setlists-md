// @vitest-environment jsdom
// QA 11 Nov: a song the library didn't have meant leaving the setlist. New song
// (Import a file / Paste the song) adds it to Songs, tagged "To check", and to
// the setlist, without leaving it.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { songFromPaste } from '@/lib/importFiles';
import SetlistFlow from '@/features/setlist/SetlistFlow';

const PASTED = `Verse 1
G         C
Amazing grace, how sweet the sound

Chorus
D       G
My chains are gone`;

describe('songFromPaste', () => {
  it('finds the sections and keeps the title it was given', () => {
    const song = songFromPaste('Amazing Grace', PASTED);
    expect(song.title).toBe('Amazing Grace');
    expect(song.id).toBeTruthy();
    const sections = song.arrangements[0].sections.map(s => s.type);
    expect(sections).toEqual(['Verse 1', 'Chorus 1']);
    const verse = song.arrangements[0].sections.find(s => s.type === 'Verse 1');
    expect(verse.lines.join('\n')).toMatch(/\[G\]/);
  });

  it('is null with nothing to add', () => {
    expect(songFromPaste('', '   ')).toBeNull();
  });
});

describe('Setlist: a song the library does not have', () => {
  const setup = (onCreateSongs = vi.fn(list => list)) => {
    const setlist = { id: 'sl1', name: 'Sunday, 23 Nov', date: '2026-11-23', items: [{ songId: 's1', songTitle: 'Amazing Grace' }] };
    render(<SetlistFlow setlist={setlist} songs={[{ id: 's1', title: 'Amazing Grace', arrangements: [{ id: 'a', key: 'G', sections: [] }] }]}
      initialStep="songs" onSave={() => {}} onCancel={() => {}} onCreateSongs={onCreateSongs} />);
    fireEvent.change(screen.getByPlaceholderText('Search the library'), { target: { value: 'Oceans' } });
    return onCreateSongs;
  };
  it('offers New song "Oceans", Import PDFs and a slot', () => {
    setup();
    expect(screen.getByText('No song called “Oceans” yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New song “Oceans”' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import PDFs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep a “Oceans” slot, choose later' })).toBeInTheDocument();
  });
  it('New song opens the same details sheet, named, saying where it goes', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'New song “Oceans”' }));
    expect(screen.getAllByDisplayValue('Oceans')).toHaveLength(2); // the search, and the sheet's Name
    expect(screen.getByText(/It goes into Songs and into/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next: Chart' })).toBeInTheDocument();
  });
  it('a kept slot reads "Oceans · no chart yet"', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Keep a “Oceans” slot, choose later' }));
    expect(screen.getByText('· no chart yet', { exact: false })).toBeInTheDocument();
  });
});
