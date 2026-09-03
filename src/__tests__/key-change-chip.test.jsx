// The key-change chip with a capo on — both keys, in the right order.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SectionBlock from '@/features/chart/SectionBlock';

const section = {
  type: 'Chorus',
  note: '',
  lines: [{ type: 'modulate', semitones: 2 }, '[C]after'],
};

// Song in C. `transpose` is the CHART's (capo already subtracted);
// `keyTranspose` is the SOUNDING one.
const chip = ({ transpose, keyTranspose }) => {
  const { container } = render(
    <SectionBlock section={section} songKey="C" transpose={transpose} keyTranspose={keyTranspose} />
  );
  const el = [...container.querySelectorAll('span')].find(s => s.textContent.startsWith('↗'));
  return el ? el.textContent : null;
};

describe('the key-change chip', () => {
  it('names one key when there is no capo', () => {
    expect(chip({ transpose: 0, keyTranspose: 0 })).toBe('↗D');
  });

  // ⚠ Owner, 2026-08-21: *"we need to do something like ↗ D (E) or show the key
  // that you're supposed to play."* With a capo on, two things are true at
  // once: the band arrives in D and your hands arrive in C. The first cut of
  // this said only the shape key, the second only the sounding key, and each
  // was half an answer.
  it('names both when a capo makes them differ — sounding first, shapes bracketed', () => {
    // capo 2 → chart renders 2 semitones down from sounding.
    expect(chip({ transpose: -2, keyTranspose: 0 })).toBe('↗D(C)');
  });

  it('brackets nothing when there is no capo, at any transpose', () => {
    // Sounding Bb (C down 2), no capo, lifting +2 → back to C. One key, no
    // bracket: the guitarist's hands and the band are in the same place.
    expect(chip({ transpose: -2, keyTranspose: -2 })).toBe('↗C');
  });
});
