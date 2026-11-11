import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SongEdit from '@/features/song-edit/SongEdit';
import { songFromFlat } from '@/arrangements';

vi.mock('@/auth/useTeam', () => ({ useTeam: () => ({ team: null, members: [], isAdmin: true }) }));

beforeEach(() => { vi.spyOn(window, 'confirm').mockReturnValue(true); });

const melodia = () => songFromFlat({
  id: 's1', title: 'Doamne', artist: 'x', key: 'Bb',
  sections: [
    { type: 'Verse 1', lines: ['[Bb]Isus îmi spune azi:'] },
    { type: 'Verse 2', lines: ['Isuse, eu acum'] },
  ],
});

describe('SongEdit — copy verse 1 chords', () => {
  it('offers it in the ⋯ menu and the saved song carries the chords', async () => {
    const onSave = vi.fn();
    render(<SongEdit song={melodia()} mode="import" onSave={onSave} onBack={() => {}} layout="phone" />);
    fireEvent.click(screen.getByRole('button', { name: 'More ways to edit' }));
    fireEvent.click(await screen.findByRole('button', { name: /Copy verse 1 chords/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[0][0];
    expect(saved.arrangements[0].sections[1].lines[0]).toBe('[Bb]Isuse, eu acum');
  });

  it('is not offered when every verse has chords', async () => {
    const song = songFromFlat({ id: 's2', title: 'Full', artist: 'x', key: 'G', sections: [{ type: 'Verse 1', lines: ['[G]a'] }, { type: 'Verse 2', lines: ['[C]b'] }] });
    render(<SongEdit song={song} mode="edit" onSave={() => {}} onBack={() => {}} layout="phone" />);
    fireEvent.click(screen.getByRole('button', { name: 'More ways to edit' }));
    await screen.findByRole('button', { name: /Edit all as text/ });
    expect(screen.queryByRole('button', { name: /Copy verse 1 chords/ })).toBeNull();
  });
});
