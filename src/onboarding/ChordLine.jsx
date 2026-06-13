// Parse a "[C]Hello [G]world" string into chord/lyric blocks suitable for
// stacked rendering: chord on top, lyric below. Each block represents one
// chord-segment-of-lyric pair. The first block can have chord=null when the
// line starts with lyric text before any chord.
function parseChordBlocks(line) {
  const blocks = [];
  const re = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match;
  while ((match = re.exec(line)) !== null) {
    const pre = line.slice(lastIndex, match.index);
    if (pre) {
      if (blocks.length === 0) {
        blocks.push({ chord: null, lyric: pre });
      } else {
        blocks[blocks.length - 1].lyric += pre;
      }
    }
    blocks.push({ chord: match[1], lyric: '' });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    const trail = line.slice(lastIndex);
    if (blocks.length > 0) {
      blocks[blocks.length - 1].lyric += trail;
    } else {
      blocks.push({ chord: null, lyric: trail });
    }
  }
  return blocks;
}

export default function ChordLine({ line, animateKey }) {
  const blocks = parseChordBlocks(line);
  return (
    <div className="text-copy-14" style={{ lineHeight: 1.25 }}>
      {blocks.map((b, i) => {
        // Stagger the chord pop-in by the chord's ordinal position. Counted
        // functionally (no render-time mutation) to satisfy react-hooks/immutability.
        const delay = b.chord
          ? blocks.slice(0, i).filter((x) => x.chord).length * 30
          : 0;
        return (
          <span
            key={`${animateKey ?? 0}-${i}`}
            className="inline-block align-top"
            style={{ whiteSpace: 'pre' }}
          >
            <span
              className={`block font-bold leading-tight ${b.chord ? 'sm-onboard-chord-pop' : ''}`}
              style={{
                color: 'var(--chord)',
                animationDelay: `${delay}ms`,
                minHeight: '1.2em',
                fontSize: '0.9em',
              }}
            >
              {b.chord || ' '}
            </span>
            <span className="block leading-tight text-[var(--ds-gray-900)]">
              {b.lyric || ' '}
            </span>
          </span>
        );
      })}
    </div>
  );
}
