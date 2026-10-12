// Element 9's collapse, on the thing that made it a no-op.
//
// ⚠ `myInstrument` is ASYNCHRONOUS. It is resolved in App from `schedules`,
// `members` and `teamSetlistMap` — all of which arrive from Supabase after the
// first paint — so the first render of every tab in the app happens with NO
// answer: `collapsible: false`, `defaultOpen: true`. `TabBlock` read that
// prop into `useState` once and never looked again, so by the time the band
// data landed the state was frozen open and element 9 did nothing at all, for
// everyone, silently. Nothing throws when a component stops listening to a
// prop; only a rerender test says so.
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TabBlock from '@/features/chart/TabBlock';

const tab = (instrument) => ({
  type: 'tab',
  instrument,
  strings: [
    { note: 'e', content: '--3--5--7--' },
    { note: 'B', content: '--3--5--7--' },
    { note: 'G', content: '--4--5--7--' },
  ],
});

const isOpen = () => screen.getByRole('button').getAttribute('aria-expanded') === 'true';

describe('a tab follows the answer, not the first paint', () => {
  it('collapses when the band data lands after mount', () => {
    // Exactly the app's real order: no answer, then an answer.
    const { rerender } = render(
      <TabBlock data={tab('electric')} collapsible={false} defaultOpen />
    );
    rerender(<TabBlock data={tab('electric')} collapsible defaultOpen={false} />);
    expect(isOpen()).toBe(false);
  });

  it('opens the one that IS mine when the answer changes to it', () => {
    const { rerender } = render(
      <TabBlock data={tab('acoustic')} collapsible defaultOpen={false} />
    );
    expect(isOpen()).toBe(false);
    // The ☰'s "Your instrument" pick, changed mid-song to Acoustic.
    rerender(<TabBlock data={tab('acoustic')} collapsible defaultOpen />);
    expect(isOpen()).toBe(true);
  });

  it('still lets me open a tab that is not mine, and keeps it open', () => {
    const { rerender } = render(
      <TabBlock data={tab('electric')} collapsible defaultOpen={false} />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(isOpen()).toBe(true);
    // An unrelated rerender must not slam it shut again — the tap outlives
    // re-renders that do not change the answer.
    rerender(<TabBlock data={tab('electric')} collapsible defaultOpen={false} scale={1.2} />);
    expect(isOpen()).toBe(true);
  });

  // ⚠ Deliberate: a NEW answer clears your tap. You opened the electric tab
  // while the app thought you were on bass; if you then say "I'm on electric",
  // every tab should be re-decided by that, not keep a choice you made under
  // the old answer.
  it('re-decides from scratch when the answer itself changes', () => {
    const { rerender } = render(
      <TabBlock data={tab('electric')} collapsible defaultOpen={false} />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(isOpen()).toBe(true);
    rerender(<TabBlock data={tab('electric')} collapsible defaultOpen />);
    expect(isOpen()).toBe(true);
    rerender(<TabBlock data={tab('electric')} collapsible defaultOpen={false} />);
    expect(isOpen()).toBe(false);
  });

  it('has no toggle at all when we do not know what you play', () => {
    render(<TabBlock data={tab('electric')} collapsible={false} defaultOpen />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  // The stored value is an id. "electric tab" is a key leaking into a sentence.
  it('names the instrument, not its id', () => {
    render(<TabBlock data={tab('electric')} collapsible defaultOpen={false} />);
    expect(screen.getByRole('button').textContent).toContain('Electric tab');
  });
});
