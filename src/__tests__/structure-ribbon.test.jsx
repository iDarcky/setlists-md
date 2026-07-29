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
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
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
