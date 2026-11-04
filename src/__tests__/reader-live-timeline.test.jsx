import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Reader from '@/features/reader/Reader';
import { songFromFlat } from '@/arrangements';
import { parseSongMd } from '@/parser';

vi.mock('@/hooks/useEntitlement', () => ({
  useEntitlement: () => ({ allowed: true, requiredPlan: 'free', currentPlan: 'free' }),
  checkEntitlement: () => true,
}));
if (!window.matchMedia) window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });

const song = () => songFromFlat({ ...parseSongMd('---\ntitle: T\nkey: C\n---\n## Verse 1\n[C]Hello\n'), id: 's1' });
const redFill = (c) => [...c.querySelectorAll('div')].find(d => d.style.width === '40%');
const redEdge = (c) => c.querySelector('span.inset-x-0');

describe('live: the setlist timeline is the live light', () => {
  it('turns the set progress line red and draws no second edge over it', () => {
    const { container } = render(<Reader song={song()} settings={{}} mode="live" progress={40} onExit={() => {}} />);
    expect(redFill(container).style.background).toContain('229, 72, 77');
    expect(redEdge(container)).toBeNull();
  });

  it('draws the red edge when there is no setlist timeline', () => {
    const { container } = render(<Reader song={song()} settings={{}} mode="live" onExit={() => {}} />);
    expect(redEdge(container)).not.toBeNull();
  });

  it('keeps the brand colour off-live', () => {
    const { container } = render(<Reader song={song()} settings={{}} mode="practice" progress={40} onExit={() => {}} />);
    expect(redFill(container).style.background).not.toContain('229, 72, 77');
  });
});
