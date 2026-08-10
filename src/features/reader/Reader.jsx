import { useMemo, useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { semitonesBetween, keysInQualityOf, notateChord } from '@/music';
import { capoFor, withCapo, shapeKeyFor, suggestCapo, MAX_CAPO } from '@/lib/capo';
import { resolveSongView } from '@/arrangements';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/ui/Select';
import { IconButton } from '@/ui/IconButton';
import { buildSongFlow, repeatRuns } from '@/lib/songFlow';
import { resolveSectionColors } from '@/lib/sectionIdentity';
import { resolveReaderConfig } from '@/lib/readerConfig';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useActiveSection } from '@/hooks/useActiveSection';
import { StructureRibbon } from '@/features/chart/StructureRibbon';
import ReaderSection from './ReaderSection';
import ReaderTopBar from './ReaderTopBar';
import { BAR_BUTTON, EDIT_ACCENT } from './readerChrome';
import { chartSurface, hubSurface } from './readerSurface';
import ReaderPracticeRow, { MetronomeIcon } from './ReaderPracticeRow';
import AaMenu from '@/features/chart/AaMenu';
import ReaderMenu from './ReaderMenu';
import { useWakeLock } from '@/hooks/useWakeLock';
import ChordPopover from '@/features/chart/ChordPopover';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useMetronome } from '@/hooks/useMetronome';
import { clampTempo } from '@/lib/metronome';
import ReaderActions from './ReaderActions';
import { useConfirm } from '@/ui/useConfirmHook';

import {
  materialiseStructure, removeSlot, moveRun, appendSection, addNewSection, snapshotEditable, isDirty,
  replaceChordInLine, withEditedLine,
} from '@/lib/editStructure';
import ChordAutocomplete from '@/features/editor/ChordAutocomplete';
import { transposeChord } from '@/music';
import { parseSectionLines, CUE_MAX_CHARS, INLINE_NOTE_MAX_CHARS } from '@/parser';
import { showUndoToast } from '@/lib/undoToast';

const EMPTY = [];

/**
 * The chart reader — elements 1–6 only.
 *
 *   1  top bar          menu · title · key · tempo/time · exit
 *   2  structure ribbon fixed, positionable, tracks where you are
 *   3  section heading  sticky, styled, weighted
 *   4  band cue         on the heading's line, `!` reads as loud
 *   5  inline notes     leader-dotted on wide, above the line on narrow
 *   6  chords           unchanged; --chord follows the chart theme
 *
 * Nothing else. No presets, no paging, no tools bar — those come back once
 * the remaining elements are designed, not before.
 *
 * The chart body is still `SectionBlock`; this owns the frame around it.
 */
/**
 * One editable value in the top bar. Local state while typing, committed on
 * blur or Enter — writing on every keystroke would push a song update (and a
 * sync) per character, and a half-typed "12" is a real tempo the metronome
 * would try to use.
 *
 * `min-h-0`: the phone's 44px floor applies to inputs' siblings in this row and
 * would make the bar taller in edit mode than out of it, which reads as the
 * page jumping when you press edit.
 */
/**
 * Element 19 — the capo, as a chip beside the key.
 *
 * Outlined rather than filled: the key pill is the solid `--chord` block, and
 * two solid blocks side by side compete for the same "this is the fact" role.
 * Outlined reads as *derived from* the thing next to it, which is exactly what
 * a capo is.
 *
 * Off state is deliberately quiet — a hollow "Capo" in the bar's own muted ink,
 * the same weight as the tempo and the time beside it. A guitarist finds it; a
 * drummer never notices it is there.
 *
 * The list offers the SUGGESTED fret first and marks it, rather than defaulting
 * to it. Owner, 2026-08-10: *"I don't know if I'd want auto-computed, I feel
 * like it can be annoying"* — so the arithmetic is offered and the choice is
 * the player's, which also means it survives the leader moving the key.
 */
