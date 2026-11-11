// @vitest-environment jsdom
// QA 11 Nov: a song the library didn't have meant leaving the setlist. New song
// (Import a file / Paste the song) adds it to Songs, tagged "To check", and to
// the setlist, without leaving it.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { songFromPaste } from '@/lib/importFiles';
import { TO_CHECK } from '@/lib/importCheck';
import NewSongSheet from '@/features/setlist/NewSongSheet';

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

describe('NewSongSheet', () => {
  it('pastes a song with the search words as the title, tagged To check', () => {
    const onCreate = vi.fn();
    render(<NewSongSheet open onOpenChange={() => {}} initialTitle="Amazing Grace" onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: /Paste the song/ }));
    expect(screen.getByLabelText('Song title').value).toBe('Amazing Grace');
    fireEvent.change(screen.getByLabelText('The song'), { target: { value: PASTED } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to setlist' }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    const [list] = onCreate.mock.calls[0];
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Amazing Grace');
    expect(list[0].tags).toContain(TO_CHECK);
  });
});
