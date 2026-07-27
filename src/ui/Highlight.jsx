import React from 'react';
import { highlightSegments } from '@/lib/search';

/**
 * Renders `text` with the parts matching `query` wrapped in <mark>. Matching is
 * diacritic-/punctuation-insensitive (see highlightSegments), so it lines up
 * with the search engine even when the typed query is unaccented.
 */
export default function Highlight({ text, query }) {
  if (!query) return <>{text ?? ''}</>;
  const segs = highlightSegments(text, query);
  return (
    <>
      {segs.map((s, i) =>
        s.hit ? (
          <mark key={i} className="bg-[var(--ds-amber-100)] text-[var(--ds-amber-1000)] rounded-[2px]">
            {s.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{s.text}</React.Fragment>
        )
      )}
    </>
  );
}
