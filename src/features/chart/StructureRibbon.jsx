import { useRef, useEffect, useState, useMemo, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import { sectionStyle, sectionLabel, compactLabel } from '@/music';
import { cn } from '@/lib/utils';

export function StructureRibbon({
  structure,
  compact,
  onSelect,
  sectionColors,
  sectionLabels,
  customSectionTypes,
  // Index of the section currently in view; highlights its chip and keeps it
  // scrolled into view as the song scrolls (scroll-sync).
  activeIndex = null,
  // Visual variant the user picks in Settings → Chart Defaults:
  //   'codes'    — bordered mono code boxes, coloured text (default; mockup)
  //   'chips'    — coloured rounded pills
  //   'numbered' — plain colour-coded short codes, separated by middots
  //   'dots'     — minimal coloured dots, most compact
  style = 'codes',
  // When true, chips wrap to multiple lines instead of horizontal-scrolling.
  // Used by the setlist overview v2 song cards (avoids the odd mobile scroll).
  wrap = false,
  // When false, consecutive duplicates are NOT merged into "×N" — each entry
  // renders as its own item (used by the vertical floating side rail, where the
  // user wants the repeats spelled out rather than collapsed).
  collapse = true,
  // 'horizontal' (default) or 'vertical' — the side floating rail stacks the
  // items in a column.
  orientation = 'horizontal',
  // Fill the active chip solid in its section colour rather than ringing a
  // neutral pill. Opt-in so the existing chart keeps its current look.
  activeFill = false,
  // ── EDIT MODE ONLY ───────────────────────────────────────────────────────
  // The owner's shape, 2026-08-04: *"only one + at the end with a drop down and
  // select what you want and then you drag and replace in the song map"*.
  //
  // A `+` per chip (the first cut) put one control between every pair of chips
  // and still only ever added the section it sat on. One `+` at the end that
  // asks WHICH section is both smaller and more capable.
  //
  // `addOptions` — the section names this song has. `onAddSection(name)`
  // appends it. `onReorder(fromIndex, count, toIndex)` moves a whole run.
  addOptions = null,
  onAddSection = null,
  onReorder = null,
}) {
  // Collapse consecutive duplicates: "C1, C1, C1" → one entry "C1 ×3".
  // Memoised because the drag effect depends on it — a fresh array every render
  // would tear down and re-add the pointer listeners mid-gesture.
  const runs = useMemo(() => {
    const out = [];
    structure.forEach((name, i) => {
      const last = out[out.length - 1];
      if (collapse && last && last.name === name) last.count += 1;
      else out.push({ name, count: 1, index: i });
    });
    return out;
  }, [structure, collapse]);

  const scrollerRef = useRef(null);
  const activeRef = useRef(null);

  // Keep the active chip centred as the song scrolls (horizontal only — avoid
  // scrollIntoView so it never nudges the page vertically).
  useEffect(() => {
    const el = activeRef.current;
    const sc = scrollerRef.current;
    if (!el || !sc) return;
    const left = el.offsetLeft - (sc.clientWidth - el.clientWidth) / 2;
    sc.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [activeIndex]);

  const isActiveRun = (run) => activeIndex != null && activeIndex >= run.index && activeIndex < run.index + run.count;
  // px-1 keeps the first/last chip (and the active chip's ring) from being
  // clipped at the scroller's edges.
  const vertical = orientation === 'vertical';
  // The row adds no height of its own beyond what the chips need — the boxes
  // are 15px tall now, so a taller row is the only thing that could put space
  // back above and below them.
  const rowClass = cn(
    'flex gap-1 px-1 py-0.5 min-w-0',
    vertical
      ? 'flex-col items-center'
      : (wrap ? 'flex-wrap' : 'flex-nowrap overflow-x-auto no-scrollbar'),
  );
  const colorOf = (name) => sectionStyle(name.replace(/\s*\d+$/, ''), sectionColors, customSectionTypes);
  const labelOf = (name) => (compact ? compactLabel(name) : sectionLabel(name, sectionLabels));

  // ── Drag to reorder, long-press to engage ────────────────────────────────
  // A plain pointerdown-drag cannot work here: the ribbon is a horizontally
  // scrolling strip, so the same gesture already means "scroll". `touch-action:
  // none` would win the fight and cost the ability to reach a chip off-screen
  // in a long song, which is worse.
  //
  // So the drag engages on a 250ms HOLD, the way every mobile reorder does. Tap
  // still jumps, swipe still scrolls, and nothing changes until you have
  // deliberately held still on one chip.
  const [drag, setDrag] = useState(null);      // { from, over }
  const holdRef = useRef(null);
  // Set when a drag ends, consumed by the capture-phase click listener below.
  const suppressRef = useRef(false);

  useEffect(() => {
    if (!onReorder) return undefined;
    const clearHold = () => {
      if (holdRef.current?.timer) clearTimeout(holdRef.current.timer);
      holdRef.current = null;
    };
    // Attached HERE, not built in render: a handler created during render that
    // touches `holdRef.current` counts as a ref read during render. All of the
    // gesture's bookkeeping lives in this effect, and `decorate` only labels the
    // chips with `data-run` so the listeners can find them.
    const onDown = (e) => {
      const el = e.target?.closest?.('[data-run]');
      if (!el) return;
      const i = Number(el.getAttribute('data-run'));
      holdRef.current = {
        x: e.clientX, y: e.clientY, engaged: false,
        timer: setTimeout(() => {
          if (!holdRef.current) return;
          holdRef.current.engaged = true;
          setDrag({ from: i, over: i });
        }, 250),
      };
    };
    const onMove = (e) => {
      const h = holdRef.current;
      if (h && !h.engaged) {
        // Moved before the hold fired — that was a scroll or a swipe.
        if (Math.abs(e.clientX - h.x) > 8 || Math.abs(e.clientY - h.y) > 8) clearHold();
        return;
      }
      if (!h) return;
      e.preventDefault();
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      // `runs.length` is the END sentinel — dropping past the last chip. Without
      // it a chip can only ever land ON another chip, so nothing can be moved
      // to the end of the order (owner, 2026-08-04: "yes, it matters").
      const endZone = hit?.closest?.('[data-drop-end]');
      const el = hit?.closest?.('[data-run]');
      const over = endZone ? runs.length : (el ? Number(el.getAttribute('data-run')) : null);
      setDrag(d => (d && over != null && d.over !== over ? { ...d, over } : d));
    };
    const onUp = () => {
      const h = holdRef.current;
      const d = drag;
      clearHold();
      if (h?.engaged) {
        // Letting go of a drag must not also fire the chip's jump.
        suppressRef.current = true;
        if (d && d.over != null && d.over !== d.from) {
          const run = runs[d.from];
          // The end sentinel lands after every slot; any other target lands at
          // that run's first slot.
          const to = d.over >= runs.length ? structure.length : runs[d.over]?.index;
          if (run && to != null) onReorder(run.index, run.count, to);
        }
      }
      setDrag(null);
    };
    // Capture phase, and registered HERE rather than as an onClick built during
    // render: an `onClick` that reads `holdRef.current` is a ref read during
    // render, which the compiler rejects — and it is right to, because a prop
    // computed from a ref does not re-render when the ref changes.
    const onClickCapture = (e) => {
      if (!suppressRef.current) return;
      suppressRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const scroller = scrollerRef.current;
    scroller?.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('click', onClickCapture, true);
    return () => {
      scroller?.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('click', onClickCapture, true);
      clearHold();
    };
  }, [onReorder, drag, runs, structure.length]);

  // `cloneElement` rather than rebuilding each chip: there are four style
  // branches, and injecting the same handful of props into whatever each one
  // produced keeps them from drifting apart.
  const decorate = (nodes) => {
    let out = nodes;
    if (onReorder) {
      out = nodes.map((node, i) => cloneElement(node, {
        'data-run': i,
        style: {
          ...node.props.style,
          ...(drag?.from === i ? { opacity: 0.4 } : null),
          ...(drag && drag.over === i && drag.from !== i
            ? { outline: '2px dashed var(--color-brand)', outlineOffset: 2 }
            : null),
        },
      }));
    }
    const tail = [];
    // Only while dragging: an always-present gap at the end would read as a
    // missing chip.
    if (onReorder && drag) {
      tail.push(
        <span
          key="end"
          data-drop-end="true"
          className="shrink-0 self-stretch w-6 rounded-[5px]"
          style={drag.over >= runs.length
            ? { outline: '2px dashed var(--color-brand)', outlineOffset: 2 }
            : { border: '1px dashed var(--border-2)' }}
        />
      );
    }
    if (onAddSection && addOptions?.length) {
      tail.push(
        <AddSection key="add" options={addOptions} onPick={onAddSection}
          sectionColors={sectionColors} customSectionTypes={customSectionTypes} />
      );
    }
    return tail.length ? [...out, ...tail] : out;
  };

  if (style === 'dots' || style === 'dotlabel') {
    const showLabels = style === 'dotlabel';
    return (
      <div ref={scrollerRef} className={cn(rowClass, 'items-center gap-1.5')}>
        {decorate(runs.map((run, i) => {
          const s = colorOf(run.name);
          const active = isActiveRun(run);
          const Tag = onSelect ? 'button' : 'span';
          return (
            <Tag
              key={i}
              ref={active ? activeRef : null}
              {...(onSelect ? { type: 'button', onClick: () => onSelect(run.index), title: labelOf(run.name) } : {})}
              className={cn('shrink-0 inline-flex items-center gap-1 min-h-0', onSelect && 'cursor-pointer hover:opacity-80')}
            >
              {/* The dot uses the section's base colour (`s.b`) so it matches the
                  in-chart section titles, not a washed-out border tint. */}
              <span
                className={cn('rounded-full transition-all', active ? 'w-3.5 h-3.5 ring-2 ring-offset-1 ring-offset-transparent' : 'w-2.5 h-2.5')}
                style={{ background: s.b, boxShadow: active ? `0 0 0 2px ${s.b}` : undefined }}
              />
              {showLabels && (
                <span className="font-mono font-bold text-[11px]" style={{ color: s.b }}>{labelOf(run.name)}</span>
              )}
              {run.count > 1 && (
                <span className="text-[10px] font-semibold" style={{ color: s.b }}>×{run.count}</span>
              )}
            </Tag>
          );
        }))}
      </div>
    );
  }

  // 'codes' — the Score mockup's ribbon, verbatim:
  //   .rib { font: 10px mono; letter-spacing: .06em; padding: 2px 7px;
  //          border-radius: 5px; border: 1px solid <hairline>; color: <muted> }
  //   .rib[data-on] { background: <accent>; color: <bg>; font-weight: 700 }
  // Geometry is the mockup's; the colour is ours. Each code carries its section
  // type's colour, and the chip you're standing in FILLS with it — so the row
  // reads as the shape of the song, and the current chip and the heading it
  // points at are visibly the same object.
  if (style === 'codes') {
    return (
      <div ref={scrollerRef} className={cn(rowClass, 'items-center gap-[5px]')}>
        {decorate(runs.map((run, i) => {
          const s = colorOf(run.name);
          const active = isActiveRun(run);
          const Tag = onSelect ? 'button' : 'span';
          return (
            <Tag
              key={i}
              ref={active ? activeRef : null}
              {...(onSelect ? { type: 'button', onClick: () => onSelect(run.index), title: labelOf(run.name) } : {})}
              className={cn(
                'shrink-0 inline-flex items-center gap-1 whitespace-nowrap font-mono text-[10px] leading-[1.5]',
                // `button { min-height: 36px }` (44px on a phone) lives in
                // @layer base and beats every padding utility here. Without
                // this opt-out the chip is a 44px slab and no amount of
                // padding tuning touches it.
                'min-h-0',
                'tracking-[0.06em] px-[7px] py-[2px] rounded-[5px] border transition-all',
                active && 'font-bold',
                onSelect && 'cursor-pointer hover:opacity-80',
              )}
              style={activeFill
                ? (active
                  // The one filled chip. Its colour is the section's, so the
                  // chip and the heading it points at are the same object.
                  ? { color: 'var(--chart-bg, var(--bg-1))', background: s.b, borderColor: s.b }
                  : {
                    // Every code keeps its section's colour — you read the
                    // shape of the song off the row without reading it.
                    color: s.b,
                    borderColor: 'var(--chart-rule, var(--border-1))',
                    background: 'transparent',
                  })
                // Without `activeFill` this is the pre-reader chart's ribbon:
                // every code carries its own section colour, current one ringed.
                : {
                  color: s.b,
                  borderColor: 'var(--chart-rule, var(--border-1))',
                  background: 'transparent',
                  ...(active ? { boxShadow: `0 0 0 2px ${s.b}` } : {}),
                }}
            >
              {compactLabel(run.name)}
              {run.count > 1 && <span className="opacity-70">×{run.count}</span>}
            </Tag>
          );
        }))}
      </div>
    );
  }

  if (style === 'numbered') {
    return (
      <div ref={scrollerRef} className={cn(rowClass, 'items-baseline')}>
        {decorate(runs.map((run, i) => {
          const s = colorOf(run.name);
          const active = isActiveRun(run);
          const Tag = onSelect ? 'button' : 'span';
          return (
            <span key={i} ref={active ? activeRef : null} className="shrink-0 inline-flex items-center">
              {i > 0 && (
                <span className="mx-1 text-[10px]" style={{ color: 'var(--chart-subtle, var(--ds-gray-500))' }}>·</span>
              )}
              <Tag
                {...(onSelect ? { type: 'button', onClick: () => onSelect(run.index) } : {})}
                className={cn(
                  // Same type as `codes` — the boxes are just gone.
                  'bg-transparent border-none p-0 min-h-0 font-mono text-[10px] leading-[1.5] tracking-[0.06em]',
                  active ? 'font-bold' : 'font-medium',
                  active && !activeFill && 'underline underline-offset-4',
                  // The filled chip is the `codes` chip exactly, borderless.
                  activeFill && active && 'inline-flex items-center px-[7px] py-[2px] rounded-[5px]',
                  onSelect && 'cursor-pointer hover:opacity-80',
                )}
                style={activeFill
                  ? (active
                    ? { background: s.b, color: 'var(--chart-bg, var(--bg-1))' }
                    : { color: s.b })
                  : { color: s.b }}
              >
                {compactLabel(run.name)}
                {run.count > 1 && <span className="opacity-70">×{run.count}</span>}
              </Tag>
            </span>
          );
        }))}
      </div>
    );
  }

  // Default: chips.
  return (
    <div ref={scrollerRef} className={rowClass}>
      {decorate(runs.map((run, i) => {
        const s = colorOf(run.name);
        const active = isActiveRun(run);
        const Tag = onSelect ? 'button' : 'span';
        return (
          <Tag
            key={i}
            ref={active ? activeRef : null}
            {...(onSelect ? { type: 'button', onClick: () => onSelect(run.index) } : {})}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border font-medium transition-all min-h-0",
              compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-[12px]",
              onSelect && "cursor-pointer hover:opacity-80",
              active && "ring-2 ring-offset-1 ring-offset-transparent"
            )}
            // Option (a), owner 2026-08-01: an inactive chip is an OUTLINE with
            // its section's colour on it — no fill, no dimmed text, no opacity.
            // It used to stack all three (tinted background + muted `s.d` text +
            // 0.72 opacity), and three dimming mechanisms at once is what made
            // the row read as muddy rather than quiet. One filled chip on a row
            // of clean outlines is the contrast the ribbon actually needs.
            style={{
              ...(activeFill && active
                ? { background: s.b, borderColor: s.b, color: 'var(--chart-bg, var(--bg-1))' }
                : { borderColor: s.br, background: 'transparent', color: s.b }),
              ...(active && !activeFill ? { boxShadow: `0 0 0 2px ${s.b}` } : {}),
            }}
          >
            {labelOf(run.name)}
            {run.count > 1 && (
              <span className="opacity-70 font-semibold">×{run.count}</span>
            )}
          </Tag>
        );
      }))}
    </div>
  );
}

/**
 * The one `+` at the end of the map, and the list of sections it opens.
 *
 * Portalled: the ribbon is an `overflow-x-auto` strip, so a menu rendered
 * inside it would be clipped by its own scroller.
 */
function AddSection({ options, onPick, sectionColors, customSectionTypes }) {
  const [at, setAt] = useState(null);
  return (
    <>
      <button
        type="button"
        aria-label="Add a section to the play order"
        title="Add a section"
        aria-expanded={!!at}
        onClick={(e) => {
          // Read the rect synchronously — React nulls currentTarget once the
          // handler returns.
          const r = e.currentTarget.getBoundingClientRect();
          setAt(prev => (prev ? null : r));
        }}
        className="shrink-0 min-h-0 w-[19px] h-[19px] grid place-items-center rounded-[5px] border border-dashed bg-transparent cursor-pointer text-[12px] leading-none font-bold"
        style={{ borderColor: 'var(--color-brand)', color: 'var(--color-brand)' }}
      >
        +
      </button>
      {at && createPortal((
        <>
          <button
            type="button" aria-label="Close" tabIndex={-1} onClick={() => setAt(null)}
            className="fixed inset-0 z-[119] bg-transparent border-none cursor-default"
          />
          <div
            role="menu" aria-label="Add a section"
            className="fixed z-[120] w-[124px] max-h-[46vh] overflow-y-auto rounded-xl border bg-[var(--ds-background-100)] border-[var(--ds-gray-400)] py-1"
            style={{
              top: Math.min(at.bottom + 6, (typeof window !== 'undefined' ? window.innerHeight : 800) - 220),
              left: Math.max(8, Math.min(at.left, (typeof document !== 'undefined' ? document.documentElement.clientWidth : 400) - 132)),
              boxShadow: '0 14px 40px rgba(0,0,0,0.45)',
            }}
          >
            {/* Coloured, because the map they are being added to is coloured
                (owner, 2026-08-04) — a plain list makes you translate a name
                back into the chip you are about to see. */}
            {options.map((name) => {
              const c = sectionStyle(name.replace(/\s*\d+$/, ''), sectionColors, customSectionTypes);
              return (
                <button
                  key={name} type="button" role="menuitem"
                  onClick={() => { onPick(name); setAt(null); }}
                  className="w-full min-h-0 flex items-center gap-2 px-2.5 py-1.5 text-left bg-transparent border-none cursor-pointer hover:bg-[var(--ds-gray-200)]"
                >
                  <span className="shrink-0 w-1.5 h-4 rounded-full" style={{ background: c.b }} />
                  <span className="truncate text-label-11" style={{ color: c.b }}>{name}</span>
                </button>
              );
            })}
          </div>
        </>
      ), document.body)}
    </>
  );
}

export function MetaPill({ label, value, highlight }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)]">
      <span className="text-label-10 font-semibold text-[var(--ds-gray-600)]">
        {label}
      </span>
      <span
        className={cn("text-label-14-mono font-bold", highlight ? "text-[var(--chord)]" : "text-[var(--ds-gray-1000)]")}
      >
        {value}
      </span>
    </div>
  );
}
