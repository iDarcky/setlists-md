import { useMemo } from 'react';

const HEADING_RE = /^(#{1,2})\s+(.*)$/;

function parseBlocks(text) {
  const blocks = [];
  const paragraphs = text.split(/\n{2,}/);
  for (const para of paragraphs) {
    const trimmed = para.replace(/\n+$/, '');
    if (!trimmed.trim()) continue;
    const lines = trimmed.split('\n');
    const buf = [];
    const flush = () => {
      if (buf.length) {
        blocks.push({ kind: 'p', text: buf.join('\n') });
        buf.length = 0;
      }
    };
    for (const line of lines) {
      const m = line.match(HEADING_RE);
      if (m) {
        flush();
        blocks.push({ kind: m[1].length === 1 ? 'h1' : 'h2', text: m[2] });
      } else {
        buf.push(line);
      }
    }
    flush();
  }
  return blocks;
}

export default function NoteContent({ text, className = '' }) {
  const blocks = useMemo(() => (text ? parseBlocks(text) : []), [text]);
  if (!blocks.length) return null;
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.kind === 'h1') {
          return (
            <h1 key={i} className="text-heading-24 font-semibold text-[var(--ds-gray-1000)] m-0 mt-3 first:mt-0 mb-2">
              {b.text}
            </h1>
          );
        }
        if (b.kind === 'h2') {
          return (
            <h2 key={i} className="text-heading-18 font-semibold text-[var(--ds-gray-1000)] m-0 mt-3 first:mt-0 mb-1.5">
              {b.text}
            </h2>
          );
        }
        return (
          <p key={i} className="m-0 mb-2 last:mb-0 whitespace-pre-wrap leading-relaxed">
            {b.text}
          </p>
        );
      })}
    </div>
  );
}
