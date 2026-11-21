import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Songs from '@/features/songs/Songs';

// The + on Songs opens the same menu as Home's (New song, Import PDFs, New
// setlist), and each row opens its own sheet; there is no Add a song chooser.

const SONGS = [{ id: 's1', title: 'Oceans', artist: 'Hillsong United', arrangements: [{ id: 'a', key: 'D', sections: [] }] }];

describe('Songs + menu', () => {
  const setup = (props = {}) => render(
    <Songs songs={SONGS} onImportSongs={vi.fn()} onBlank={vi.fn()} onNewSetlist={vi.fn()} {...props} />,
  );

  it('lists New song, Import PDFs and New setlist', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getAllByRole('menuitem').map(el => el.textContent)).toEqual(['New song', 'Import PDFs', 'New setlist']);
  });

  it('New song opens the details straight away', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'New song' }));
    expect(screen.getByRole('button', { name: 'Next: Chart' })).toBeInTheDocument();
    expect(screen.queryByText('Add a song')).toBeNull();
  });

  it('Import PDFs on a phone opens a sheet with Choose files and no drop zone', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Import PDFs' }));
    expect(screen.getByRole('button', { name: 'Choose files' })).toBeInTheDocument();
    expect(screen.queryByText('Drop files here')).toBeNull();
  });

  it('New setlist calls through', () => {
    const onNewSetlist = vi.fn();
    setup({ onNewSetlist });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'New setlist' }));
    expect(onNewSetlist).toHaveBeenCalled();
  });

  it('members get no +', () => {
    setup({ readOnly: true });
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull();
  });
});
