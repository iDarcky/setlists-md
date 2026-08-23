// The Romanian stray dot.
//
// A ț (U+021B) and a ș (U+0219) carry a real descender COMMA, and in Geist that
// comma's ink sits BELOW the line box at ordinary reader settings. Measured
// from the font's own metrics:
//
//   18px / 1.35  →   0.65px of clearance   ← the DEFAULT, under a pixel
//   18px / 1.25  →  −0.25px                ← ink is outside the box
//   24px / 1.25  →  −0.50px
//   18px / 1.00  →  −2.50px                ← "Line spacing" goes down to 100%
//
// A section's border box ends at its last line's box, so that ink hangs below
// the section. `break-inside: avoid` keeps the BOX inside one column; it has
// never had anything to say about ink outside the box. In the taller column of
// a balanced pair the bottom margin is truncated at the break, so the column
// ends exactly at that border box — and WebKit paints the overhang at the top
// of the NEXT COLUMN. That is the dot: a comma alone above the next section's
// heading, at the same x-offset as the word it fell off.
//
// ⚠ This is the SECOND mechanism. 76d713d fixed the first — the line box itself
// fragmenting at the column boundary — and its `break-inside: avoid` is still
// right and still needed. Fixing one and calling the bug closed is how it came
// back, so both are pinned here.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SectionBlock from '@/features/chart/SectionBlock';

const section = {
  type: 'Chorus',
  lines: ['O, da, viață ne-ai dăruit!'],
};

const sectionRoot = (container) => container.querySelector('.break-inside-avoid');

describe('room for the ink under the last line', () => {
  it('the section reserves padding under itself', () => {
    const { container } = render(<SectionBlock section={section} transpose={0} />);
    const style = sectionRoot(container).getAttribute('style');
    // Sized from the same two variables the shortfall is, so it tracks the
    // lyric size and the line spacing instead of guessing one number for all
    // of them — and floored, because the default's sub-pixel clearance is one
    // rounding away from zero.
    expect(style).toContain('--chart-ink-slack');
    expect(style).toMatch(/padding-bottom:\s*var\(--chart-ink-slack\)/);
    expect(style).toMatch(/max\(2px,/);
  });

  // ⚠ THE REASON THIS SURVIVES REVIEW. The gap between two sections is the
  // "Between sections" setting, and a fix that silently added 2px to every gap
  // in the app would be reverted on sight — the previous two attempts were.
  // The padding comes OUT of the margin, so ink-to-ink spacing is unchanged and
  // only the border box grows.
  it('and takes it back out of the margin, so nothing moves', () => {
    const { container } = render(<SectionBlock section={section} transpose={0} />);
    const style = sectionRoot(container).getAttribute('style');
    expect(style).toMatch(/margin-bottom:\s*max\(0px,\s*calc\(var\(--chart-section-gap, 24px\) - var\(--chart-ink-slack\)\)\)/);
  });

  // ⚠ NOT on the line row. That was the attempt that was reverted: padding on
  // the row with a matching negative margin on the row. A section's height is
  // set by its last child's MARGIN box, so the negative margin pulled the
  // section's bottom edge back up and the box never actually grew. The
  // section's own bottom margin is external — it collapses out of the border
  // box — which is the only reason borrowing from it works.
  it('is on the section, not on the line', () => {
    const { container } = render(<SectionBlock section={section} transpose={0} />);
    const root = sectionRoot(container);
    const rows = [...root.querySelectorAll('div')].filter(d => (d.getAttribute('style') || '').includes('break-inside'));
    for (const row of rows) {
      expect(row.getAttribute('style')).not.toMatch(/margin-bottom:\s*-/);
    }
  });

  // The first mechanism, still pinned. A rendered line is a chord row over a
  // lyric row; free to fragment, it left the comma behind on its own.
  it('and the line box still may not fragment', () => {
    const { container } = render(<SectionBlock section={section} transpose={0} />);
    const rows = [...sectionRoot(container).querySelectorAll('div')]
      .filter(d => (d.getAttribute('style') || '').includes('break-inside'));
    expect(rows.length).toBeGreaterThan(0);
  });
});
