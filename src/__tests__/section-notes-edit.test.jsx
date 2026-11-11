// QA 11 Nov: "how can I edit an existing note?" Only the GUTTER note listened
// for a tap; above/below notes could be written and never changed. And a long
// note with no spaces ran out of its column over the chart.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SectionBlock from '@/features/chart/SectionBlock';

const section = { type: 'Chorus', lines: ['[G]Sing it {!softer here}', 'Plain line {!asdasdasdasdasdasdasdasdasd}'] };

describe('editing an existing note', () => {
  for (const placement of ['above', 'below', 'gutter']) {
    it(`reopens a ${placement} note on tap while editing`, () => {
      const onNoteOpen = vi.fn();
      render(<SectionBlock section={section} transpose={0} notePlacement={placement}
        onNoteOpen={onNoteOpen} noteHint />);
      fireEvent.click(screen.getAllByRole('button', { name: /softer here/ })[0]);
      expect(onNoteOpen).toHaveBeenCalledWith(0, 'softer here');
    });
  }

  it('is not a button while reading', () => {
    render(<SectionBlock section={section} transpose={0} notePlacement="above" />);
    expect(screen.queryByRole('button', { name: /softer here/ })).toBeNull();
  });

  it('breaks a long note anywhere instead of overflowing', () => {
    render(<SectionBlock section={section} transpose={0} notePlacement="above" />);
    const note = screen.getByText(/asdasdasd/).closest('div');
    expect(note.style.overflowWrap).toBe('anywhere');
  });
});
