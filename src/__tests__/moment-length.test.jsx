// The Other box on a moment's Length must keep what is typed. Typing 1 on the
// way to 12 used to set the length to 1, which lit the "1 min" chip and
// emptied the box, so 12, 25 or 15 could never be typed.
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MomentFields } from '@/features/setlist/SetlistEdit';

function Host({ start = {} }) {
  const [item, setItem] = useState({ type: 'break', label: 'Offering', ...start });
  return (
    <>
      <MomentFields item={item} onChange={p => setItem(x => ({ ...x, ...p }))} onOpenNote={() => {}} />
      <output data-testid="dur">{String(item.duration ?? '')}</output>
    </>
  );
}

const box = () => screen.getByLabelText('Other length in minutes');
const chip = (m) => screen.getByRole('button', { name: `${m} min` });
const type = (v) => fireEvent.change(box(), { target: { value: v } });

describe('moment length, Other box', () => {
  it('typing 1 then 12 keeps the digits and lights no chip', () => {
    render(<Host />);
    type('1');
    expect(box().value).toBe('1');
    expect(chip(1).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('dur').textContent).toBe('1');
    type('12');
    expect(box().value).toBe('12');
    expect(screen.getByTestId('dur').textContent).toBe('12');
  });

  it('2 → 25 and 5 → 50 work too', () => {
    render(<Host />);
    type('2'); type('25');
    expect(box().value).toBe('25');
    type(''); type('5'); type('50');
    expect(box().value).toBe('50');
    expect(screen.getByTestId('dur').textContent).toBe('50');
  });

  it('caps at 120 and clears to no length', () => {
    render(<Host />);
    type('125');
    expect(box().value).toBe('120');
    type('');
    expect(box().value).toBe('');
    expect(screen.getByTestId('dur').textContent).toBe('0');
  });

  it('tapping a chip clears the box and lights the chip', () => {
    render(<Host />);
    type('12');
    fireEvent.click(chip(5));
    expect(box().value).toBe('');
    expect(chip(5).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('dur').textContent).toBe('5');
    fireEvent.click(chip(5));
    expect(screen.getByTestId('dur').textContent).toBe('0');
  });

  it('a saved custom length shows in the box; a saved preset lights its chip', () => {
    const { unmount } = render(<Host start={{ duration: 15 }} />);
    expect(box().value).toBe('15');
    unmount();
    render(<Host start={{ duration: 10 }} />);
    expect(box().value).toBe('');
    expect(chip(10).getAttribute('aria-pressed')).toBe('true');
  });
});
