// The structure ribbon's chip geometry.
//
// One regression, and it is worth a file of its own: the chip renders as a
// <button> when it is tappable and as a <span> when it is not, and
// `styles/index.css` carries
//
//   @layer base { button { min-height: 36px }
//                 @media (max-width: 639px) { button { min-height: 44px } } }
//
// so the SAME component came out ~21px tall in a setlist card and 44px tall in
// the reader. That is not a padding problem and no amount of padding tuning
// reaches it — the utilities have to opt out with `min-h-0`.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { StructureRibbon } from '@/features/chart/StructureRibbon';

const structure = ['Verse 1', 'Chorus', 'Verse 2'];

describe('ribbon chips vs the global button min-height', () => {
  for (const style of ['codes', 'numbered', 'chips', 'dots', 'dotlabel']) {
    it(`${style}: every tappable chip opts out`, () => {
      const { container } = render(
        <StructureRibbon structure={structure} style={style} activeIndex={0} activeFill onSelect={() => {}} />
      );
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
      for (const b of buttons) {
        expect(b.className).toContain('min-h-0');
      }
    });
  }

  it('codes: the chip is the Score mockup — 10px mono, 2px/7px, 5px radius', () => {
    const { container } = render(
      <StructureRibbon structure={structure} style="codes" activeIndex={0} activeFill onSelect={() => {}} />
    );
    const chip = container.querySelector('button');
    expect(chip.className).toContain('text-[10px]');
    expect(chip.className).toContain('px-[7px]');
    expect(chip.className).toContain('py-[2px]');
    expect(chip.className).toContain('rounded-[5px]');
  });

  it('codes: every code keeps its section colour, and the current one fills', () => {
    // A verse and a chorus are different colours in the row, not two greys.
    const { container } = render(
      <StructureRibbon structure={structure} style="codes" activeIndex={0} activeFill onSelect={() => {}} />
    );
    const [verse1, chorus, verse2] = container.querySelectorAll('button');
    expect(verse1.style.background).toBeTruthy();          // the one you're in
    expect(chorus.style.background).toBe('transparent');
    expect(chorus.style.color).toBeTruthy();
    expect(chorus.style.color).not.toBe(verse2.style.color);
  });
});

// ── Drag to reorder ─────────────────────────────────────────────────────────
// This shipped broken TWICE. The cause was never the gesture: the effect that
// owned the gesture depended on `runs`, `runs` re-memoised every render because
// `structure` is a fresh array each time, and the effect's cleanup called
// `clearHold()` — so the 250ms timer's own `setDrag` tore down the state it had
// just created. These tests drive a whole gesture end to end so that a
// regression in the effect's lifetime fails here rather than on a phone.
describe('the song map — drag to reorder', () => {
  const structure = ['Verse 1', 'Chorus', 'Verse 2'];

  const point = (type, x, target) => {
    const ev = new window.PointerEvent(type, {
      bubbles: true, cancelable: true, clientX: x, clientY: 10, pointerId: 1,
    });
    (target || window).dispatchEvent(ev);
  };

  const renderRibbon = (onReorder) => render(
    <StructureRibbon structure={structure} collapse={false} onReorder={onReorder} />
  );

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('completes a drag and reports the move', () => {
    const onReorder = vi.fn();
    const { container } = renderRibbon(onReorder);
    const chips = container.querySelectorAll('[data-run]');
    expect(chips).toHaveLength(3);

    // Press and hold on the first chip.
    point('pointerdown', 0, chips[0]);
    act(() => { vi.advanceTimersByTime(300); });

    // Drop it on the third. `elementFromPoint` is stubbed because jsdom has no
    // layout — the gesture's bookkeeping is what these tests are about.
    document.elementFromPoint = () => chips[2];
    point('pointermove', 200);
    point('pointerup', 200);

    // from slot 0, one slot, to slot 2.
    expect(onReorder).toHaveBeenCalledWith(0, 1, 2);
  });

  it('does nothing without the hold — that gesture is a tap or a scroll', () => {
    const onReorder = vi.fn();
    const { container } = renderRibbon(onReorder);
    const chips = container.querySelectorAll('[data-run]');
    point('pointerdown', 0, chips[0]);
    // Moved before 250ms: a swipe, not a drag.
    document.elementFromPoint = () => chips[2];
    point('pointermove', 200);
    point('pointerup', 200);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('claims the horizontal axis and wraps, so the scroller cannot eat the drag', () => {
    const { container } = renderRibbon(vi.fn());
    const chip = container.querySelector('[data-run]');
    expect(chip.style.touchAction).toBe('pan-y');
    // A scrolling strip and a horizontal drag are the same gesture, and the
    // scroller wins — so a reorderable ribbon wraps instead.
    expect(chip.parentElement.className).toContain('flex-wrap');
    expect(chip.parentElement.className).not.toContain('overflow-x-auto');
  });
});
