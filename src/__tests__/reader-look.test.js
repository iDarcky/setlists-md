import { describe, it, expect } from 'vitest';
import { applyReaderLook, READER_LOOK_FLAG } from '@/lib/readerLook';

describe('applyReaderLook', () => {
  it('moves the old default themes and the name heading to the new look, once', () => {
    for (const chartTheme of [undefined, 'sunday-light', 'stage-black', 'midnight']) {
      const out = applyReaderLook({ chartTheme, readerHeading: 'name' });
      expect(out.chartTheme).toBe('warm');
      expect(out.readerHeading).toBe('chip');
      expect(out[READER_LOOK_FLAG]).toBe(true);
    }
  });

  it('keeps a theme or heading somebody picked on purpose', () => {
    const out = applyReaderLook({ chartTheme: 'sepia', readerHeading: 'caps' });
    expect(out.chartTheme).toBe('sepia');
    expect(out.readerHeading).toBe('caps');
    expect(out[READER_LOOK_FLAG]).toBe(true);
  });

  it('does nothing the second time', () => {
    const once = applyReaderLook({ chartTheme: 'midnight' });
    const back = { ...once, chartTheme: 'midnight' };
    expect(applyReaderLook(back)).toBe(back);
  });
});
