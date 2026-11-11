import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportReviewSheet } from '@/features/songs/ImportSheets';

const song = (id, sections) => ({ id, title: id, arrangements: [{ id: `a-${id}`, key: 'Bb', sections }] });
const melodia = song('Doamne', [
  { type: 'Verse 1', lines: ['[Bb]Isus îmi spune azi:'] },
  { type: 'Verse 2', lines: ['Isuse, eu acum'] },
]);
const full = song('Full', [{ type: 'Verse 1', lines: ['[G]a'] }, { type: 'Verse 2', lines: ['[C]b'] }]);

const sheet = (items, onAdd) => render(<ImportReviewSheet open items={items} onAdd={onAdd} onOpenChange={() => {}} />);

describe('ImportReviewSheet — verse 1 chords', () => {
  it('carries verse 1 chords to bare verses by default', () => {
    const onAdd = vi.fn();
    sheet([{ song: melodia }], onAdd);
    expect(screen.getByText(/1 song has chords on verse 1 only/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add song' }));
    expect(onAdd.mock.calls[0][0][0].arrangements[0].sections[1].lines[0]).toBe('[Bb]Isuse, eu acum');
  });

  it('adds the songs as they are when switched off', () => {
    const onAdd = vi.fn();
    sheet([{ song: melodia }], onAdd);
    fireEvent.click(screen.getByRole('button', { name: /Add verse 1’s chords/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add song' }));
    expect(onAdd.mock.calls[0][0][0]).toBe(melodia);
  });

  it('does not offer it when no song needs it', () => {
    sheet([{ song: full }], vi.fn());
    expect(screen.queryByText(/chords on verse 1 only/)).toBeNull();
  });
});
