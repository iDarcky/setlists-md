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
  // Show a WINDOW of the map rather than all of it: `{ before, after }` runs
  // around the one you are in. The side rail's shape (owner, 2026-08-05: *"they
  // should show maybe like 5-6 elements and they should scroll with the
  // text"*) — a column down the middle of a phone cannot carry twenty chips,
  // and scrolling it is a second scroll competing with the song's.
  //
  // The slice happens AFTER `runs` is built, so every `run.index` still points
  // at the real play-order slot and `onSelect` keeps meaning what it means.
  windowAround = null,
  // Fill the active chip solid in its section colour rather than ringing a
  // neutral pill. Opt-in so the existing chart keeps its current look.
  activeFill = false,
  // Element 3 + 8, 2026-08-05 (owner: *"I think I like the idea of key change,
  // what do you think, should we do it?"*). `{ [slot]: 'B' }` — a key change
  // ARRIVES at that play-order slot, and the mark names the key you land in,
  // never the interval. Element 8's rule: "we're in B now" beats "+2".
  //
  // Marks are informational, never tappable, and never drawn while reordering:
  // in edit mode a chip is a drag handle and everything between two chips is a
  // drop target.
  keyChanges = null,
  // Fade the ends of the strip when it has more chips than fit. Opt-in: the
  // gradient has to be the colour of whatever the ribbon sits on, and only the
  // reader can promise that (`--chart-bg`). A setlist card would fade to the
  // wrong colour.
  edgeFade = false,
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
  // `onRemoveSlot(index)` — drop a chip on the bin to take it out of the play
  // order (owner, 2026-08-04: "how can we delete a section from the song
  // map?"). A drop TARGET rather than a × per chip: the gesture already exists,
  // and a permanent × on every chip is the control-between-every-pair shape
  // that the `+` was already cut for.
  onRemoveSlot = null,
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
  // HORIZONTAL only. A vertical rail shows a window that walks with you
  // (`windowAround`) rather than a long column it has to scroll — this used to
  // write `scrollTo({ left })` on a box that scrolls vertically, which is why
  // the side rail never followed the song at all.
  useEffect(() => {
    const el = activeRef.current;
    const sc = scrollerRef.current;
    if (!el || !sc || orientation === 'vertical') return;
    const left = el.offsetLeft - (sc.clientWidth - el.clientWidth) / 2;
    sc.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [activeIndex, orientation]);

  const isActiveRun = (run) => activeIndex != null && activeIndex >= run.index && activeIndex < run.index + run.count;

  // The window, when there is one. Anchored so the run you are in keeps
  // `before` chips above it — except at the two ends, where the window stops
  // rather than showing empty space: at the start you get the first N, at the
  // finish the last N, and in between it walks with you.
  const shown = useMemo(() => {
    if (!windowAround || onReorder) return runs;
    const before = windowAround.before ?? 2;
    const after = windowAround.after ?? 3;
    const size = before + after + 1;
    if (runs.length <= size) return runs;
    const cur = runs.findIndex(r => (
      activeIndex != null && activeIndex >= r.index && activeIndex < r.index + r.count
    ));
    const anchor = cur < 0 ? 0 : cur;
    const start = Math.min(Math.max(0, anchor - before), runs.length - size);
    return runs.slice(start, start + size);
  }, [runs, windowAround, onReorder, activeIndex]);
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
      // Reorderable ⇒ WRAP. A horizontally scrolling strip and a horizontal
      // drag are the same gesture, and the scroller wins; wrapping removes the
      // conflict rather than arbitrating it, and it also shows the whole
      // expanded map at once, which is what you want while editing it.
      : ((wrap || onReorder) ? 'flex-wrap' : 'flex-nowrap overflow-x-auto no-scrollbar'),
  );
  const colorOf = (name) => sectionStyle(name.replace(/\s*\d+$/, ''), sectionColors, customSectionTypes);
  const labelOf = (name) => (compact ? compactLabel(name) : sectionLabel(name, sectionLabels));

  // ── The hit area, which is not the chip ──────────────────────────────────
  // A `codes` chip measures 29 × 21px on a phone. That is the right SIZE — the
  // row is chrome and every pixel of it is chart you don't get — but it is a
  // poor TARGET for a thumb, in the dark, between two verses.
  //
  // So the target grows and the chip does not: a transparent `::after` on the
  // button itself, which extends what the browser hit-tests without moving a
  // pixel of what you see. It also feeds `elementFromPoint` in the drag
  // gesture, which reports the HOST element for a pseudo-element, so edit mode
  // gets the bigger grab area for free.
  //
  // ⚠ The ceiling is the wrapper's `overflow-hidden` (Reader draws the strip
  // inside one): hit-testing follows the CLIPPED box, so growing past the row's
  // own padding buys nothing at all. 6px is what the padding affords — 33px of
  // target, not the 44px guideline. A real 44 costs ~16px of permanent chrome
  // height, which is element 1's most expensive currency.
  const TAP_AREA = "relative after:content-[''] after:absolute after:-inset-x-[3px] after:-inset-y-[6px]";

  // ── The edges ────────────────────────────────────────────────────────────
  // A long song runs off both ends of the strip with nothing to say so: the
  // scrollbar is hidden (`no-scrollbar`) and the last chip is clipped flush by
  // the header's `overflow-hidden`, so twelve sections on a 390px phone look
  // exactly like eleven. Owner, 2026-08-05: *"Let's do a fade I think"*.
  //
  // Per side, and only when that side actually has more — a fade sitting on an
  // end you have already reached is the same lie in the other direction.
  const scrolls = !vertical && !wrap && !onReorder;
  const [edges, setEdges] = useState({ l: false, r: false });
  useEffect(() => {
    const sc = scrollerRef.current;
    // No reset here — `framed` already gates on `scrolls`, and clearing state
    // synchronously in an effect is a cascading render for a value nothing can
    // read.
    if (!sc || !scrolls) return undefined;
    const read = () => {
      const max = sc.scrollWidth - sc.clientWidth;
      const l = sc.scrollLeft > 1;
      const r = sc.scrollLeft < max - 1;
      setEdges(prev => (prev.l === l && prev.r === r ? prev : { l, r }));
    };
    read();
    sc.addEventListener('scroll', read, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    ro?.observe(sc);
    return () => { sc.removeEventListener('scroll', read); ro?.disconnect(); };
    // `runs.length`, never `runs` — `structure` is a fresh array every render in
    // the reader, so the array itself would re-bind these listeners on every
    // frame. Same rule as the drag effect below, for a smaller reason.
  }, [scrolls, runs.length]);

  // The key-change marks, interleaved before the chip they arrive at. Built
  // here rather than inside each style branch so the four cannot drift.
  const withMarks = (nodes) => {
    if (!keyChanges || onReorder) return nodes;
    const out = [];
    shown.forEach((run, i) => {
      const arriveAt = keyChanges[run.index];
      if (arriveAt) {
        out.push(
          <span
            key={`mod-${run.index}`}
            aria-label={`Key change to ${arriveAt}`}
            className={cn(
              'shrink-0 inline-flex items-center gap-[1px] font-mono font-bold whitespace-nowrap leading-none',
              vertical ? 'text-[9px] py-[1px]' : 'text-[10px]',
            )}
            // `--chord` is the same gold the chart's own key-change chip uses,
            // and the same one the chords are written in. Not a chip: this is
            // a thing that HAPPENS between two sections, not a section.
            style={{ color: 'var(--chord)' }}
          >
            <span aria-hidden="true">↗</span>{arriveAt}
          </span>
        );
      }
      out.push(nodes[i]);
    });
    return out;
  };

  // Wraps whichever style branch rendered, so all four get the same edges.
  // `backgroundImage`, not the `background` shorthand: jsdom's parser throws on
  // some shorthand values inside `cloneNode`, which Testing Library does for
  // every role query — one bad inline style takes out every `getByRole` on the
  // page.
  const framed = (row) => {
    if (!edgeFade || !scrolls) return row;
    const fade = (side) => (
      <span
        key={side}
        aria-hidden="true"
        className={cn('pointer-events-none absolute inset-y-0 w-6', side === 'l' ? 'left-0' : 'right-0')}
        style={{
          backgroundImage: `linear-gradient(to ${side === 'l' ? 'right' : 'left'}, var(--chart-bg, var(--ds-background-100)), transparent)`,
        }}
      />
    );
    return (
      <div className="relative min-w-0">
        {row}
        {edges.l && fade('l')}
        {edges.r && fade('r')}
      </div>
    );
  };

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
  // Everything the listeners need that CHANGES, in one box they can read at
  // event time. See the warning below for why this is not a dependency array.
  // Written in an EFFECT, not during render — assigning `.current` while
  // rendering is a ref write during render and the compiler rejects it.
  const liveRef = useRef({});
  useEffect(() => {
    liveRef.current = { runs, onReorder, onRemoveSlot, total: structure.length, drag };
  });

  // ⚠ MOUNT-ONCE, and it has to be.
  //
  // This effect used to depend on `[onReorder, drag, runs, structure.length]`.
  // `structure` is `ordered.map(s => s.type)` in the reader — a NEW array every
  // render — so `runs` re-memoised every render, this effect re-ran every
  // render, and its cleanup called `clearHold()`.
  //
  // Which means: the 250ms timer fires → `setDrag` → re-render → cleanup →
  // `holdRef.current = null` → `onMove` bails on `if (!h) return` and `onUp`
  // reads `engaged: false`. **The drag could never have completed**, and no
  // amount of tuning the gesture would have fixed it. Two rounds went to that.
  //
  // With `[]` the listeners live as long as the component and read the moving
  // parts out of `liveRef`. Nothing that changes may go in the dependency array
  // of an effect that owns gesture state.
  useEffect(() => {
    const clearHold = () => {
      if (holdRef.current?.timer) clearTimeout(holdRef.current.timer);
      holdRef.current = null;
    };
    const onDown = (e) => {
      if (!liveRef.current.onReorder) return;
      const el = e.target?.closest?.('[data-run]');
      if (!el) return;
      const i = Number(el.getAttribute('data-run'));
      // Keep the move/up events coming to this element even if the finger
      // leaves it — without capture they retarget and the drop is lost.
      try { el.setPointerCapture?.(e.pointerId); } catch { /* not supported */ }
      holdRef.current = {
        x: e.clientX, y: e.clientY, engaged: false, el, pointerId: e.pointerId,
        from: i, over: null,
        timer: setTimeout(() => {
          if (!holdRef.current) return;
          holdRef.current.engaged = true;
          setDrag({ from: i, over: i });
        }, 250),
      };
    };
    const onMove = (e) => {
      const h = holdRef.current;
      if (!h) return;
      if (!h.engaged) {
        // Moved before the hold fired — that was a scroll or a swipe.
        if (Math.abs(e.clientX - h.x) > 8 || Math.abs(e.clientY - h.y) > 8) clearHold();
        return;
      }
      e.preventDefault();
      const { runs: liveRuns } = liveRef.current;
      // With pointer capture the target is always the chip we started on, so
      // hit-test by coordinates instead of by `e.target`.
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      // `runs.length` is the END sentinel — dropping past the last chip.
      const binZone = hit?.closest?.('[data-drop-bin]');
      const endZone = hit?.closest?.('[data-drop-end]');
      const el = hit?.closest?.('[data-run]');
      // -1 is the BIN sentinel, `runs.length` the END sentinel.
      const over = binZone ? -1
        : endZone ? liveRuns.length
          : (el ? Number(el.getAttribute('data-run')) : null);
      if (over == null) return;
      // The drop target lives on the HOLD, written synchronously, because the
      // gesture cannot wait for a render. Reading it back out of React state in
      // `onUp` meant the target lagged one render behind the finger — and if
      // the pointer went up before that render committed, the drop was silently
      // the one from the previous move. State here is for PAINT only.
      h.over = over;
      setDrag(d => (d && d.over !== over ? { ...d, over } : d));
    };
    const onUp = () => {
      const h = holdRef.current;
      const { runs: liveRuns, onReorder: reorder, total, onRemoveSlot: remove } = liveRef.current;
      if (h?.el && h.pointerId != null) {
        try { h.el.releasePointerCapture?.(h.pointerId); } catch { /* already gone */ }
      }
      clearHold();
      if (h?.engaged) {
        // Letting go of a drag must not also fire the chip's jump.
        suppressRef.current = true;
        const run = liveRuns[h.from];
        if (h.over === -1) {
          if (run) remove?.(run.index);
        } else if (h.over != null && h.over !== h.from) {
          const to = h.over >= liveRuns.length ? total : liveRuns[h.over]?.index;
          if (run && to != null) reorder?.(run.index, run.count, to);
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
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('click', onClickCapture, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('click', onClickCapture, true);
      clearHold();
    };
  }, []);

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
          // The browser decides `touch-action` when the gesture STARTS, so it
          // cannot be switched on mid-drag. Claiming the horizontal axis here
          // is what stops the scroller swallowing the gesture — and it costs
          // nothing, because a reorderable ribbon WRAPS instead of scrolling
          // (see `rowClass`). `pan-y` keeps the page itself scrollable.
          touchAction: 'pan-y',
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
    // The bin, only while dragging. A permanent one is a destructive target
    // sitting in the chrome waiting to be brushed.
    if (onRemoveSlot && drag) {
      tail.push(
        <span
          key="bin"
          data-drop-bin="true"
          className="shrink-0 inline-flex items-center justify-center w-7 h-[19px] rounded-[5px] border border-dashed"
          style={drag.over === -1
            ? { borderColor: 'var(--ds-red-900)', background: 'color-mix(in srgb, var(--ds-red-900) 18%, transparent)', color: 'var(--ds-red-900)' }
            : { borderColor: 'var(--ds-red-900)', color: 'var(--ds-red-900)' }}
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" />
          </svg>
        </span>
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
    return framed(
      <div ref={scrollerRef} className={cn(rowClass, 'items-center gap-1.5')}>
        {decorate(withMarks(shown.map((run, i) => {
          const s = colorOf(run.name);
          const active = isActiveRun(run);
          const Tag = onSelect ? 'button' : 'span';
          return (
            <Tag
              key={i}
              ref={active ? activeRef : null}
              {...(onSelect ? { type: 'button', onClick: () => onSelect(run.index), title: labelOf(run.name) } : {})}
              className={cn('shrink-0 inline-flex items-center gap-1 min-h-0', onSelect && `cursor-pointer hover:opacity-80 ${TAP_AREA}`)}
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
        })))}
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
    return framed(
      <div ref={scrollerRef} className={cn(rowClass, 'items-center gap-[5px]')}>
        {decorate(withMarks(shown.map((run, i) => {
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
                onSelect && `cursor-pointer hover:opacity-80 ${TAP_AREA}`,
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
        })))}
      </div>
    );
  }

  if (style === 'numbered') {
    return framed(
      <div ref={scrollerRef} className={cn(rowClass, 'items-baseline')}>
        {decorate(withMarks(shown.map((run, i) => {
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
                  onSelect && `cursor-pointer hover:opacity-80 ${TAP_AREA}`,
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
        })))}
      </div>
    );
  }

  // Default: chips.
  return framed(
    <div ref={scrollerRef} className={rowClass}>
      {decorate(withMarks(shown.map((run, i) => {
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
              onSelect && `cursor-pointer hover:opacity-80 ${TAP_AREA}`,
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
      })))}
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
