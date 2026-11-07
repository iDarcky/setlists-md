import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Reader from '@/features/reader/Reader';
import { songFromFlat } from '@/arrangements';
import { parseSongMd } from '@/parser';

vi.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => ({ allowed: true, requiredPlan: 'free', currentPlan: 'free' }),
  checkEntitlement: () => true,
}));
if (!window.matchMedia) window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

const song = () => songFromFlat({ ...parseSongMd('---\ntitle: T\nkey: C\n---\n## Verse 1\n[C]Hello\n'), id: 's1' });
const dot = () => screen.getByRole('button', { name: 'Display options' }).querySelector('span.rounded-full');
const fill = (c) => [...c.querySelectorAll('div')].find(d => d.style.width === '40%');

describe('live: a red dot on the ☰', () => {
  it('marks live on the menu button and leaves the setlist timeline alone', () => {
    const { container } = render(<Reader song={song()} settings={{}} mode="live" progress={40} onExit={() => {}} />);
    expect(dot()).not.toBeNull();
    expect(fill(container).style.background).not.toContain('229, 72, 77');
  });

  it('has no dot off-live', () => {
    render(<Reader song={song()} settings={{}} mode="practice" progress={40} onExit={() => {}} />);
    expect(dot()).toBeNull();
  });
});
