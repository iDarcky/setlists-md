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

  // The target and the chip are two different boxes (owner asked to try it,
  // 2026-08-05). 29x21px is the right SIZE for chrome and a poor TARGET for a
  // thumb in the dark, so the `::after` grows what the browser hit-tests
  // without moving a pixel of what you see.
  it('every tappable chip carries a hit area bigger than itself', () => {
    for (const style of ['codes', 'chips', 'numbered', 'dots', 'dotlabel']) {
      const { container, unmount } = render(
        <StructureRibbon structure={structure} style={style} activeIndex={0} activeFill onSelect={() => {}} />
      );
      for (const b of container.querySelectorAll('button')) {
        expect(b.className).toContain('after:absolute');
        // `relative`, or the pseudo-element positions against the page.
        expect(b.className).toContain('relative');
      }
      unmount();
    }
  });

  it('a chip that does nothing has no hit area to grow', () => {
    const { container } = render(<StructureRibbon structure={structure} style="codes" />);
    expect(container.innerHTML).not.toContain('after:absolute');
  });

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

// ── The ends of a long strip ────────────────────────────────────────────────
//
// Owner, 2026-08-05: "Let's do a fade I think." A twelve-section song on a
// 390px phone shows eleven chips and clips the twelfth flush against the
// header's `overflow-hidden` — with the scrollbar hidden (`no-scrollbar`) that
// looks exactly like a song with eleven sections.
describe('the edges say there is more', () => {
  const withOverflow = (fn) => {
    // jsdom reports 0 for both, so nothing ever overflows. Fake the one fact
    // the component reads.
    // The descriptors live on Element, not HTMLElement.
    const saved = ['scrollWidth', 'clientWidth'].map(
      k => [k, Object.getOwnPropertyDescriptor(Element.prototype, k)]);
    Object.defineProperty(Element.prototype, 'scrollWidth', { configurable: true, value: 600 });
    Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, value: 300 });
    try { fn(); } finally {
      for (const [k, d] of saved) {
        if (d) Object.defineProperty(Element.prototype, k, d);
        else delete Element.prototype[k];
      }
    }
  };
  const fades = (container) => container.querySelectorAll('span[aria-hidden="true"][class*="absolute"]');

  it('fades the end you have not reached, and only that one', () => {
    withOverflow(() => {
      const { container } = render(
        <StructureRibbon structure={structure} style="codes" activeIndex={0} activeFill edgeFade onSelect={() => {}} />
      );
      const marks = fades(container);
      // At rest the strip is scrolled to 0: there is more to the RIGHT and
      // nothing to the left. A fade on an end you have already reached is the
      // same lie in the other direction.
      expect(marks).toHaveLength(1);
      expect(marks[0].className).toContain('right-0');
      // It fades to the paper the ribbon sits on, and it is a longhand:
      // jsdom's shorthand parser throws on some gradients inside `cloneNode`,
      // which Testing Library does for every role query.
      expect(marks[0].style.backgroundImage).toContain('var(--chart-bg');
      expect(marks[0].style.background).toBe('');
    });
  });

  it('is opt-in — a setlist card would fade to the wrong colour', () => {
    withOverflow(() => {
      const { container } = render(
        <StructureRibbon structure={structure} style="codes" activeIndex={0} onSelect={() => {}} />
      );
      expect(fades(container)).toHaveLength(0);
    });
  });

  it('never fades the wrapping ribbon — edit mode has no ends to run off', () => {
    withOverflow(() => {
      const { container } = render(
        <StructureRibbon structure={structure} style="codes" activeIndex={0} edgeFade
          onSelect={null} onReorder={() => {}} />
      );
      expect(fades(container)).toHaveLength(0);
    });
  });
});