function CapoChip({ capo, soundingKey, shapeKey, writtenCapo, onSelect }) {
  const suggestion = suggestCapo(soundingKey, writtenCapo);
  return (
    <Select
      value={String(capo)}
      onValueChange={(v) => onSelect(parseInt(v, 10) || 0)}
    >
      <SelectTrigger
        aria-label={capo ? `Capo ${capo}, shapes in ${shapeKey}` : 'Capo'}
        className="!border gap-0.5 font-mono font-bold focus:!ring-0 shrink-0 hover:!opacity-90 !h-[23px] !min-h-[23px] sm:!h-[20px] sm:!min-h-[20px] !w-auto !pl-1.5 !pr-1 !py-0 !rounded-lg text-[12px] leading-none [&>svg]:w-[10px] [&>svg]:h-[10px] [&>svg]:shrink-0 [&>svg]:translate-y-[1px]"
        style={{
          // ⚠ LONGHANDS. A `background` or `outline` shorthand with a nested
          // `var(a, var(b))` throws in jsdom's style expander, inside the
          // `cloneNode` that every `getByRole` performs — one of those on one
          // button took out 37 tests at once.
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: capo ? 'var(--chord)' : 'var(--chart-rule, var(--ds-gray-400))',
          color: capo ? 'var(--chord)' : 'var(--chart-subtle, var(--ds-gray-700))',
        }}
      >
        <span>{capo ? `Capo ${capo}` : 'Capo'}</span>
        {capo && shapeKey ? <span className="opacity-70">·{shapeKey}</span> : null}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="0">No capo</SelectItem>
        {Array.from({ length: MAX_CAPO }, (_, i) => i + 1).map(n => (
          <SelectItem key={n} value={String(n)}>
            {`Capo ${n} · ${shapeKeyFor(soundingKey, n)} shapes`}
            {suggestion?.capo === n ? '  ★' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * "Add section", at the foot of the chart, in edit mode.
 *
 * Two taps, not a dialog. A dialog for "what is it called" would cover the song
 * you are adding to, and the answer is one of eight words nine times out of ten
 * — so the eight are offered as chips and anything else is typed in the same
 * row. `Intro` is first because it is the case that asked for this feature.
 *
 * Collapsed to a single quiet row until tapped: it sits under every song in
 * edit mode, and something that says "+ Add section" permanently at the end of
 * a chart is the same litter that ~30 `+` marks would have been in the gutter.
 */
function AddSectionRow({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const commit = (name) => {
    const n = String(name || '').trim();
    if (!n) return;
    onAdd(n);
    setDraft('');
    setOpen(false);
  };
  const muted = 'var(--chart-subtle, var(--ds-gray-700))';
  const rule = { borderColor: 'var(--chart-rule, var(--ds-gray-400))' };
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full min-h-0 h-9 rounded-lg border border-dashed cursor-pointer bg-transparent text-label-12 font-semibold"
        style={{ ...rule, color: muted, marginTop: 4 }}
      >
        + Add section
      </button>
    );
  }
  return (
    <div className="rounded-lg border p-2" style={{ ...rule, marginTop: 4 }}>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {['Intro', 'Verse', 'Pre Chorus', 'Chorus', 'Bridge', 'Instrumental', 'Tag', 'Outro'].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => commit(t)}
            className="min-h-0 h-7 px-2 rounded-md border cursor-pointer text-label-11 font-semibold bg-transparent"
            style={{ ...rule, color: 'var(--chart-text, var(--ds-gray-1000))' }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(draft); }
            if (e.key === 'Escape') { e.preventDefault(); setDraft(''); setOpen(false); }
          }}
          placeholder="Or type a name…"
          aria-label="New section name"
          className="flex-1 min-h-0 h-7 rounded-md border px-2 bg-transparent outline-none text-label-12"
          style={{ ...rule, color: 'var(--chart-text, var(--ds-gray-1000))' }}
        />
        <button
          type="button"
          onClick={() => { setDraft(''); setOpen(false); }}
          className="min-h-0 h-7 px-2 rounded-md border cursor-pointer text-label-11 font-semibold bg-transparent"
          style={{ ...rule, color: muted }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function BarField({ value, onCommit, width, label, prefix = '', inputMode }) {
  const incoming = String(value ?? '');
  const [draft, setDraft] = useState(incoming);
  // Re-seed when the song's value changes underneath (a different song, or the
  // practice row saving a tapped tempo) WITHOUT clobbering what is being typed.
  // Two state slots rather than a ref: adjusting state during render is the
  // documented React pattern for this, and reading a ref during render is not.
  const [seen, setSeen] = useState(incoming);
  if (incoming !== seen) {
    setSeen(incoming);
    setDraft(incoming);
  }
  const commit = () => onCommit(draft);
  return (
    <span className="inline-flex items-center" style={{ color: 'var(--chart-text, var(--ds-gray-1000))' }}>
      {prefix && <span aria-hidden="true">{prefix}</span>}
      <input
        value={draft}
        aria-label={label}
        inputMode={inputMode}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === 'Escape') { setDraft(String(value ?? '')); e.currentTarget.blur(); }
        }}
        className="min-h-0 h-[20px] px-1 rounded border bg-transparent text-label-11 tabular-nums text-center outline-none focus:border-[var(--color-brand)]"
        style={{ width, borderColor: 'var(--chart-rule, var(--ds-gray-400))', color: 'inherit' }}
      />
    </span>
  );
}

export default function Reader({
  song: songProp,
  arrangementId,
  myInstrument = null,
  settings,
  onUpdateSettings,
  onExit,
  embedded = false,
  // The Song Hub's Chart / Lyrics tabs. When the host NAMES a mode it wins over
  // the global `showChords` setting — otherwise a toggle flipped on some other
  // surface silently turns the Chart tab into a second Lyrics tab, which is
  // exactly what it was doing.
  displayMode = null,
  selectedKey,
  onSelectKey,
  footer,
  // Element 10, 'swipe': a horizontal-dominant swipe on the chart advances.
  // Vertical scroll is untouched — the gesture only fires past a threshold
  // where |dx| clearly beats |dy|.
  onSwipeLeft,
  onSwipeRight,
  // The Song Hub owns the Aa button when embedded and hands its anchor rect
  // down, exactly as it did to ChartView.
  aaAnchor: hostAaAnchor,
  onAaClose,
  // Element 8b's set bar. It renders ABOVE the title row — `ReaderTopBar` takes
  // it as `aboveBar` — and it replaces nothing: the song's ribbon keeps its
  // place below (SET / HEADER / STRUCTURE). Only the setlist can build it; the
  // reader knows one song.
  aboveBar = null,
  // The rail opener, for the same reason: only the host knows there IS a set.
  // Sits beside ☰ in the bar's left cluster.
  railButton = null, progress = null,
  // 'live' | 'practice'. Until now the reader had ONE behaviour and three route
  // names (`setlist-play`, `setlist-performance`, `setlist-practice`), which is
  // why every practice-only decision — writing a note, switching arrangement —
  // had nowhere to attach: the reader could not tell which one it was in.
  mode = 'live',
  // Element 12: a tapped tempo writes back to the song (owner, 2026-08-01), so
  // the reader needs a way to save one. Absent → the tempo stays session-only.
  onUpdateSong = null,
  // Edit mode's fork. Only the host can build it: it needs the REAL v2 song
  // from state, not this resolved single-arrangement view.
  onSaveAsArrangement = null,
  // Lets the host lock ITS controls while an edit is open (the setlist's nav
  // and rail). Same reason the reader holds its own ✕.
  onEditingChange = null,
  // Element 28: where a locked control in the ☰ sends you. Absent → the lock
  // is stated but not sellable.
  onUpgrade = null,
}) {
  const scrollRef = useRef(null);
  const touchRef = useRef(null);
  const onTouchStart = useCallback((e) => {
    const t0 = e.touches?.[0];
    touchRef.current = t0 ? { x: t0.clientX, y: t0.clientY } : null;
  }, []);
  const onTouchEnd = useCallback((e) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t1 = e.changedTouches?.[0];
    if (!t1) return;
    const dx = t1.clientX - start.x;
    const dy = t1.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    if (dx < 0) onSwipeLeft?.(); else onSwipeRight?.();
  }, [onSwipeLeft, onSwipeRight]);
  // The chrome is sticky at the top of the scroller, so anything else that
  // pins — the section headings — must pin BELOW it, and any scroll-to must
  // stop below it too. Measured rather than hard-coded: the bar's height
  // changes with the ribbon style and with the phone/desktop padding.
  const headRef = useRef(null);
  const [headH, setHeadH] = useState(0);
  // The scroller's VISIBLE height, for the desktop ☰ panel.
  //
  // It was `calc(100vh - headH)`, and `100vh` is the whole window — but the
  // reader sits inside the app shell, so the scroller is shorter than that.
  // The panel came out taller than the space it had, its bottom fell below the
  // fold, and reaching it meant scrolling the CHART: two scrollbars for one
  // panel (owner, 2026-08-04: *"We have a double scroll problem now"*). The
  // honest number is the scroller's own client height.
  const [viewH, setViewH] = useState(0);
  // …MINUS the bottom block. Measured, for the same reason `headH` is.
  //
  // The scroller is a flex COLUMN of three children: the header, the row that
  // holds the chart (and the ☰ panel), and the sticky bottom block — nav bar,
  // practice row, bottom ribbon. `sticky bottom-0` is still IN FLOW, so that
  // block takes real height in the column. A panel sized `viewH - headH`
  // therefore makes the column `headH + (viewH - headH) + footH` tall and the
  // reader overflows by exactly the height of the nav bar. Measured in
  // Chromium at 1280×900: 74 + 826 + 49 = 949 against a 900px scroller — 49px
  // of chart scroll that only exists while the ☰ is open, on top of the
  // panel's own scroll. That is the second scrollbar.
  const [footH, setFootH] = useState(0);
  // The RESTING height of that block — what it measures while you are just
  // reading, with no click row and no edit mode.
  //
  // ⚠ The floating controls are anchored above the bottom block, and the block
  // changes height for reasons that have nothing to do with them. Entering edit
  // mode REMOVES the nav row, so `footH` collapsed and the circles fell to the
  // bottom of the screen — the button you had just pressed moved out from under
  // your thumb as a result of pressing it. Opening the click pushed them the
  // other way. Two adjacent buttons, two opposite motions, neither asked for
  // (owner, 2026-08-09: *"right now the buttons are a bit strange"*).
  //
  // So the anchor has a FLOOR: the circles never sit lower than they do at
  // rest. Edit mode no longer moves them at all, and the only thing that does
  // is the click row — one motion, in one direction, caused by the one button
  // that means "make room for a bar". It costs no layout: this moves a
  // button's offset, it does not reserve space.
  const [restH, setRestH] = useState(0);
  const modeRef = useRef({ editing: false, practiceOpen: false });
  // The ☰ menu, anchored to its button. Standalone this opens `ReaderMenu` —
  // the reader's own four-row menu. EMBEDDED (the Song Hub, the side peek) the
  // host owns the Aa button and passes a rect down, and that still opens
  // `AaMenu`: the hub is a browsing surface with its own fixed look, and giving
  // it the reader's menu would reconnect the two surfaces that were
  // deliberately disconnected (`docs/READER.md` → "The hub view").
  const [ownAaAnchor, setOwnAaAnchor] = useState(null);
  // Element 28: which shape the ☰ takes. Below 700 it DOCKS under the reader
  // (the screen splits 70/30); above it is a popover anchored to the button.
  // 700 and not 768 for the reason it always was — between 640 and 700 the
  // popover is wider than the room beside the ☰.
  // Where the ☰ goes: docked along the bottom, or a side panel.
  //
  // ⚠ Tablet PORTRAIT docks too (owner, 2026-08-08). A side panel eats width
  // from a column that is already narrow when the tablet is stood up, and the
  // reach argument is the same as a phone's — the thumb is at the bottom of the
  // device, not beside the chart. Landscape keeps the side panel, where width
  // is the thing there is plenty of.
  const menuDocks = useMediaQuery('(max-width: 699.98px), (max-width: 1024px) and (orientation: portrait)');
  // How tall the docked ☰ actually is, for the one thing that floats above it.
  // A percentage in a stylesheet is not a number you can do arithmetic with
  // somewhere else — `flex: 0 0 40%` resolves against the ROOT, and every other
  // height in this file is measured off the SCROLLER. Measure the box.
  const [dockH, setDockH] = useState(0);
  // Element 11 — the chord you tapped, and where it was.
  const [tappedChord, setTappedChord] = useState(null);
  const { allowed: canSeeShapes } = useEntitlement('chord-diagrams');
  const onChordTap = useCallback((chord, rect) => {
    setTappedChord(prev => (prev?.chord === chord ? null : { chord, rect }));
  }, []);
  const wide = useMediaQuery('(min-width: 768px)');

  // Callers should pass a resolved arrangement view; accept a raw v2 song too,
  // because getting it wrong renders a silently blank chart.
  const song = songProp?.arrangements ? resolveSongView(songProp, arrangementId) : songProp;

  // ── Element 12 — practice tools ──────────────────────────────────────────
  // Round 1 is the click plus a tempo, and the backing track plus a speed. No
  // count-in, no section loop, no wake lock — those were explicitly out.
  //
  // Nothing here is persisted, by decision: the tempo re-seeds from the song and
  // the click STOPS on a song change, so there is no stored knob to sync and
  // no way to walk into the next song with a click you forgot was running.
  const [practiceOpen, setPracticeOpen] = useState(false);
  const metronome = useMetronome();

  // The tempo is DERIVED, not re-seeded by an effect. It is stamped with the
  // song it belongs to, so arriving at a new song falls straight back to that
  // song's written tempo — no effect, no render with last song's number in it.
  const songId = song?.id;
  const songTempo = song?.tempo;
  const writtenBpm = clampTempo(songTempo || 100);
  const [tempoSet, setTempoSet] = useState(null);
  const bpm = tempoSet?.id === songId ? tempoSet.bpm : writtenBpm;

  // The icon OPENS the row and nothing more. It used to start the click too,
  // which meant a tap to see the tempo filled a quiet room with a click — the
  // tool announcing itself before being asked. Starting is the row's own play
  // button. Closing still stops, because a click with no visible control is
  // worse than no click.
  const togglePractice = useCallback(() => {
    if (practiceOpen) metronome.stop();
    setPracticeOpen(o => !o);
  }, [practiceOpen, metronome]);

  const setTempo = metronome.setTempo; // stable; the metronome object itself is not
  const changeBpm = useCallback((next) => {
    const v = clampTempo(next);
    setTempoSet({ id: songId, bpm: v });
    setTempo(v);
  }, [songId, setTempo]);

  // A click left running from the last song is worse than silence: it is
  // confidently wrong. Stopping the audio engine is a real external-system
  // sync, so it IS an effect — unlike the tempo, which is derived above.
  const stopClick = metronome.stop;
  useEffect(() => { stopClick(); }, [songId, stopClick]);

  // ── A new song starts at the top ─────────────────────────────────────────
  // Owner, 2026-08-05, prio 0: *"when I click next to the next song, it won't
  // go back to the top"*. Nothing ever reset it.
  //
  // The reader is not remounted between songs — `SetlistReader` renders the
  // same component in the same slot with a different `song`, which is what
  // keeps the chrome, the ☰ and the metronome alive across a set. The scroller
  // is therefore the same DOM node, and a DOM node keeps its `scrollTop`. So
  // song two opened wherever song one was left: three verses down, mid-chorus,
  // or past its own end if it was shorter.
  //
  // LAYOUT effect, and a direct assignment rather than `scrollTo({ behavior:
  // 'smooth' })`: this must land before the browser paints the new song, or the
  // band sees the wrong part of it and a scroll animation chasing it. Smooth
  // scrolling is for a jump you asked for; arriving at a song is not one.
  useLayoutEffect(() => {
    const sc = scrollRef.current;
    if (sc) sc.scrollTop = 0;
  }, [songId]);

  // The scroller's visible height, for the desktop ☰ panel's sticky box.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const h = el.clientHeight || 0;
      setViewH(prev => (Math.abs(prev - h) <= 0.5 ? prev : h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Trailing space, measured ─────────────────────────────────────────────
  // Owner, 2026-08-05: *"clicking on a chip at the song map won't fully scroll
  // to that item"*. His guess was the header's height; the header is innocent —
  // measured in Chromium, a jump lands the section exactly 8px under it whether
  // the set bar is on or off. What actually happens is that the LAST sections
  // have nothing below them to scroll into: the chart used to carry a flat
  // `60vh` of trailing space, and only where headings pin, which is phones. On
  // a desktop, clicking the final chip left the section **536px** below the
  // header with the scroller already at its maximum.
  //
  // A flat pad on every device is not the answer either — it would be a screen
  // of blank paper on a desktop, and on a song that ALMOST fits it invents a
  // scroll where there was none, which is the "mini scroll" complaint from the
  // other direction. So it is measured, and it is exactly what the promise
  // costs: enough that the last section's top can reach the pin line, and
  // nothing when the song already fits.
  const chartRef = useRef(null);
  // Element 5: "Add note" is a MODE, not a per-line affordance.
  //
  // ⚠ The first cut showed a `+` in the gutter of the section you were
  // reading, via `useActiveSection` — which carries a `scrollable` guard from
  // element 4 ("a song that fits highlights nothing"). On a tablet in two
  // columns the song usually FITS, so nothing was ever active and the `+`
  // appeared nowhere (owner, 2026-08-08: *"I can see them, but only on
  // mobile"*). One always-visible action that then asks WHICH LINE is
  // independent of whether the song scrolls, which is why it works at
  // every width.
  // null | 'note' (a line) | 'cue' (a section). One mode, because the two
  // targets sit inches apart and lighting both at once put ~40 affordances on
  // a song at the same time.
  const [tailPad, setTailPad] = useState(0);
  // What we last applied, so the natural height can be recovered from a
  // measurement that includes it. Read inside a ResizeObserver, never in render.
  const tailPadRef = useRef(0);

  // The bottom block's height. A CALLBACK ref, not `useRef` + an effect: the
  // block is conditional (no nav bar in the hub, none on a single song) and it
  // grows when the practice row opens, so the observer has to follow the node
  // in and out of the tree rather than being bound once on mount. React 19
  // runs the returned cleanup when the node detaches.
  const footRef = useCallback((el) => {
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(entries => {
      // BORDER box — the block carries a top border and the safe-area inset,
      // and both are height the chart doesn't get. Raw, never rounded: see the
      // note on `headH`.
      const box = entries[0]?.borderBoxSize?.[0]?.blockSize;
      const h = box ?? el.getBoundingClientRect().height ?? 0;
      setFootH(prev => (Math.abs(prev - h) <= 0.5 ? prev : h));
      // ...and the RESTING height, captured only while nothing is adding to the
      // block, so the floor is "the bar you always have" and never "the tallest
      // it ever got". See `restH`.
      const { editing: isEditing, practiceOpen: isPractice } = modeRef.current;
      if (h && !isEditing && !isPractice) {
        setRestH(prev => (Math.abs(prev - h) <= 0.5 ? prev : h));
      }
    });
    ro.observe(el);
    return () => { ro.disconnect(); setFootH(0); };
  }, []);

  // The docked ☰'s height. Same shape as `footRef` and for the same reason: the
  // dock comes and goes with the menu, so the observer has to follow the node.
  // The cleanup zeroing it is what drops the FAB back down when the menu closes.
  const dockRef = useCallback((el) => {
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(entries => {
      const box = entries[0]?.borderBoxSize?.[0]?.blockSize;
      const h = box ?? el.getBoundingClientRect().height ?? 0;
      setDockH(prev => (Math.abs(prev - h) <= 0.5 ? prev : h));
    });
    ro.observe(el);
    return () => { ro.disconnect(); setDockH(0); };
  }, []);

  const config = useMemo(
    () => resolveReaderConfig(settings, { wide, embedded, myInstrument, mode }),
    [settings, wide, embedded, myInstrument, mode]
  );

  useEffect(() => {
    const el = chartRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const applied = tailPadRef.current;
      // The song's own height, with our own padding taken back off.
      const natural = el.getBoundingClientRect().height - applied;
      const band = Math.max(0, viewH - headH - footH);
      const last = el.querySelector('[data-section-index]:last-child');
      const lastH = last ? last.getBoundingClientRect().height : 0;
      // `+ 4` of hysteresis: a song that lands within a few pixels of the band
      // must not flip the padding on and off as the two measurements chase
      // each other.
      //
      // ⚠ ONE COLUMN ONLY (owner, 2026-08-08: *"on mobile or 1 column we could
      // scroll to the bottom of the page so the last item could be scrolled. On
      // tablet on two columns is not needed like that, scroll just to get into
      // view"*). The pad exists so the LAST section's top can reach the pin
      // line, which matters when sections stack down one column. In two columns
      // the last section sits at the foot of the RIGHT column with a whole
      // column of song beside it — the pad buys nothing and costs a screen of
      // blank paper at the end of every song.
      //
      // ⚠ Two columns still get a FLOOR, not zero (owner, 2026-08-08: *"right
      // now is quite 0, especially for when we have the floating pill, it
      // should at least clear it"*). The footer floats over the chart, so a
      // last line that ends exactly at the scroller's bottom sits under it.
      // It clears the pill and its safe-area inset without inventing the
      // screen of blank paper the full pad was costing.
      //
      // ⚠ 130, up from 72: the floating controls became TWO circles (48 + 40 +
      // 10 gap = 98, plus the 12px inset and a little air). They sit over the
      // note GUTTER, which in edit mode is the thing you are tapping — so the
      // last line's note cell has to come out from under them, not merely the
      // last lyric. A constant that tracks a layout has to move when the layout
      // does; this one is derived from `ReaderActions`.
      const FLOAT_CLEARANCE = 130;
      const want = config.columns >= 2
        ? (natural > band + 4 ? FLOAT_CLEARANCE : 0)
        : (natural > band + 4 ? Math.max(FLOAT_CLEARANCE, band - lastH - 8) : 0);
      if (Math.abs(want - applied) <= 2) return;
      tailPadRef.current = want;
      setTailPad(want);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // `songId` and the layout knobs, because a shorter song, one column instead
    // of two, or the ☰ opening all change what "the last section" is and how
    // tall it is.
  }, [viewH, headH, footH, songId, config.columns, config.flow, config.repeats, menuDocks, ownAaAnchor]);

  // ── Edit mode ────────────────────────────────────────────────────────────
  // Not a panel. The owner's shape: press edit and the CHART becomes editable —
  // the tempo and time in the bar turn into fields, each section grows a play-
  // order handle. Element 3 decided against a sheet: see `docs/READER.md`.
  //
  // Edits apply IMMEDIATELY to the song (owner: "it should change the song").
  // `editBase` is the snapshot taken on entry, and it exists for exactly one
  // reason: "Save as a new arrangement" has to be able to put the original
  // back. Stamped with the song id like `tempoSet`, so arriving at a different
  // song can never restore this one's fields over it.
  const [editSession, setEditSession] = useState(null);
  // Element 11 vs edit mode: the SAME gesture, two meanings, separated by the
  // mode. Tapping a chord shows its shape while reading, and opens the editor's
  // own `ChordPicker` while editing. That is the point of having a mode, and
  // the owner signed it off knowing so. Declared HERE, above every callback
  // that clears it — the compiler lint rejects reaching a setter defined below.
  const [chordEdit, setChordEdit] = useState(null);
  const canEdit = !embedded && config.can.editSong && !!onUpdateSong;
  const editing = canEdit && editSession?.id === songId;
  const editBase = editing ? editSession.base : null;

  // What the block is doing right now, for the observer below to read. A REF
  // and not a dependency: `setRestH` has to happen where the height is
  // measured, and calling setState straight out of an effect body is a
  // cascading render (the React compiler rule that caught this).
  useEffect(() => { modeRef.current = { editing, practiceOpen }; }, [editing, practiceOpen]);

  // Report the mode outward, so the HOST can lock its own controls (the
  // setlist's nav and rail). An effect, because it synchronises an external
  // system rather than deriving anything of ours.
  useEffect(() => { onEditingChange?.(editing); }, [editing, onEditingChange]);

  // The ☰ → "The screen" row. Only where the reader owns the screen: embedded
  // in the hub it is a card in a page, and holding a wake lock for a card is
  // the app quietly deciding your phone shouldn't sleep while you browse.
  useWakeLock(!embedded && settings?.keepAwake === true);

  const { ordered, offsets, repeats } = useMemo(() => buildSongFlow(song), [song]);

  // The active section IS whichever heading is pinned — so the reading line
  // sits at the pin, not a third of the way down. Otherwise the ribbon
  // highlights one section while the pinned heading names another.
  // Scroll-spy is a READER behaviour. Embedded (the Song Hub's chart tab, the
  // editor preview, the side peek) the song sits still and complete, so there is
  // no "where am I" to answer and nothing should be highlighted.
  const activeSection = useActiveSection(
    scrollRef,
    `${song?.id || ''}:${config.columns}:${config.sticky}`,
    config.sticky ? 0.02 : 0.28,
    !embedded,
    // Where headings PIN is the reading line, exactly. Anything else and the
    // ribbon changes at a different moment from the heading it points at.
    config.sticky ? headH : null,
  );

  useEffect(() => {
    const el = headRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(entries => {
      // BORDER box, not content box. `contentRect` excludes the header's
      // 1px bottom border, so `stickyTop` landed a pixel short of the header's
      // real bottom edge and the pinned heading sat under the divider instead
      // of below it. `borderBoxSize` is the honest number; the bounding rect is
      // the fallback for engines that don't report it.
      const box = entries[0]?.borderBoxSize?.[0]?.blockSize;
      const h = box ?? el.getBoundingClientRect().height ?? 0;
      // NO rounding. beta.41 did `Math.ceil`, reasoning that the heading should
      // never overlap the divider — which is backwards. On a fractional-DPR
      // phone the header is e.g. 73.33px tall, ceil gives 74, and the heading
      // pins 0.67px BELOW the header's bottom edge, showing a sliver of the
      // chart scrolling behind it. That sliver is the "small line between the
      // hairline and the heading pin", and beta.41 created it rather than
      // fixing it. Abutting sticky edges must OVERLAP, never abut — the
      // heading pins one pixel high (see `ReaderSection`) and paints over the
      // seam.
      // Measure and store. NOTHING else — see the trap note below the effect.
      setHeadH(prev => (Math.abs(prev - h) <= 0.5 ? prev : h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [embedded]);

  // ⚠ DO NOT "compensate" scrollTop when the sticky header changes height.
  // beta.57 added `scrollTop += delta` inside the observer above for the report
  // that a pinned heading hides behind the map when edit turns the ribbon on,
  // and beta.58 wrote this warning WITHOUT actually taking the line out — so
  // the third round of "not 100% fixed" was the original bug, still running.
  // (Owner, 2026-08-04. Removed for real in beta.59; the rule stands.)
  //
  // The geometry says it cannot help, and it actively hurt:
  //
  //   item at document offset H + k  →  viewport y = H + k - scrollTop
  //   sticky header covers            [0, H]
  //   hidden  ⟺  H + k - scrollTop < H  ⟺  k < scrollTop
  //
  // Grow the header to H + Δ: the item reflows to H + Δ + k and the header
  // covers [0, H + Δ], so hidden ⟺ k < scrollTop — THE SAME CONDITION. The
  // reflow and the taller header cancel exactly. Adding Δ to scrollTop
  // therefore hides a further Δ of the song, which is the reported symptom made
  // worse by the amount the header grew.
  //
  // Which is why the symptom outlived the "fix": scrolling down by Δ pushes the
  // section you are in Δ further past, and a sticky heading RELEASES at the
  // bottom of its own section — so a short section's heading slides up under
  // the header and stays there until you scroll back, exactly as reported. The
  // compensation was not a failed fix, it was the bug.
  //
  // Do not re-add it. If a heading ever hides again, measure `headH`,
  // `scrollTop` and the heading's `getBoundingClientRect().top` across the
  // transition before touching anything.

  // The chart's side padding. 32px is the app-wide `wide-container` value and
  // it stays on wide screens; a phone comes in to 12px so the words start at
  // the edge, except on whichever side the floating structure rail occupies.
  const railSide = config.ribbon === 'left' || config.ribbon === 'right' ? config.ribbon : null;
  // ⚠ NOT `wide ? 32 : 12` any more. Element 4 took the words to the left edge
  // on a phone and left every wider screen at 32px, so an iPad — the device
  // most of this is actually read on — never got it (owner, 2026-08-08: *"we
  // moved the lyrics on mobile to the left, but we never did that on tablet"*).
  // The argument was never about screen size, it was about the right side
  // belonging to notes, and that is true at every width.
  const padLeft = railSide === 'left' ? 32 : 12;
  const padRight = railSide === 'right' ? 32 : 12;

  const jumpTo = useCallback((idx, smooth = true) => {
    const sc = scrollRef.current;
    // ⚠ Scoped to THIS reader's scroller, never `document.getElementById`.
    // Two readers can be mounted at once — the Song Hub keeps its embedded one
    // behind the full-screen one — and both render `id="section-N"`. A document
    // lookup returns the HUB's section, so every jump in full screen was
    // measuring an element in a different scroller and landing nowhere near it.
    // Found while driving the rail's scrub in Chromium, 2026-08-06; the same
    // duplicate cost twenty minutes of mis-measurement the day before.
    const el = sc
      ? sc.querySelector(`[data-section-index="${idx}"]`)
      : document.getElementById(`section-${idx}`);
    if (!el) return;
    if (!sc) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    // Land the section BELOW the sticky chrome. scrollIntoView aligns to the
    // container's top edge, which is behind the header, so the heading you
    // jumped to ended up hidden underneath it.
    // The heading's own top, not the section box's — a heavy section's box
    // starts above its heading (the air it carries is padding). Same anchor the
    // scroll-spy reads, so a jump and the chip it came from cannot disagree.
    const anchor = el.querySelector('[data-section-anchor]') || el;
    const top = anchor.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    // ── Land ON the pin line, one pixel above it — never below ──────────────
    // Owner, 2026-08-06, with a screenshot: *"if I click on verse 2 it scrolls
    // to verse 2 but not quite so I still see verse 1 selected"*. Both halves
    // of that are one number.
    //
    // This used to land the section 8px BELOW the header, as breathing room.
    // But the scroll-spy's rule is "the last section whose top has scrolled
    // ABOVE the reading line" (`useActiveSection`, `top - line <= 1`), and the
    // reading line IS `headH`. A section sitting 8px below it has not reached
    // the line, so the spy keeps reporting the PREVIOUS section: you jump to
    // Verse 2, you are looking at Verse 2, and the ribbon says Verse 1.
    //
    // So the jump lands where a scroll would have put it: top edge one pixel
    // UNDER the header, which is exactly where a sticky heading pins
    // (`stickyTop - 1` in `ReaderSection` — overlap, never abut). The spy then
    // reads `-1 <= 1` and agrees on the same frame, and the 8px of "breathing
    // room" is revealed as what it always was: the gap that made the two
    // halves of "where am I" disagree.
    sc.scrollTo({ top: Math.max(0, top - headH + 1), behavior: smooth ? 'smooth' : 'auto' });
  }, [headH]);

  // ── Scrubbing the side rail ──────────────────────────────────────────────
  // Owner, 2026-08-06: *"do you know what would be cool? to have like a scrub
  // when user clicks and drags the side rail"*. It is, and it is the answer to
  // the question he had parked — what moving between sections in that rail
  // should feel like. A tap is one jump; a drag is the whole song under a
  // thumb, with the chart following live.
  //
  // Hit-tested by COORDINATE (`elementFromPoint` → `[data-slot]`), not by which
  // element the pointer went down on: with pointer capture every move event
  // retargets to the chip you started on, which is exactly what a scrub must
  // not follow.
  //
  // ⚠ NATIVE listeners with `{ passive: false }`, in an effect. React's
  // synthetic touch handlers are passive, so `preventDefault` there is a silent
  // no-op and the page scrolls under the gesture instead of the gesture driving
  // it. Same rule as the ribbon's drag and the pull-to-finish.
  // A CALLBACK ref, like the bottom block's: the rail comes and goes with the
  // setting, so the listeners have to follow the node in and out of the tree
  // rather than being bound once. It re-binds when `jumpTo` changes, which is
  // when `headH` changes — and a jump measured against a stale header lands in
  // the wrong place.
  const scrubRef = useCallback((el) => {
    if (!el) return undefined;
    const state = { on: false, last: null };
    // NEAREST dot to the finger, by geometry — not `elementFromPoint`.
    // A column of 7px dots on a 13px pitch is half gaps, so a hit test that
    // demands a direct hit stalls between every pair of them; and with pointer
    // capture `e.target` is always the chip the gesture STARTED on, which is
    // the one thing a scrub must not follow. Nearest-centre is also what makes
    // it forgiving: the finger is somewhere over the strip, and the strip
    // answers with the section that is closest.
    const slotAt = (y) => {
      let best = null;
      let bestD = Infinity;
      for (const chip of el.querySelectorAll('[data-slot]')) {
        const r = chip.getBoundingClientRect();
        const d = Math.abs((r.top + r.bottom) / 2 - y);
        if (d < bestD) { bestD = d; best = chip; }
      }
      const n = best ? Number(best.getAttribute('data-slot')) : NaN;
      return Number.isNaN(n) ? null : n;
    };
    const move = (e) => {
      if (!state.on) return;
      e.preventDefault();
      const slot = slotAt(e.clientY);
      // Only when it CHANGES: re-jumping to the slot you are already on fights
      // the smooth-scroll you just started and pins the chart mid-flight.
      if (slot == null || slot === state.last) return;
      state.last = slot;
      // Instant, not smooth: a scrub is direct manipulation, and an animation
      // per dot would arrive after the finger had left.
      jumpTo(slot, false);
    };
    const down = (e) => {
      const slot = slotAt(e.clientY);
      if (slot == null) return;
      state.on = true;
      state.last = slot;
      try { el.setPointerCapture?.(e.pointerId); } catch { /* not supported */ }
      jumpTo(slot, false);
    };
    const up = () => { state.on = false; state.last = null; };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [jumpTo]);

  // ── A repeat you asked to see ────────────────────────────────────────────
  // Owner, 2026-08-05, option B: **tapping a Tag opens it in place.**
  //
  // The rejected option was "send them to the first full play", which is what
  // the ribbon did: you tap chip six and land at chip two, and the highlight
  // walks backwards with you. On stage that reads as the app losing your place.
  // Opening it where it stands answers the actual question — "what are the
  // words here" — without moving anyone.
  //
  // A set of PLAY-ORDER SLOTS, not sections: opening the third chorus must not
  // open the second. It is a fact about this reading of this song, so it is
  // dropped when the song changes.
  const [openRepeats, setOpenRepeats] = useState(() => new Set());
  // Dropped on the way IN to a new song, adjusted during render rather than in
  // an effect — the documented pattern for "reset state when a prop changes",
  // and the one `BarField` above already uses. In an effect it is a cascading
  // render, and for one frame the new song would inherit the old song's opened
  // slots.
  const [openFor, setOpenFor] = useState(songId);
  if (openFor !== songId) {
    setOpenFor(songId);
    setOpenRepeats(new Set());
  }
  // The jump has to wait for the section to exist at its new height — expanding
  // a tag into a full section moves everything below it, so a jump measured in
  // the same tick lands at the pre-expansion offset.
  const pendingJumpRef = useRef(null);
  const openRepeat = useCallback((idxOrSlots, thenJump = false) => {
    const slots = Array.isArray(idxOrSlots) ? idxOrSlots : [idxOrSlots];
    if (thenJump) pendingJumpRef.current = slots[0];
    setOpenRepeats(prev => {
      if (slots.every(i => prev.has(i))) return prev;
      const next = new Set(prev);
      slots.forEach(i => next.add(i));
      return next;
    });
  }, []);
  // Which slots are drawn as ONE pill, right now. Recomputed from the open set,
  // not from the song: a run is a stretch of adjacent slots that are all still
  // tags. Open one and it leaves the run; close it and it rejoins whichever
  // neighbours are also closed.
  const runs = useMemo(
    () => repeatRuns(ordered, repeats, (i) => !openRepeats.has(i)),
    [ordered, repeats, openRepeats],
  );

  // …and back. An opened repeat had no way to close until the song changed
  // (owner, 2026-08-06: *"Is there a way to collapse back sections?"*).
  const closeRepeat = useCallback((idxOrSlots) => {
    const slots = Array.isArray(idxOrSlots) ? idxOrSlots : [idxOrSlots];
    setOpenRepeats(prev => {
      if (!slots.some(i => prev.has(i))) return prev;
      const next = new Set(prev);
      slots.forEach(i => next.delete(i));
      return next;
    });
  }, []);
  useEffect(() => {
    const idx = pendingJumpRef.current;
    if (idx == null) return;
    pendingJumpRef.current = null;
    jumpTo(idx);
  }, [openRepeats, jumpTo]);

  // What a ribbon chip does. Everything that is not a repeat — and every repeat
  // already drawn in full — is a plain jump.
  const jumpToSlot = useCallback((idx) => {
    const first = repeats[idx];
    const isRepeat = first != null && first >= 0 && !openRepeats.has(idx);
    // Hidden draws nothing at all, so there is nowhere to open: the only
    // honest destination is the one place those words are on the page (owner,
    // Q2, 2026-08-05).
    if (isRepeat && config.repeats === 'hide') { jumpTo(first); return; }
    if (isRepeat && config.repeats === 'condensed') { openRepeat(runs[idx]?.slots || idx, true); return; }
    jumpTo(idx);
  }, [repeats, runs, openRepeats, config.repeats, jumpTo, openRepeat]);

  // ── Edit mode's operations ───────────────────────────────────────────────
  // Every edit pushes the state BEFORE it onto the session's history, which is
  // what Undo pops (owner, 2026-08-03: "we also need like undo buttons for when
  // doing a mistake"). The stack lives on the edit session, so it is discarded
  // with the session rather than outliving the mode it belongs to.
  const writeSong = useCallback((patch) => {
    if (!song) return;
    const before = snapshotEditable(song);
    setEditSession(prev => (prev && prev.id === songId
      ? { ...prev, history: [...prev.history, before] }
      : prev));
    onUpdateSong?.({ ...song, ...patch });
  }, [song, songId, onUpdateSong]);

  // useMemo so the empty case is a STABLE reference: a fresh `[]` every render
  // would change `undo`'s identity on every render.
  const history = useMemo(() => (editing ? editSession.history : EMPTY), [editing, editSession]);

  const undo = useCallback(() => {
    if (!history.length || !song) return;
    const prevState = history[history.length - 1];
    setEditSession(prev => (prev ? { ...prev, history: prev.history.slice(0, -1) } : prev));
    onUpdateSong?.({ ...song, ...prevState });
  }, [history, song, onUpdateSong]);

  // Cancel puts EVERYTHING back and leaves. It can exist at all only because
  // edit mode snapshots on entry — the same snapshot the fork uses.
  const cancelEdit = useCallback(() => {
    setChordEdit(null);
    if (editBase && song) onUpdateSong?.({ ...song, ...editBase });
    setEditSession(null);
  }, [editBase, song, onUpdateSong]);

  // Cancel moved onto the top bar's ✕, and ✕ has meant "leave the song" in
  // every other mode of this reader for its whole life. Muscle memory does not
  // read labels: the same tap that used to close a chart now discards an edit.
  //
  // ⚠ So it asks — but ONLY when there is something to lose. A confirm on an
  // untouched song is a dialog that teaches people to dismiss dialogs, and the
  // next one they dismiss is this one.
  const confirm = useConfirm();
  const requestCancelEdit = useCallback(async () => {
    if (isDirty(editBase, song)) {
      const ok = await confirm({
        title: 'Discard your changes?',
        description: 'Everything you changed to this song goes back to how it was.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        destructive: true,
      });
      if (!ok) return;
    }
    cancelEdit();
  }, [confirm, cancelEdit, editBase, song]);

  const editStructure = useCallback((op) => {
    // Materialise first: a song played in document order has no `structure` to
    // edit, and without writing the implied order down the first tap lands on
    // an empty array and appears to do nothing.
    const current = materialiseStructure(song, ordered);
    const next = op(current);
    if (next === current) return;              // no-op — don't dirty the song
    // 'custom', or `orderSections` ignores the array we just wrote.
    writeSong({ structure: next, structureMode: 'custom' });
  }, [song, ordered, writeSong]);

  // A section that does not exist yet. `addNewSection` writes `sections` AND
  // `structure` in ONE patch on purpose — sending them as two writes would
  // leave a window where the song names a section it does not have, and
  // `buildSongFlow` drops those, so the new section would flicker or vanish.
  const addSection = useCallback((name) => {
    if (!song) return;
    const next = addNewSection(song, ordered, name);
    if (!next) return;
    writeSong({ sections: next.sections, structure: next.structure, structureMode: next.structureMode });
  }, [song, ordered, writeSong]);

  const applyChord = useCallback((picked) => {
    const meta = chordEdit?.meta;
    setChordEdit(null);
    if (!meta || !song) return;
    // `song.sections`, NOT the play order: a section sung three times is ONE
    // body, so this correctly changes every repeat of it.
    const si = (song.sections || []).indexOf(meta.section);
    const raw = meta.section?.lines?.[meta.line];
    if (si < 0 || typeof raw !== 'string') return;
    // The chart shows a TRANSPOSED chord; the .md holds the written one. Invert
    // exactly the number SectionBlock used — recomposing it here (user
    // transpose + section modulate + mid-section modulate) is three chances to
    // write the wrong chord into somebody's song.
    const stored = meta.transpose ? transposeChord(picked, -meta.transpose) : picked;
    const nextLine = replaceChordInLine(raw, meta.chord, stored);
    if (nextLine === raw) return;              // out of range — write nothing
    const sections = withEditedLine(song.sections, si, meta.line, nextLine);
    if (sections === song.sections) return;
    writeSong({ sections });
  }, [chordEdit, song, writeSong]);

  // A section's words, edited as text. `parseSectionLines` is the same helper
  // the editor's section drawer uses — hand-rolling a `split('\n')` here would
  // flatten tab blocks and modulate markers into plain strings that vanish on
  // the next parse, which is exactly the bug that helper exists to prevent.
  const editSectionLines = useCallback((section, text) => {
    if (!song) return;
    const si = (song.sections || []).indexOf(section);
    if (si < 0) return;
    const lines = parseSectionLines(text);
    const sections = (song.sections || []).map((sec, i) => (i === si ? { ...sec, lines } : sec));
    writeSong({ sections });
  }, [song, writeSong]);

  // ── Element 5: a cue, written from the reader ──────────────────────────────
  //
  // PLAN §1.2 #3d. Until now the only way to write a band cue was the editor's
  // Arrange tab: leave the reader, open the editor, find the section. Measured
  // against production 2026-08-07 — 31 of 350 songs carry a cue and 16 carry an
  // inline note, and the note gutter element 4 paid for is empty on 95% of
  // songs. Reaching it is the reason.
  //
  // Practice only, via `config.can.writeNotes` — the capability was declared in
  // `readerConfig` (live false, practice true, hub false) and read by NOTHING
  // until here. Editing a shared chart mid-service, in a hurry, is the same
  // argument `MissingSongScreen` already uses for refusing "remove from
  // setlist".
  //
  // ⚠ Writes to `song.sections`, NOT the play order: a section sung three times
  // is ONE body, so a cue written on it correctly appears on every repeat.
  const editSectionCue = useCallback((section, text) => {
    if (!song) return;
    const si = (song.sections || []).indexOf(section);
    if (si < 0) return;
    // Capped at the INPUT (parser's CUE_MAX_CHARS) — a cap applied at render is
    // a truncation the writer never sees coming. Trimmed to '' so an emptied
    // field REMOVES the cue rather than leaving a blank one that still
    // reserves the heading's second row.
    const note = String(text || '').slice(0, CUE_MAX_CHARS).trim();
    if (note === (section.note || '')) return;
    const sections = (song.sections || []).map((sec, i) => (i === si ? { ...sec, note } : sec));
    writeSong({ sections });
  }, [song, writeSong]);

  // Element 5: an inline note, written from the reader.
  //
  // The note lives INSIDE the lyric line as `{!text}` — that is the `.md`
  // format, and `extractInlineNotes` strips it at render. So writing one is a
  // string edit on the line: drop whatever marker is there, append the new one.
  //
  // ⚠ Appended at the END of the line, not at a character position. A note
  // belongs to the LINE (element 4 put it in a gutter beside the whole line,
  // not above a word), so where in the string it sits changes nothing about
  // where it renders — and asking the writer to place it would be asking about
  // something they cannot see.
  const editSectionNote = useCallback((section, lineIdx, text) => {
    if (!song) return;
    const si = (song.sections || []).indexOf(section);
    if (si < 0) return;
    const raw = section.lines?.[lineIdx];
    if (typeof raw !== 'string') return;          // a tab or a modulate marker
    const note = String(text || '').slice(0, INLINE_NOTE_MAX_CHARS).trim();
    const bare = raw.replace(/\s*\{![^}]*\}/g, '');
    const nextLine = note ? `${bare} {!${note}}` : bare;
    if (nextLine === raw) return;
    const sections = withEditedLine(song.sections, si, lineIdx, nextLine);
    if (sections === song.sections) return;
    writeSong({ sections });
    // ⚠ Nothing is disarmed here. This used to clear the note mode after every
    // write — "one note per ask" — and that single line was what made the note
    // you had just typed untappable the instant you pressed Enter. There is no
    // mode to clear now: you are editing until you say you are done.
  }, [song, writeSong]);

  // Taking a section out is the one edit you make and immediately doubt, so it
  // gets the app's existing undo toast (`showUndoToast`, the 5s countdown ring
  // used by the editor and the setlist builder) rather than a bespoke one. The
  // undo BUTTON in the edit row still works too — this is the version that
  // finds you, instead of waiting to be found.
  const removeSection = useCallback((idx, section) => {
    const before = materialiseStructure(song, ordered);
    editStructure(st => removeSlot(st, idx));
    showUndoToast({
      title: `${section?.type || 'Section'} removed`,
      // Restores the play order as it was, which is also correct when the
      // removal was refused (a one-section song) — putting back what is already
      // there is a no-op rather than a second edit.
      onUndo: () => writeSong({ structure: before, structureMode: 'custom' }),
    });
  }, [song, ordered, editStructure, writeSong]);

  const toggleEdit = useCallback(() => {
    setChordEdit(null);
    setEditSession(prev => {
      if (prev?.id === songId) return null;
      // Editing takes the screen over, so it closes what it is taking it from
      // (owner, 2026-08-04: "it should close everything else, like the practice
      // strip"). Two bars at the bottom edge, never three — element 12's rule,
      // and edit mode is the third bar if the practice row stays open.
      setPracticeOpen(false);
      // ...and the ☰, for the same reason plus a sharper one: the ☰ is DISABLED
      // while editing, so a dock left open would hold 30% of the screen with no
      // way to shut it (owner, 2026-08-04: "the edit button should overwrite the
      // settings and close it").
      setOwnAaAnchor(null);
      stopClick();
      return { id: songId, base: snapshotEditable(song), history: [] };
    });
  }, [songId, song, stopClick]);

  // Leaving a song leaves its edit session behind. `editing` is derived from
  // the stamp rather than cleared by an effect, so this needs no cleanup — the
  // session simply stops matching.

  // ── Pull down to finish ──────────────────────────────────────────────────
  // Owner, 2026-08-04: *"one cool feature that I would like to implement for
  // mobile is drag down to exit mode"* — and, when the pull-to-refresh clash
  // was raised: *"what if it's an installed pwa? Then we have no drag to
  // refresh, and I was thinking that you drag after you cannot scroll anymore.
  // ... that's my idea of pull to exit"*.
  //
  // So it is armed ONLY at `scrollTop === 0`, which is the "cannot scroll
  // anymore" the owner named, and it takes the gesture with `preventDefault`
  // once engaged — the scroller is already `overscroll-contain`, so in an
  // installed PWA there is no browser refresh to fight, and in a tab the
  // contain keeps the pull from reaching the document.
  //
  // Everything below runs OUTSIDE React on purpose:
  //
  //   · non-passive `touchmove`, because React's synthetic touch listeners are
  //     passive and `preventDefault` on them is a no-op that logs a warning;
  //   · the header is moved by writing `transform` on the node, not by state.
  //     A finger produces ~120 moves; 120 renders of a whole chart would drop
  //     the frame rate to where the pull visibly lags the thumb;
  //   · MOUNT-ONCE, reading the moving parts out of a ref — the ribbon's drag
  //     was broken for two rounds by an effect that re-ran and cleaned up its
  //     own gesture mid-drag (`StructureRibbon`). Same rule here.
  const pullRef = useRef(null);
  const hintRef = useRef(null);
  const pullLiveRef = useRef({});
  useEffect(() => { pullLiveRef.current = { editing, done: toggleEdit }; });

  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return undefined;
    // Damped, so the header follows the thumb at roughly half speed and the
    // gesture feels like it is resisting rather than sliding.
    const DAMP = 0.45;
    // On the DAMPED distance: ~98px of actual finger travel. Under a full
    // thumb-length, over anything you could do by accident while scrolling.
    const TRIGGER = 44;
    // ⚠ Move the WHOLE READER, not the header (owner, 2026-08-08: *"it only
    // drags the header, it should drag everything"*). The gesture is "pull the
    // page down"; pulling one strip away from the words underneath it reads as
    // the header coming loose, not as the page moving. The scroller is the
    // right node because the header is INSIDE it — one transform carries the
    // bar, the ribbon and the chart together — and the pull only arms at
    // `scrollTop === 0`, so nothing is scrolled out from under the transform.
    // ── Making the gesture legible ────────────────────────────────────────
    // The first cut moved the page and swapped a line of text at the halfway
    // point, and the owner's read was *"is cool but is not understandable"*.
    // The problem was that nothing showed HOW FAR through you were: the label
    // flipped at 44px with no warning either side, so the gesture had two
    // states and no middle.
    //
    // Now the pill itself is the progress bar. `p` (0 → 1) drives three things
    // at once, all written straight to the node — a finger produces ~120 moves
    // and this must not re-render:
    //   · the arrow ROTATES 0 → 180°, so it points back the way you came the
    //     moment releasing would do something;
    //   · the pill FILLS from the edge, so distance is visible, not inferred;
    //   · it settles at 1 with a small scale pop, which is the "you're there"
    //     that the label change was trying to be on its own.
    const paint = (d) => {
      const prog = Math.max(0, Math.min(1, d / TRIGGER));
      if (sc) sc.style.transform = d ? `translateY(${d}px)` : '';
      const hint = hintRef.current;
      if (!hint) return;
      hint.style.opacity = String(Math.min(1, d / 20));
      // The pill grows toward its armed size rather than jumping to it.
      hint.style.transform = `scale(${(0.9 + prog * 0.1).toFixed(3)})`;
      const fill = hint.querySelector('[data-pull-fill]');
      if (fill) fill.style.transform = `scaleX(${prog.toFixed(3)})`;
      const arrow = hint.querySelector('[data-pull-arrow]');
      if (arrow) arrow.style.transform = `rotate(${(prog * 180).toFixed(1)}deg)`;
      const label = hint.querySelector('[data-pull-label]');
      if (label) label.textContent = prog >= 1 ? 'Release to finish' : 'Keep pulling';
    };
    const cancel = () => { pullRef.current = null; paint(0); };
    const onStart = (e) => {
      if (!pullLiveRef.current.editing || sc.scrollTop > 0 || e.touches?.length !== 1) return;
      const t = e.touches[0];
      pullRef.current = { y: t.clientY, d: 0 };
    };
    const onMove = (e) => {
      const p = pullRef.current;
      if (!p) return;
      if (!pullLiveRef.current.editing) { cancel(); return; }
      const t = e.touches?.[0];
      if (!t) return;
      const dy = t.clientY - p.y;
      // Upward, or the finger already scrolled the chart: this was a scroll.
      // Give it up rather than arbitrating it for the rest of the gesture.
      if (dy <= 0 || sc.scrollTop > 0) { cancel(); return; }
      e.preventDefault();
      p.d = Math.min(dy * DAMP, 120);
      paint(p.d);
    };
    const onEnd = () => {
      const p = pullRef.current;
      pullRef.current = null;
      if (!p) return;
      // Animate the snap back, then take the transition off again so the next
      // pull tracks the thumb instead of easing behind it. The pill eases with
      // it — during the drag it is written raw every frame, and only on
      // RELEASE is it allowed to animate.
      const hint = hintRef.current;
      const eased = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
      sc.style.transition = eased;
      if (hint) {
        hint.style.transition = `opacity 160ms linear, ${eased}`;
        const fill = hint.querySelector('[data-pull-fill]');
        const arrow = hint.querySelector('[data-pull-arrow]');
        if (fill) fill.style.transition = eased;
        if (arrow) arrow.style.transition = eased;
      }
      paint(0);
      setTimeout(() => {
        sc.style.transition = '';
        if (!hint) return;
        hint.style.transition = 'opacity 120ms linear';
        const fill = hint.querySelector('[data-pull-fill]');
        const arrow = hint.querySelector('[data-pull-arrow]');
        if (fill) fill.style.transition = '';
        if (arrow) arrow.style.transition = '';
      }, 240);
      if (p.d >= TRIGGER) pullLiveRef.current.done?.();
    };
    sc.addEventListener('touchstart', onStart, { passive: true });
    sc.addEventListener('touchmove', onMove, { passive: false });
    sc.addEventListener('touchend', onEnd);
    sc.addEventListener('touchcancel', onEnd);
    return () => {
      sc.removeEventListener('touchstart', onStart);
      sc.removeEventListener('touchmove', onMove);
      sc.removeEventListener('touchend', onEnd);
      sc.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const saveAsArrangement = useCallback(() => {
    if (!editBase || !onSaveAsArrangement) return;
    onSaveAsArrangement({
      songId,
      arrangementId: song?._arrangementId,
      // The CURRENT (edited) arrangement becomes the new one; the original is
      // put back to how it was when edit mode opened. The alternative — fork
      // first, then edit — would mean deciding "correction or arrangement?"
      // before making the change, which is the question nobody can answer yet.
      restore: editBase,
    });
    setEditSession(null);
  }, [editBase, onSaveAsArrangement, songId, song]);

  // ── What the chart SHOWS ─────────────────────────────────────────────────
  // One mode with three states, not a boolean, and it reads `displayMode`.
  //
  // The bug this replaces (owner, 2026-08-04: *"I've lost the chords, why?"*):
  // the ☰'s Show control and the role picker both write **`displayMode`**, and
  // standalone this line read **`config.display.showChords`** — which is
  // `settings.showChords`, a different key entirely. So picking "Chords +
  // lyrics" did nothing, and once `showChords` had been set false anywhere
  // (`PerformanceView`/`PracticeView` both write it) the reader had no way back
  // to chords at all. `displayMode` is the richer of the two and the one every
  // control writes, so it wins; `showChords` stays as the fallback for a
  // profile that only ever set the old boolean.
  //
  // The host's tab still beats both — the hub's Lyrics tab is not a preference.
  const shows = displayMode
    || settings?.displayMode
    || (config.display.showChords === false ? 'lyrics' : 'chords');
  const showChords = shows !== 'lyrics';
  // 'chordsonly' was offered by every Show control and was impossible to
  // render: `ReaderSection` passed a bare `showLyrics`, i.e. always true.
  const showLyrics = shows !== 'chordsonly';

  const transpose = (!selectedKey || !song?.key) ? 0 : semitonesBetween(song.key, selectedKey);

  // Element 19's capo is resolved just below `displayKey` — it needs it.

  const tabColors = {
    ...(settings?.tabStringColor ? { line: settings.tabStringColor, label: settings.tabStringColor } : null),
    ...(settings?.tabNumberColor ? { number: settings.tabNumberColor } : null),
    ...(settings?.tabBg ? { bg: settings.tabBg } : null),
  };

  // ── Element 3 + 8 — key changes on the map ───────────────────────────────
  // Owner, 2026-08-05: "I think I like the idea of key change, what do you
  // think, should we do it?" — yes, and small.
  //
  // A mark sits BEFORE the first slot that plays in a new key, and it names the
  // key you land in, never the interval: element 8's rule, "we're in B now"
  // beats "+2". `notateChord` is the same call the chart's own key-change chip
  // makes, so the two can never name the key differently.
  //
  // Boundaries only — a `{modulate}` in the MIDDLE of a section belongs to that
  // section's own chip in the chart, and the map has no place between two
  // sections to put it.
  const keyChanges = (() => {
    if (!song?.key || ordered.length < 2) return null;
    const out = {};
    const notation = config.display.notation === 'nashville' ? 'letters' : config.display.notation;
    for (let i = 1; i < ordered.length; i += 1) {
      if (offsets[i] === offsets[i - 1]) continue;
      out[i] = notateChord(song.key, {
        key: song.key,
        notation,
        transpose: transpose + offsets[i],
        accidentals: settings?.accidentals,
      });
    }
    return Object.keys(out).length ? out : null;
  })();

  if (!song) return null;

  const displayKey = selectedKey || song.key;
  // ── Element 19 — the capo ────────────────────────────────────────────────
  // YOUR capo for THIS song (`src/lib/capo.js` has the whole argument for why
  // it is yours and not the band's). The chart shows SHAPES, so the chords
  // render `capo` semitones DOWN while the key pill keeps saying the sounding
  // key — both facts on screen, neither one lying.
  //
  // It is set in PRACTICE and only rendered in LIVE (owner, 2026-08-10: *"The
  // capo is set in practice view, in live it's only rendered"*), which is the
  // same rule `saveKey` already follows: live is the reading view.
  const capo = capoFor(settings, song?.id);
  const chartTranspose = transpose - capo;
  const capoShapeKey = capo ? shapeKeyFor(displayKey, capo) : null;
  const setCapo = onUpdateSettings && config.can.saveKey
    ? (n) => onUpdateSettings('songCapos', withCapo(settings, song.id, n))
    : null;
  // Element 1 is fixed — no customization, by decision. An earlier cut gave it
  // three density states nobody asked for, and a stored 'min' was silently
  // hiding the title.
  const showChrome = !embedded;
  // Editing forces the map back on (owner, 2026-08-04). The structure can be
  // hidden, and hiding the thing you edit the play order with makes the ↑/↓
  // handles' retirement a dead end — there would be no way to reorder at all.
  // Forced to 'top' rather than restored to whatever it was: a floating side
  // rail is 48px wide, which is not somewhere you drag chips.
  // Editing puts the map at the TOP, wherever it normally lives, and gives it
  // back when you leave (owner, 2026-08-05: *"move to the top, when exits edit
  // everything goes back to normal"*). It used to rescue only 'off' and the two
  // floating sides, so a bottom ribbon stayed at the bottom — the one place
  // where the thing you are dragging sits under the nav bar, furthest from
  // where you are reading the change. A 48px floating rail was never somewhere
  // you drag chips either.
  const ribbonPlace = editing ? 'top' : config.ribbon;
  const ribbonSide = ribbonPlace === 'left' || ribbonPlace === 'right';

  const ribbonNode = ribbonPlace !== 'off' && ordered.length > 0 ? (
    <StructureRibbon
      structure={ordered.map(s => s.type)}
      activeIndex={activeSection}
      // No jumping while editing (owner, 2026-08-04). A chip is a drag handle
      // now, and a gesture that both moves the section AND throws the page
      // somewhere else is a gesture nobody can aim.
      onSelect={editing ? null : jumpToSlot}
      // Editing forces 'codes' as well as forcing the map on: a chip has to be
      // a DRAG HANDLE now, and 'dots' is a 10px circle while 'numbered' is bare
      // text with no box — nothing there to grab, and nothing to paint a drop
      // outline on.
      // ── Sides are DOTS, whatever the style says ────────────────────────
      // Owner, 2026-08-06: *"maybe we allow only dots to be placed left/right
      // because we can make them transparent? I don't want the strip bar to
      // push the lyrics to the right. The right side should be for inline
      // notes."*
      //
      // Round 1 gave the chart a gutter so the strip could never cover a word.
      // It worked, and it cost the wrong thing: 21px of chip on a phone became
      // ~83px of chart, and the right margin is element 5's — inline notes live
      // out there on a wide screen. So the strip goes back to floating over the
      // chart and gets small enough to do it honestly. A dot is 10px of colour
      // with no text to be covered or to cover, which is the only thing that
      // survives being laid over lyrics.
      //
      // Same shape as edit mode forcing 'codes': the POSITION decides what a
      // chip can be, because a 48px-wide column and a full-width row are not
      // the same object.
      style={editing ? 'codes' : (ribbonSide ? 'dots' : config.ribbonStyle)}
      orientation={ribbonSide ? 'vertical' : 'horizontal'}
      // No window any more (owner, 2026-08-06: *"now that we have dots, remove
      // the scrolling of 2 and 3, show full"*). The window existed because a
      // column of CHIPS could not carry a whole song — six spelled-out names
      // was the most that fit. A dot is 7px on a 13px pitch, so thirty sections
      // are ~390px of a ~700px band: the whole map fits, and a map you can see
      // all of is the one thing the ribbon is for.
      windowAround={null}
      keyChanges={keyChanges}
      // EXPANDED while editing (owner: "I imagine that when the user presses
      // the edit the cx3 expands to c c c"). Right — a collapsed `C ×3` is one
      // chip standing for three slots, so dragging it is dragging three things
      // at once and dropping "between the second and third" cannot be
      // expressed. Expanded, every chip is exactly one slot and the drag means
      // what it looks like.
      // Owner, 2026-08-05: *"I don't think we should allow x2 for the side
      // left/right, because they are already long enough, maybe we repeat in
      // the song map if left/right."* A column already has the room a row does
      // not, and `×2` on a chip you are reading one-per-line is a second thing
      // to decode. Spelled out, each chip is one slot — which is also what edit
      // mode does, for the same reason.
      collapse={!editing && !ribbonSide}
      activeFill
      // The ends fade when there is more song off either side (owner,
      // 2026-08-05). The reader is the one caller that can promise what colour
      // the strip sits on — `--chart-bg`, the same token the sticky block and
      // the bottom block paint themselves with.
      edgeFade
      sectionColors={resolveSectionColors(settings)}
      sectionLabels={settings?.sectionLabels}
      customSectionTypes={settings?.customSectionTypes}
      // Edit mode's route through the structure: the map is already a list of
      // the play order, so editing it there beats walking down the page. ONE
      // `+` that asks which section (owner, 2026-08-04), and drag to reorder —
      // which is what retired the ↑/↓ handles on the headings.
      addOptions={editing ? (song.sections || []).map(sec => sec.type) : null}
      onAddSection={editing ? (name) => editStructure(st => appendSection(st, name)) : null}
      onReorder={editing
        ? (from, count, to) => editStructure(st => moveRun(st, from, count, to))
        : null}
      // Drop a chip on the bin. Same undo toast as the heading's trash — one
      // removal, one way to take it back, wherever you did it from.
      onRemoveSlot={editing ? (slot) => removeSection(slot, ordered[slot]) : null}
    />
  ) : null;

  // ⚠ DERIVED, not an effect that closes it on entry. Edit mode has no ☰
  // button, so a panel left open would have no way back — and on a phone it is
  // 40% of the screen sitting over the thing you came here to change. Gating
  // here means the anchor simply stops meaning anything while editing, and the
  // panel is exactly where you left it when you finish.
  const menuNode = ownAaAnchor && !editing ? (
    <ReaderMenu
      dock={menuDocks ? 'bottom' : 'side'}
      onUpgrade={onUpgrade}
      anchorRect={ownAaAnchor}
      onClose={() => setOwnAaAnchor(null)}
      settings={settings}
      onUpdateSettings={onUpdateSettings}
      song={song}
      config={config}
      lyricSize={config.display.lyricFontSize}
      onLyricSize={(v) => onUpdateSettings?.('defaultFontSize', v)}
      chordSize={config.display.chordFontSize}
      onChordSize={(v) => onUpdateSettings?.('chordFontSize', v)}
    />
  ) : null;

  const rule = { borderColor: 'var(--chart-rule, var(--ds-gray-300))' };
  const bottomRibbon = ribbonPlace === 'bottom' && !!ribbonNode;

  return (
    // ── The split ────────────────────────────────────────────────────────────
    // The scroller used to BE the root. It is a flex CHILD now, so the docked
    // ☰ can take a real share of the screen: the chart gets smaller rather than
    // being covered, and it keeps its scroll position. Nothing changes when the
    // dock is absent — a lone `flex-1` child is the same box `h-full` was.
    //
    // A phone splits VERTICALLY (chart over settings, 60/40) and a desktop
    // HORIZONTALLY (settings down the left, chart beside them) — the outer row
    // here, the inner column below.
    // `relative` so element 5's floating action anchors HERE — to the reader's
    // own box, which the docked ☰ is a flex child of — rather than to the
    // full-screen dialog. Anchored to the dialog it sat behind the docked menu
    // instead of riding above it (owner, 2026-08-09).
    <div className="h-full flex flex-col relative">
    <div
      className="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden no-scrollbar"
      ref={scrollRef}
      onTouchStart={onSwipeLeft || onSwipeRight ? onTouchStart : undefined}
      onTouchEnd={onSwipeLeft || onSwipeRight ? onTouchEnd : undefined}
      // Both surfaces live in `readerSurface.js` so the break and missing-song
      // screens paint from the SAME object — see the note there. They used to
      // have no remap at all, which left their ☰ and ✕ in app colours on a
      // chart background.
      style={embedded ? hubSurface : chartSurface}
    >
      {/* ── Element 1 — top bar ─────────────────────────────────────────── */}
      {showChrome && (
        <ReaderTopBar
          ref={headRef}
          aboveBar={aboveBar}
          leading={railButton}
          title={song.title}
          // ⚠ GONE while editing, not disabled and not live. The category
          // argument settles it (owner, 2026-08-09): *"you're changing the
          // song, not the screen."* The ☰ is how the page is PAINTED — the same
          // reason `ReaderActions` gives for keeping it out of the corner — and
          // edit mode is about the song. Two rounds were spent on the other two
          // answers: dead-but-present (pixels that look broken) and re-enabled
          // (harmless, which is not a reason FOR a control).
          //
          // The title shifting left is the cost, and it is the right cost: the
          // whole bar changes colour and its right-hand control changes from a
          // glyph to a word at the same instant. Nothing INTERACTIVE moves under
          // a thumb — that is the jump the floating circles were fixed for.
          onMenu={editing ? null : (rect) => setOwnAaAnchor(a => (a ? null : rect))}
          menuOpen={!editing && !!ownAaAnchor}
          // ⚠ In edit mode ✕ IS Cancel. It was disabled here — dead pixels in
          // the most reachable spot on the screen, guarding against "leaving
          // mid-edit strands the change". The guard was right and the answer
          // was wrong: ✕ already means "get out without keeping", which is
          // precisely Cancel. `requestCancelEdit` is what makes a mis-tap safe.
          onExit={editing ? requestCancelEdit : onExit}
          editing={editing}
          exitLabel={editing ? 'Cancel editing' : 'Exit'}
          exitDisabled={false}
          progress={progress}
          // ⚠ NO `tools`, in any view, in any mode. The click and Edit both
          // float now (`ReaderActions`); notes never had a bar control. That is
          // the point of the split: the bar answers *where am I* — title, key,
          // position — and nothing else, so it is the one thing in the reader
          // whose shape never changes. It reached five icons beside a
          // truncating title once (owner: *"too much for the header"*) and the
          // way back was not to prune the list but to notice that the list was
          // answering a different question. `tools` stays a prop on
          // `ReaderTopBar` because other surfaces pass one.
          meta={(
            <span className="shrink-0 flex items-center gap-2 text-label-11 text-[var(--chart-subtle,var(--ds-gray-700))]">
              {onSelectKey && config.can.transpose ? (
                <Select value={displayKey} onValueChange={onSelectKey}>
                  {/* Identical to the Song Hub's key chip — solid --chord fill,
                      near-black text, mono bold. */}
                  <SelectTrigger
                    aria-label="Key (transpose)"
                    className="!border-0 gap-0.5 font-mono font-bold focus:!ring-0 shrink-0 hover:!opacity-90 !h-[23px] !min-h-[23px] sm:!h-[20px] sm:!min-h-[20px] !w-auto !pl-2 !pr-1.5 !py-0 !rounded-lg text-[13px] leading-none [&>svg]:w-[11px] [&>svg]:h-[11px] sm:[&>svg]:w-[10px] sm:[&>svg]:h-[10px] [&>svg]:shrink-0 [&>svg]:opacity-100 [&>svg]:translate-y-[1px]"
                    style={{ background: 'var(--chord)', color: '#0a0a0a' }}
                  >
                    <span>{displayKey}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {keysInQualityOf(song.key, settings?.accidentals).map(k => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span
                  className="font-mono font-bold text-[13px] rounded-lg px-2 h-[23px] sm:h-[20px] inline-flex items-center"
                  style={{ background: 'var(--chord)', color: '#0a0a0a' }}
                >
                  {displayKey}
                </span>
              )}
              {/* ── Element 19 — the capo chip ────────────────────────────────
                  Beside the key, not inside it (owner, 2026-08-10: *"I think it
                  will be too much... the pill would get too cluttered if we also
                  add capo"*). It survives element 5's "the bar carries no tools"
                  because key AND capo together are the same fact — *where you
                  are* — and the bar has room since the tools left it.

                  Two states, and they follow the same rule `saveKey` does:
                  in PRACTICE it is a control, in LIVE it is a read-out that
                  appears only when a capo is already set (owner: *"in live it's
                  only rendered... We needed only if there is already a capo that
                  said capo +3"*). No capo, no chip, no clutter. */}
              {setCapo ? (
                <CapoChip
                  capo={capo}
                  soundingKey={displayKey}
                  shapeKey={capoShapeKey}
                  // The writer's capo, if the arrangement carries one — it
                  // seeds the suggestion rather than doing anything by itself.
                  writtenCapo={song.capo}
                  onSelect={setCapo}
                />
              ) : capo ? (
                <span
                  className="font-mono font-bold text-[12px] rounded-lg px-1.5 h-[23px] sm:h-[20px] inline-flex items-center gap-1 shrink-0"
                  style={{
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: 'var(--chord)',
                    color: 'var(--chord)',
                  }}
                >
                  Capo {capo}
                  {capoShapeKey && <span className="opacity-70">· {capoShapeKey}</span>}
                </span>
              ) : null}
              {/* The tempo and the time are ALREADY on this row as text. In
                  edit mode they become the fields — which is the owner's
                  "a couple of interactive fields", and the answer to "this
                  editor should also let users edit the key/tempo on the fly,
                  rather than opening the tempo menu". You edit the number you
                  were already looking at. */}
              {editing ? (
                <>
                  <BarField
                    value={song.tempo ?? ''}
                    prefix="♩"
                    width={38}
                    label="Tempo"
                    inputMode="numeric"
                    onCommit={(v) => {
                      const n = parseInt(v, 10);
                      writeSong({ tempo: Number.isFinite(n) ? clampTempo(n) : null });
                    }}
                  />
                  <BarField
                    value={song.time || ''}
                    width={34}
                    label="Time signature"
                    onCommit={(v) => writeSong({ time: v.trim() })}
                  />
                </>
              ) : (
                <>
                  {song.tempo && <span className="tabular-nums">♩{song.tempo}</span>}
                  {song.time && <span className="tabular-nums">{song.time}</span>}
                </>
              )}
            </span>
          )}
        >
          {/* Element 2 lives INSIDE element 1's sticky block: one piece of
              chrome that travels together, rather than two stacked stickies.
              The order is SET / HEADER / STRUCTURE (owner, 2026-08-01): the set
              bar no longer REPLACES the ribbon, it sits above the bar and the
              ribbon keeps its place below. That reverses element 8b's original
              "never both" — the owner's call, and it is recorded as his in
              docs/READER.md. All three pin together as one block. */}
          {ribbonPlace === 'top' && ribbonNode && (
            // No rule between the bar and the ribbon. They are ONE piece of
            // chrome by element 2's decision, and a line here splits what that
            // decision deliberately fused. The divider lives on the bottom of
            // the whole sticky block instead — see `ReaderTopBar`.
            <div className="wide-container overflow-hidden pt-0.5 pb-1" style={{ fontSize: '0.85em' }}>
              {ribbonNode}
            </div>
          )}

          {/* Pull-to-finish's label. A CHILD of the sticky block, absolutely
              positioned just below it, so the header's transform carries it
              down as one piece — the hint arrives from behind the chrome
              rather than appearing in the middle of the chart. `aria-hidden`
              and pointer-transparent: it is feedback for a gesture in
              progress, not a control, and Done/Cancel are the reachable way to
              do the same thing. Its text is written by the touch handler
              directly (see the effect) — nothing here re-renders mid-pull. */}
          {editing && (
            <div
              ref={hintRef}
              aria-hidden="true"
              className="absolute left-1/2 top-full mt-2 pointer-events-none"
              style={{
                opacity: 0,
                transform: 'scale(0.9)',
                transformOrigin: 'top center',
                marginLeft: '-84px',
                width: '168px',
                // The one transition in the gesture: `transform` is written on
                // every touchmove and must NOT ease behind the thumb, so only
                // opacity is allowed to smooth.
                transition: 'opacity 120ms linear',
              }}
            >
              <div
                className="relative overflow-hidden rounded-full flex items-center justify-center gap-1.5 h-7 text-label-11 font-semibold"
                style={{
                  color: EDIT_ACCENT,
                  border: `1px solid ${EDIT_ACCENT}`,
                  background: 'var(--chart-bg, var(--ds-background-100))',
                }}
              >
                {/* The fill, behind the label. `scaleX` from the left edge —
                    a width animation would relayout on every frame. */}
                <span
                  data-pull-fill=""
                  className="absolute inset-0 origin-left"
                  style={{ background: EDIT_ACCENT, opacity: 0.18, transform: 'scaleX(0)' }}
                />
                <span data-pull-arrow="" className="relative leading-none" style={{ transform: 'rotate(0deg)' }}>↓</span>
                <span data-pull-label="" className="relative">Keep pulling</span>
              </div>
            </div>
          )}
        </ReaderTopBar>
      )}

      <div className="flex-1 flex">
        {/* Floating and transparent (owner, 2026-08-01), not a docked column.
            Docked it cost 56px of chart width, which is why it used to collapse
            to 'top' on a phone. Floating, it costs nothing, so the phone can
            have it too — `pointer-events-none` on the strip with the chips
            themselves re-enabling, so the space around them still scrolls the
            chart underneath. */}
        {/* ── Elements 3–6 — the song ──────────────────────────────────── */}
        {/* ── The desktop panel, and the chart beside it ──────────────────
            The panel lives INSIDE the scroller, below the top bar, and that is
            the whole point. A previous round made it a sibling of the scroller
            and offset it by `headH` to keep the ☰ still — which did not work:
            the header is INSIDE this column, so shrinking the column shrinks
            the header, the ☰ moved sideways anyway, and all the offset bought
            was an empty band above the panel (owner, 2026-08-04: *"there's an
            empty space in the top on desktop now"*). Here the header is the
            scroller's own full-width child, so it never moves at all, and the
            band is gone because there is nothing above the panel to leave
            empty.

            `sticky` at the header's height, with `align-self: flex-start`, so
            it stays put while the chart scrolls past it. */}
        {/* A plain row that GROWS with the chart — never `flex-1 min-h-0`.
            That was the double scroll (owner, 2026-08-04): inside a scrolling
            flex column, `flex-1 min-h-0` caps a child at the scroller's VISIBLE
            height, so the chart laid itself out inside a box pinned to one
            screen while its content ran far past it. The scroller's scrollHeight
            then came from the capped box rather than the song, and the result
            was two scrolls that disagreed about how long the song was. It was
            unconditional, so it hit the phone too — where this row holds nothing
            but the chart. The panel keeps its own height and `position: sticky`;
            the row must not try to size it. */}
        {/* `flex-1 min-w-0` — WIDTH, and this row had neither. It is a flex
            ITEM of the row above, so without `flex-1` it was shrink-to-fit:
            measured in Chromium at 1280, the chart came out **840px wide in a
            1236px scroller**, left-aligned, with ~400px of dead window beside
            it. Nobody had noticed because a narrower chart is still a correct
            chart — it just wraps more, which also makes the song taller, which
            is part of why an "almost fitting" song scrolls. `min-w-0` lets it
            shrink again when the ☰ panel takes its 320px.
            (This is the WIDTH twin of the `flex-1 min-h-0` trap above, and the
            opposite lesson: on the cross axis of a scroller, `flex-1` is what
            you want.) */}
        <div className="flex flex-1 min-w-0">
        {!menuDocks && menuNode && (
          <div
            className="shrink-0 self-start overflow-hidden"
            style={{
              width: 'min(320px, 30vw)',
              position: 'sticky',
              top: headH || 0,
              // Measured, not `100vh` — see `viewH`. And the bottom block comes
              // off it too (`footH`): it is in flow below this row, so a panel
              // that claims everything under the header pushes the column past
              // the scroller by exactly the nav bar's height. That was the
              // second scrollbar.
              height: viewH ? Math.max(0, viewH - headH - footH) : undefined,
              animation: 'reader-side-in 200ms cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            {menuNode}
          </div>
        )}
        <div className="flex-1 min-w-0 relative">
          {/* ── The side rail — element 3, rebuilt 2026-08-05 ───────────────
              Owner: *"First thing they should be in the middle of the app not
              at the top like now. The setting and the rail should push them not
              open behind them. They should be a bit transparent. They should
              show maybe like 5-6 elements and they should scroll with the
              text."* All four, in order:

              **In the middle.** It was `top-0 bottom-0` on the row, so the
              chips stacked from the top edge and a five-chip map floated up by
              the title. Now it is centred in the VISIBLE band — the same
              `viewH - headH - footH` the ☰ panel is measured with, so it sits
              in the middle of what you can actually see rather than the middle
              of the song.

              **Pushed, not buried.** It hangs off the CHART COLUMN now, not off
              the row that also holds the ☰ panel. When the panel opens the
              column narrows and the rail moves with it; when the setlist rail
              opens, `SetlistReader` has already narrowed the whole reader, so
              this moves too. Absolutely positioned against the row, it simply
              sat underneath both.

              **Sticky with NO height.** A zero-height sticky box is what lets it
              stay put while the song scrolls past without taking a pixel of
              layout from the chart — `position: fixed` would have ignored both
              the panel and the app's own sidebar, which is the bug we just
              fixed.

              **A bit transparent**, so the lyrics read through it. */}
          {ribbonSide && ribbonNode && (
            <div
              // z-0, not z-10: the lyrics are element 6 and they win every
              // overlap. With the gutter below they should never meet, but a
              // wide tab or a long chord line can still reach across, and when
              // it does the word is the thing that must be readable.
              // ⚠ ABOVE the chart (z-10), and it has to be.
              //
              // beta.87 put it UNDER — the honest reading of "the lyrics are
              // number one" — and that silently broke the map: paint order is
              // hit-test order, so the chart's own box (padding included, and
              // the strip lives in that padding) swallowed every tap. Not one
              // dot was clickable, and the scrub could not start. Caught by
              // driving the gesture in Chromium; `elementFromPoint` over a dot
              // answered `.wide-container`.
              //
              // The rule survives, by GEOMETRY instead of z-order: a 26px strip
              // of 7px dots sits inside the 32px padding the chart already had,
              // so it does not cover a word in the first place. Under-painting
              // was the right answer for the frosted CHIPS that started this —
              // and those are exactly what a side rail no longer draws.
              className="sticky z-10 h-0 pointer-events-none"
              style={{ top: headH || 0 }}
              aria-hidden={false}
            >
              {/* ── Transparent dots, no plate ────────────────────────────
                  The frosted plate was the right answer for CHIPS — it kept
                  text legible over text — and the wrong one for a strip that
                  floats: a plate is opaque enough to hide a word, and the words
                  come first. With the side rail reduced to dots there is no
                  text on the strip to protect, so the plate goes and the dots
                  themselves carry the transparency, which is what was asked for
                  in the first place ("that's why I wanted them transparent").
                  Frost stays where it earns its keep — see the ☰. */}
              <div
                ref={scrubRef}
                // `pointer-events-auto` on the whole strip, not just the chips:
                // it is a scrub track now, and a track with holes in it is a
                // track that drops the gesture between two dots. It costs the
                // 26px column its scroll-through, which is the trade the scrub
                // is worth.
                className={`absolute ${ribbonPlace === 'left' ? 'left-0 items-start' : 'right-0 items-end'} flex flex-col pointer-events-auto rounded-xl`}
                style={{
                  // The browser decides `touch-action` when the gesture STARTS,
                  // so the scrub has to claim the vertical axis up front or the
                  // page scroll wins the first move and never gives it back.
                  // It is claimed on the STRIP only — 26px of the screen — so
                  // the chart either side of it still scrolls normally.
                  touchAction: 'none',
                  top: Math.max(0, (viewH - headH - footH) / 2),
                  transform: 'translateY(-50%)',
                  // On the marks, not on a ground — a dot has no ink to wash
                  // out, so this is the one place fading is the honest tool.
                  opacity: 0.7,
                  padding: '2px',
                }}
              >
                {ribbonNode}
              </div>
            </div>
          )}
          {/* The multi-column context MUST be established on the same element
              that carries the width constraint. With `columnCount` on the
              full-width parent and `wide-container` on a child, the columns
              spanned the whole window while the header stayed at 1600px —
              which is why the body never lined up with the bar above it. */}
          <div
            ref={chartRef}
            className="wide-container py-3 relative z-[1]"
            style={{
              fontSize: config.display.lyricFontSize,
              // SectionBlock sizes chords off these vars, not inherited size.
              ['--chart-font-size-lyric']: `${config.display.lyricFontSize}px`,
              ['--chart-font-size-chord']: `${config.display.chordFontSize}px`,
              ['--chart-line-height-lyric']: settings?.lyricLineHeight ?? 1.35,
              ['--chart-section-gap']: `${settings?.sectionSpacing ?? 24}px`,
              // ── The left edge, and what the right one is for ──────────────
              // Owner, 2026-08-06: *"on mobile the sections should start right
              // next to the left side of the screen because the right side
              // should be for inline notes"*.
              //
              // `wide-container` gives every reading surface 32px a side. On a
              // 390px phone that is 64px — 16% of the screen — spent on nothing,
              // and measured, dropping it to 12px both sides took the same eight
              // lines from 549px to 529px while GAINING 40px of text width. It
              // is free.
              //
              // ⚠ Except on the side the structure rail floats down. Element 3
              // settled that a side rail is 26px of dots painted INSIDE the 32px
              // the chart already had, so it crosses no words (READER.md, "the
              // rail never covers a word"). Take that padding away and the dots
              // land on the lyrics. So the rail's side keeps its 32px, and only
              // the other one comes in.
              ['--chart-pad-left']: `${padLeft}px`,
              ['--chart-pad-right']: `${padRight}px`,
              paddingLeft: `${padLeft}px`,
              paddingRight: `${padRight}px`,
              // The note strip's width, read by `SectionBlock`'s gutter grid.
              // Only sections that actually carry a note reserve it. Wider on a
              // wide screen because the column is: 88px of a 366px phone is a
              // quarter of the line, 132px of a 594px column is a fifth.
              ['--note-gutter']: wide ? '132px' : '88px',
              // ── Two columns, and which way you READ them ────────────────
              // `columnCount` (multicol) fills column 1 to the bottom, then
              // column 2 — you read DOWN, then across. That is the default and
              // it is the right one for a chart: the browser BALANCES the two
              // columns, so they end level.
              //
              // 'across' is the prototype the owner asked for (2026-08-04):
              // sections laid left→right, wrapping to the next row. It is a
              // GRID, not multicol, and the trade-off is the reason multicol
              // exists — a grid row is as tall as its tallest section, so a
              // short verse beside a long chorus leaves a visible hole. Worth
              // it when sections are of similar length; not otherwise. Nothing
              // balances it away, and no amount of CSS will.
              ...(config.columns === 2
                ? (config.flow === 'across'
                  ? {
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gridAutoFlow: 'row',
                    columnGap: '1.75rem',
                    alignItems: 'start',
                  }
                  : { columnCount: 2, columnGap: '1.75rem', columnRule: '1px solid var(--chart-rule, var(--ds-gray-300))' })
                : null),
              // Trailing space, MEASURED — see `tailPad`. It used to be a flat
              // `60vh`, and only where headings pin (phones), which is why
              // clicking the last chip on a desktop moved nothing: there was
              // nothing below the song to scroll into.
              paddingBottom: tailPad,
            }}
          >
          {/* Element 14, the other half: a real song with nothing in it. A
              blank reader is indistinguishable from a crash, and this is the
              one case where a chart legitimately has nothing to draw — a song
              imported from a title-only list, or one whose body was cleared. */}
          {ordered.length === 0 && (
            <div className="py-16 text-center">
              <p className="m-0 text-copy-14" style={{ color: 'var(--chart-subtle, var(--ds-gray-700))' }}>
                This song has no chart yet.
              </p>
            </div>
          )}
          {ordered.map((section, idx) => (
            <ReaderSection
              key={`${section.id || section.type}-${idx}`}
              section={section}
              index={idx}
              config={config}
              songKey={song.key}
              settings={settings}
              transpose={chartTranspose}
              modOffset={offsets[idx]}
              repeatOf={repeats[idx]}
              // The tag opens where it stands (owner, option B, 2026-08-05),
              // and a collapsed RUN opens all the plays it stands for — they
              // are the same section, back to back, so opening one and leaving
              // the others as tags would put the ugliness back.
              onOpenHere={() => openRepeat(runs[idx]?.slots || idx)}
              // Closing acts on THIS slot. It becomes a tag again and merges
              // with whichever neighbours are also tags — the run is derived,
              // so there is nothing to keep in step by hand.
              onCollapse={() => closeRepeat(idx)}
              expanded={openRepeats.has(idx)}
              run={runs[idx]}
              tabColors={tabColors}
              stickyTop={headH}
              onChordTap={editing
                ? (chord, rect, meta) => setChordEdit({ chord, rect, meta: { ...meta, section } })
                // `showDiagrams` was a fourth orphan: the setting existed, was
                // synced, and the reader read it nowhere — element 11 made
                // diagrams tap-to-see with no way to switch off (owner,
                // 2026-08-04: "maybe we can have an option to turn them off").
                // Default ON, because element 11's whole argument is that a
                // diagram you ask for costs nothing until you ask.
                : (canSeeShapes && settings?.showDiagrams !== false ? onChordTap : null)}
              showChords={showChords}
              showLyrics={showLyrics}
              editing={editing}
              onRemove={editing ? () => removeSection(idx, section) : null}
              onEditLines={editing ? (text) => editSectionLines(section, text) : null}
              // ── Element 5 — notes and cues live INSIDE edit mode ──────────
              //
              // ⚠ `editing`, not `!editing`. There is no note MODE any more.
              // Two rounds were spent moving one gate around — arm first, then
              // tap a line; then existing notes tappable without arming, which
              // let you rewrite a cue while merely reading (owner, 2026-08-09:
              // *"why can I edit them without having the exit toggled?"*).
              // Both were the same mistake: a second, lighter editing mode
              // sitting beside the real one.
              //
              // So there is one. Editing is editing: the exit locks, the song
              // nav goes, and every cue and note on screen becomes writable at
              // once — no arming, no picking, no instruction line. Outside it
              // they are text. The owner's framing, and it is right: *"that's
              // the whole point. You want to edit something... you are just
              // there focusing on editing."*
              //
              // `onUpdateSong` still guards separately: it is absent on
              // read-only surfaces, and a field that accepts a cue nobody
              // stores is worse than no field.
              onEditCue={config.can.writeNotes && onUpdateSong && editing
                ? (text) => editSectionCue(section, text)
                : null}
              onEditNote={config.can.writeNotes && onUpdateSong && editing
                ? (lineIdx, text) => editSectionNote(section, lineIdx, text)
                : null}
              // Every line and every heading offers itself, for as long as you
              // are editing. ~30 `+` marks down a song is noise while READING
              // and simply the affordance while editing — which already puts a
              // pencil and a trash on every heading. It is also the only honest
              // answer to *"how would they know"*.
              noteHintHere={editing}
              cueHintHere={editing}
            />
          ))}
          {/* ── Add a section — the bottom of the chart, in edit mode ────────
              Somebody brings an intro at rehearsal. Until now that cost you the
              whole reader: exit, hub, editor, add the section, save, come back,
              find your place (owner, 2026-08-10). Edit mode already reorders,
              repeats and removes sections and rewrites their words — inventing
              one is the same class of edit, and the only one it could not do.

              ⚠ HERE, and not on the song map. The map's `+` means *"play this
              again"*; this means *"there is a new part of the song"*. One
              control cannot carry both verbs (owner: *"we already have a + in
              the song map for adding a repeating section"*). It also lands
              where a new section goes — at the end, which is where you would
              add one on paper. */}
          {editing && onUpdateSong && (
            <AddSectionRow onAdd={addSection} />
          )}
          </div>
        </div>
        </div>

      </div>

      {/* ── The bottom edge — ONE sticky block, three rows ────────────────
          structure (when it's set to 'bottom') · practice · nav.

          It has to be one block. Two `sticky bottom-0` siblings do NOT stack:
          they both pin to the same edge and the higher z-index covers the
          other. That is exactly what shipped in beta.41 — the bottom ribbon
          was there, pinned, and painted underneath the nav bar, so it looked
          like nothing had changed. A z-index cannot separate two elements that
          want the same 0px. */}
      {(bottomRibbon || footer || (showChrome && practiceOpen) || editing) && (
        <div
          ref={footRef}
          className="sticky bottom-0 z-20 shrink-0 border-t"
          style={{
            ...rule,
            background: 'var(--chart-bg, var(--ds-background-100))',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {bottomRibbon && (
            <div
              className={`wide-container overflow-hidden py-1${(footer || practiceOpen) ? ' border-b' : ''}`}
              style={{ ...(footer || practiceOpen ? rule : null), fontSize: '0.85em' }}
            >
              {ribbonNode}
            </div>
          )}
          {showChrome && practiceOpen && (
            <div className={`reader-row-in wide-container py-1${footer ? ' border-b' : ''}`} style={footer ? rule : undefined}>
              <ReaderPracticeRow
                song={song}
                bpm={bpm}
                onBpm={changeBpm}
                onSaveTempo={onUpdateSong ? (v) => onUpdateSong({ ...song, tempo: v }) : null}
                clickRunning={metronome.running}
                onToggleClick={() => (metronome.running ? metronome.stop() : metronome.start(bpm, song.time))}
              />
            </div>
          )}
          {footer && <div className="wide-container flex items-center gap-2 py-1">{footer}</div>}
        </div>
      )}

      {/* `ChordAutocomplete`, NOT `ChordPicker` (owner, 2026-08-04: "the chords
          don't work on mobile, also it should allow me to add new chords... can
          we get the other picker"). Both were already in the editor and the
          wrong one got wired:

            ChordPicker         a fixed 290px popover of root × suffix buttons.
                                No text entry, so a slash chord or anything past
                                the nine suffixes is unreachable — and at a
                                hard 290px anchored to a tapped chord it hangs
                                off the side or the bottom of a phone.
            ChordAutocomplete   types ANY chord (`isChordToken` validates,
                                slash and extended included), suggests the
                                song's diatonic chords first, and DOCKS
                                full-width at the bottom on touch instead of
                                floating — which is the mobile half of the same
                                complaint.

          It also leaves the input unfocused on touch on purpose, so the
          keyboard doesn't cover the bar you are tapping chips in. */}
      {chordEdit && (
        <ChordAutocomplete
          initial={chordEdit.chord || ''}
          songKey={displayKey}
          anchorRect={chordEdit.rect}
          compact
          editing
          onCommit={applyChord}
          onClose={() => setChordEdit(null)}
        />
      )}

      {tappedChord && (
        <ChordPopover
          chord={tappedChord.chord}
          anchorRect={tappedChord.rect}
          onClose={() => setTappedChord(null)}
        />
      )}

      {/* The hub's Aa button, unchanged. See the note on `ownAaAnchor`. */}
      {hostAaAnchor && (
        <AaMenu
          anchorRect={hostAaAnchor}
          onClose={() => onAaClose?.()}
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          lyricSize={config.display.lyricFontSize}
          onLyricSize={(v) => onUpdateSettings?.('defaultFontSize', v)}
          chordSize={config.display.chordFontSize}
          onChordSize={(v) => onUpdateSettings?.('chordFontSize', v)}
          columns={settings?.defaultColumns ?? 'auto'}
          onColumns={(v) => onUpdateSettings?.('defaultColumns', v)}
          notation={config.display.notation}
          onNotation={(v) => onUpdateSettings?.('notation', v)}
        />
      )}
    </div>

      {/* Edit, and the click riding above it. `ReaderActions` carries why they
          float rather than sitting in the bar, and why they are two circles
          rather than one menu.

          They live HERE, siblings of the scroller and the dock, rather than
          inside the scroller: they are positioned against the reader ROOT, and
          being a child of the thing you are not positioned against was only
          ever going to read wrong the first time someone moved it.

          ⚠ Rendered THROUGH edit mode, unlike every previous shape. Edit is a
          toggle that becomes Done in place; hiding it meant putting a duplicate
          back in the top bar, which is how the bar ended up changing shape
          depending on a mode. */}
      {showChrome && (
        <ReaderActions
          scrollRef={scrollRef}
          onEdit={canEdit ? toggleEdit : null}
          editing={editing}
          // The edit bar's four controls, rehoused — see `ReaderActions`.
          // Cancel is the only one that did NOT come here: it is the top bar's
          // ✕, which had nothing to do in this mode.
          onDone={toggleEdit}
          onUndo={undo}
          canUndo={history.length > 0}
          onNewVersion={onSaveAsArrangement ? saveAsArrangement : null}
          dirty={editing && isDirty(editBase, song)}
          // Null in live as of 2026-08-09 (`readerConfig`), so live shows
          // neither circle — it is the reading view and nothing else.
          onPractice={config.can.practiceTools ? togglePractice : null}
          practiceOpen={practiceOpen}
          practiceRunning={metronome.running}
          // The sticky bottom block, PLUS the docked ☰ — both are below these
          // in the reader's column and they have to clear both.
          //
          // ⚠ `dockH` is MEASURED, not `viewH * 0.4`. The dock's 40% is 40% of
          // the ROOT; `viewH` is the SCROLLER, which is the other 60% — so the
          // arithmetic version cleared 24% of the reader and left the button
          // sitting on top of the panel's first row. Two different boxes with
          // one plausible-looking multiplication between them: measure it.
          bottom={Math.max(footH, restH) + dockH}
        />
      )}

      {/* The dock. A fixed share of the READER, not of the viewport, so it is
          the same share whatever chrome sits above it. 40%, up from the 30%
          round 4 shipped: round 6 made every control bigger and 30% then held
          about two and a half rows before it had to scroll. */}
      {menuDocks && menuNode && (
        <div ref={dockRef} className="shrink-0 min-h-0" style={{ flex: '0 0 40%' }}>{menuNode}</div>
      )}
    </div>
  );
}
