import { splitChord } from './lines';

/** A chord with its extension raised: G⁷, Dsus⁴/F♯ (owner, 2026-11-17). */
export function Chord({ name }: { name: string }) {
  const [root, ext, bass] = splitChord(name);
  return (
    <>
      {root}
      {ext && <sup className="ml-px text-[0.72em] font-semibold">{ext}</sup>}
      {bass}
    </>
  );
}
