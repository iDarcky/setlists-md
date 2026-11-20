import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { parseSongMd } from '@/parser';
import Song from '@/features/song/Song';
import { SongAbout } from '@/features/song/SongAbout';

// The song page (owner, 2026-11-20): facts once, no notes on the page, About
// shows only what is filled in, one labelled Practice.

const MD = `---
title: Amazing Grace
artist: John Newton
key: G
tempo: 72
time: 3/4
writers: John Newton
notes: Soft start, piano only.
---

## Verse 1
> Piano only
[G]Amazing grace, how [C]sweet {!hold} the [G]sound
`;
const song = () => ({ ...parseSongMd(MD), id: 's1' });

describe('Song page', () => {
  it('says the key and tempo once, and shows no notes or cues on the chart', () => {
    render(<Song song={song()} settings={{}} layout="phone" />);
    expect(screen.getAllByRole('button', { name: /^Key G/ })).toHaveLength(1);
    expect(screen.getAllByText('72 BPM')).toHaveLength(1);
    expect(screen.queryByText('Piano only')).toBeNull();
    expect(screen.queryByText('hold')).toBeNull();
    expect(screen.queryByText(/Soft start/)).toBeNull();
  });

  it('Practice opens the reader in practice mode, with the notes and the switches', () => {
    render(<Song song={song()} settings={{}} layout="phone" />);
    fireEvent.click(screen.getByRole('button', { name: 'Practice' }));
    const reader = screen.getByRole('dialog', { name: /full screen/ });
    expect(within(reader).queryByText('Live')).toBeNull();
    expect(within(reader).getByText(/Soft start/)).toBeTruthy();
    fireEvent.click(within(reader).getByRole('button', { name: 'Notes' }));
    expect(within(reader).queryByText(/Soft start/)).toBeNull();
  });

  it('a leader with no chart gets Paste and Write, which open the editor', () => {
    const onEdit = vi.fn();
    render(<Song song={{ ...parseSongMd('---\ntitle: New\nkey: D\n---\n'), id: 's2' }} settings={{}} layout="phone" onEdit={onEdit} />);
    expect(screen.queryByRole('button', { name: 'Practice' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Write it/ }));
    expect(onEdit).toHaveBeenCalledWith(undefined, { mode: 'write' });
  });

  it('a member with no chart gets a sentence, not the tiles', () => {
    render(<Song song={{ ...parseSongMd('---\ntitle: New\nkey: D\n---\n'), id: 's3' }} settings={{}} layout="phone" />);
    expect(screen.getByText(/No chart yet/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Write it/ })).toBeNull();
  });
});

describe('About', () => {
  const facts = { plays: 6, last: '9 Nov', usualKey: 'G', usualTempo: 72 };
  it('shows how it is played, and leaves out what is empty', () => {
    render(<SongAbout song={{ writers: 'John Newton' }} facts={facts} arrangements={[{ id: 'a', name: 'Main', key: 'G' }]} leader={false} />);
    expect(screen.getByText('6 times')).toBeTruthy();
    expect(screen.getByText('72 BPM')).toBeTruthy();
    expect(screen.getByText('John Newton')).toBeTruthy();
    expect(screen.queryByText('Publishers')).toBeNull();
    expect(screen.queryByText('Links')).toBeNull();
    // One arrangement is already the header.
    expect(screen.queryByText('Arrangements')).toBeNull();
  });
  it('says so when there is nothing', () => {
    render(<SongAbout song={{}} facts={{ plays: 0, last: null, usualKey: '' }} arrangements={[]} leader />);
    expect(screen.getByText(/Nothing here yet/)).toBeTruthy();
  });
});
