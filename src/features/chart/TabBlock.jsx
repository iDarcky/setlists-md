import { useMemo, useRef, useState, useEffect } from 'react';
import { transposeTab } from '@/lib/tabTranspose';

// Tightened so more of a tab fits on screen: six strings at 18px spacing plus
// padding made a single riff as tall as four lyric lines. These are the
// unscaled SVG units — `scale` still applies on top.
const STRING_SPACING = 11;
const LABEL_WIDTH = 18;
const PADDING_TOP = 6;
const PADDING_BOTTOM = 5;
const CHAR_WIDTH = 6;
const ROW_PADDING = 10;

const DEFAULT_COLORS = {
  line: 'var(--ds-gray-400)',
  label: 'var(--ds-gray-600)',
  number: 'var(--chord)',
  bg: 'var(--ds-background-200)',
};

export default function TabBlock({
  data, scale = 1, colors,
  // Element 9. `transpose` shifts the frets when it can and flags the tab when
  // it cannot; `writtenKey` names the key it was written in for that flag.
  transpose = 0, writtenKey,
  // Collapsed tabs show one line until asked for — a bassist should not scroll
  // past the electric riff in every section.
  collapsible = false, defaultOpen = true, label,
}) {
  const shift = useMemo(
    () => transposeTab(data?.strings, transpose),
    [data?.strings, transpose],
  );
  const shifted = useMemo(
    () => ({ ...data, strings: shift.strings }),
    [data, shift.strings],
  );
  const parsed = useMemo(() => parseForRender(shifted), [shifted]);
  const c = { ...DEFAULT_COLORS, ...(colors || {}) };
  const [open, setOpen] = useState(defaultOpen);

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

  const instrument = label || data?.instrument;
  const header = (collapsible || shift.flagged) && (
    <div className="flex items-center gap-2 text-[11px] leading-none">
      {collapsible && (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer font-semibold"
          style={{ color: 'var(--chart-subtle, var(--text-2))' }}
        >
          <span aria-hidden="true" className="inline-block w-2">{open ? '▾' : '▸'}</span>
          {instrument ? `${instrument} tab` : 'Tab'}
        </button>
      )}
      {shift.flagged && (
        <span
          className="font-semibold"
          style={{ color: 'var(--ds-amber-900, #a5730a)' }}
          title={shift.reason === 'out-of-range'
            ? 'These frets cannot move without going past the nut, so the tab is shown as written.'
            : 'Transposed a long way — check the fingering.'}
        >
          {shift.reason === 'out-of-range'
            ? `written in ${writtenKey || 'the original key'}`
            : 'check fingering'}
        </span>
      )}
    </div>
  );

  if (collapsible && !open) {
    return <div ref={containerRef} className="my-1.5">{header}</div>;
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-2 max-w-full my-1.5">
      {header}
      {rows.map((row, ri) => {
        const rowLen = row.end - row.start;
        const contentWidth = rowLen * CHAR_WIDTH;
        const totalWidth = LABEL_WIDTH + contentWidth + ROW_PADDING;
        // A single bar can still be wider than the container. Rather than
        // scroll — tab must never scroll sideways — that row scales itself
        // down to fit, since a slightly smaller bar still reads.
        return (
          <div key={ri} className="max-w-full">
            <svg
              width="100%"
              height={height * scale}
              viewBox={`0 0 ${totalWidth} ${height}`}
              preserveAspectRatio="xMinYMid meet"
              style={{ maxWidth: totalWidth * scale }}
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
                    fontSize={8}
                    fontWeight={600}
                    textAnchor="end"
                  >
                    {str.note}
                  </text>
                );
              })}

              {/* Bar lines within this row, numbered — the tab already broke
                  at bars, but nothing said WHICH bar, so you could not tell
                  bar 1 from bar 3 at a glance. */}
              {parsed.barPositions
                .filter(pos => pos >= row.start && pos < row.end)
                .map((pos, i) => {
                  const x = LABEL_WIDTH + (pos - row.start) * CHAR_WIDTH;
                  const barNo = parsed.barPositions.indexOf(pos) + 2;
                  return (
                    <g key={`bar-${i}`}>
                      <line
                        x1={x}
                        y1={PADDING_TOP - 3}
                        x2={x}
                        y2={PADDING_TOP + (parsed.strings.length - 1) * STRING_SPACING + 3}
                        stroke={c.line}
                        strokeWidth={1.5}
                      />
                      <text
                        x={x + 2}
                        y={PADDING_TOP - 5}
                        fill={c.label}
                        fontFamily="var(--fm)"
                        fontSize={6}
                        opacity={0.7}
                      >
                        {barNo}
                      </text>
                    </g>
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
                          fontSize={9}
                          fontWeight={700}
                          textAnchor="middle"
                        >
                          {f.fret}
                        </text>
                        {/* Technique marker — lighter, italic and smaller than
                            a fret number, because an 'h' used to look like one. */}
                        {f.technique && (
                          <text
                            x={px + CHAR_WIDTH + 1}
                            y={y - 4}
                            fill={c.label}
                            fontFamily="var(--fm)"
                            fontSize={7}
                            fontStyle="italic"
                            fontWeight={400}
                            opacity={0.85}
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
