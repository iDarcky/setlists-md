import { useMemo, useRef, useState, useEffect } from 'react';

const STRING_SPACING = 18;
const LABEL_WIDTH = 28;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 8;
const CHAR_WIDTH = 9;
const ROW_PADDING = 16;

const DEFAULT_COLORS = {
  line: 'var(--ds-gray-400)',
  label: 'var(--ds-gray-600)',
  number: 'var(--chord)',
  bg: 'var(--ds-background-200)',
};

export default function TabBlock({ data, scale = 1, colors }) {
  const parsed = useMemo(() => parseForRender(data), [data]);
  const c = { ...DEFAULT_COLORS, ...(colors || {}) };

  // Measure the available width so the tab can wrap onto multiple rows (broken
  // at bar lines) instead of overflowing into a horizontal scroll. Until the
  // first measurement lands we render everything as a single row.
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width || 0;
      setWidth(prev => (Math.abs(prev - w) > 1 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Char budget per row in unscaled SVG units (the SVG is drawn at `scale`).
  const budgetChars = useMemo(() => {
    if (!width) return Infinity;
    const usable = width / scale - LABEL_WIDTH - ROW_PADDING;
    return Math.max(1, Math.floor(usable / CHAR_WIDTH));
  }, [width, scale]);

  const rows = useMemo(
    () => splitIntoRows(parsed, budgetChars),
    [parsed, budgetChars],
  );

  if (!parsed.strings.length) return null;

  const height = PADDING_TOP + (parsed.strings.length - 1) * STRING_SPACING + PADDING_BOTTOM;

  return (
    <div ref={containerRef} className="flex flex-col gap-2 max-w-full my-1.5">
      {rows.map((row, ri) => {
        const rowLen = row.end - row.start;
        const contentWidth = rowLen * CHAR_WIDTH;
        const totalWidth = LABEL_WIDTH + contentWidth + ROW_PADDING;
        // A row only overflows when a single bar is wider than the container;
        // allow that lone row to scroll rather than splitting mid-bar.
        return (
          <div key={ri} className="overflow-x-auto max-w-full">
            <svg
              width={totalWidth * scale}
              height={height * scale}
              viewBox={`0 0 ${totalWidth} ${height}`}
              className="block"
            >
              {/* String lines */}
              {parsed.strings.map((str, i) => {
                const y = PADDING_TOP + i * STRING_SPACING;
                return (
                  <line
                    key={`line-${i}`}
                    x1={LABEL_WIDTH}
                    y1={y}
                    x2={LABEL_WIDTH + contentWidth}
                    y2={y}
                    stroke={c.line}
                    strokeWidth={1}
                  />
                );
              })}

              {/* String labels */}
              {parsed.strings.map((str, i) => {
                const y = PADDING_TOP + i * STRING_SPACING;
                return (
                  <text
                    key={`label-${i}`}
                    x={LABEL_WIDTH - 8}
                    y={y + 4}
                    fill={c.label}
                    fontFamily="var(--fm)"
                    fontSize={11}
                    fontWeight={600}
                    textAnchor="end"
                  >
                    {str.note}
                  </text>
                );
              })}

              {/* Bar lines within this row */}
              {parsed.barPositions
                .filter(pos => pos >= row.start && pos < row.end)
                .map((pos, i) => {
                  const x = LABEL_WIDTH + (pos - row.start) * CHAR_WIDTH;
                  return (
                    <line
                      key={`bar-${i}`}
                      x1={x}
                      y1={PADDING_TOP - 4}
                      x2={x}
                      y2={PADDING_TOP + (parsed.strings.length - 1) * STRING_SPACING + 4}
                      stroke={c.line}
                      strokeWidth={1.5}
                    />
                  );
                })}

              {/* Fret numbers and techniques within this row */}
              {parsed.strings.map((str, si) => {
                const y = PADDING_TOP + si * STRING_SPACING;
                return str.frets
                  .filter(f => f.pos >= row.start && f.pos < row.end)
                  .map((f, fi) => {
                    const px = LABEL_WIDTH + (f.pos - row.start) * CHAR_WIDTH;
                    return (
                      <g key={`fret-${si}-${fi}`}>
                        {/* Background rect to break the line */}
                        <rect
                          x={px - (f.fret >= 10 ? 7 : 4)}
                          y={y - 7}
                          width={f.fret >= 10 ? 16 : 10}
                          height={14}
                          fill={c.bg}
                          rx={2}
                        />
                        {/* Fret number */}
                        <text
                          x={px + 1}
                          y={y + 4}
                          fill={c.number}
                          fontFamily="var(--fm)"
                          fontSize={12}
                          fontWeight={700}
                          textAnchor="middle"
                        >
                          {f.fret}
                        </text>
                        {/* Technique marker */}
                        {f.technique && (
                          <text
                            x={px + CHAR_WIDTH + 2}
                            y={y - 6}
                            fill="var(--ds-gray-600)"
                            fontFamily="var(--fm)"
                            fontSize={9}
                            fontWeight={600}
                          >
                            {f.technique}
                          </text>
                        )}
                      </g>
                    );
                  });
              })}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

// Break the parsed tab into bar-aligned char ranges that each fit `budgetChars`.
// A row may end immediately after any bar line ('|'). When a single bar is wider
// than the budget it becomes its own (scrolling) row rather than splitting.
function splitIntoRows(parsed, budgetChars) {
  const maxLen = parsed.maxLen;
  if (maxLen === 0) return [{ start: 0, end: 0 }];
  if (!isFinite(budgetChars) || maxLen <= budgetChars || parsed.barPositions.length === 0) {
    return [{ start: 0, end: maxLen }];
  }

  const rows = [];
  let start = 0;
  let lastFit = null; // furthest bar boundary (exclusive) that fits from `start`

  for (const bp of parsed.barPositions) {
    const endCandidate = bp + 1; // include the bar line itself
    if (endCandidate <= start) continue;
    if (endCandidate - start <= budgetChars) {
      lastFit = endCandidate;
    } else if (lastFit !== null && lastFit > start) {
      rows.push({ start, end: lastFit });
      start = lastFit;
      lastFit = endCandidate - start <= budgetChars ? endCandidate : null;
    } else {
      // Single bar wider than the budget — give it its own scrolling row.
      rows.push({ start, end: endCandidate });
      start = endCandidate;
      lastFit = null;
    }
  }

  if (start < maxLen) rows.push({ start, end: maxLen });
  return rows.length ? rows : [{ start: 0, end: maxLen }];
}

function parseForRender(data) {
  const result = { strings: [], barPositions: [], maxLen: 0 };

  if (!data || !data.strings || data.strings.length === 0) return result;

  for (const str of data.strings) {
    const content = str.content;
    if (content.length > result.maxLen) result.maxLen = content.length;

    const frets = [];
    let i = 0;
    while (i < content.length) {
      const ch = content[i];
      if (ch >= '0' && ch <= '9') {
        let fretStr = ch;
        if (i + 1 < content.length && content[i + 1] >= '0' && content[i + 1] <= '9') {
          fretStr += content[i + 1];
          i++;
        }
        let technique = null;
        if (i + 1 < content.length) {
          const next = content[i + 1];
          if ('hpsbx~'.includes(next) || next === '/' || next === '\\') {
            technique = next === '\\' ? '\\' : next;
            i++;
          }
        }
        frets.push({ fret: parseInt(fretStr, 10), pos: i - (fretStr.length - 1), technique });
      }
      i++;
    }
    result.strings.push({ note: str.note, frets });
  }

  // Find bar line positions from first string's content
  if (data.strings.length > 0) {
    const content = data.strings[0].content;
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '|') result.barPositions.push(i);
    }
  }

  return result;
}
