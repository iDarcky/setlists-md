import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { semitonesBetween, keysInQualityOf } from '@/music';
import { resolveSongView } from '@/arrangements';
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/ui/Select';
import { IconButton } from '@/ui/IconButton';
import { buildSongFlow } from '@/lib/songFlow';
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
import ReaderEditBar, { EditIcon } from './ReaderEditBar';
import {
  materialiseStructure, removeSlot, moveRun, appendSection, snapshotEditable, isDirty,
  replaceChordInLine, withEditedLine,
} from '@/lib/editStructure';
import ChordAutocomplete from '@/features/editor/ChordAutocomplete';
import { transposeChord } from '@/music';
import { parseSectionLines } from '@/parser';
import { showUndoToast } from '@/lib/undoToast';

const EMPTY = [];

const ribbonSideOf = (pos) => pos === 'left' || pos === 'right';

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
  // Element 8: what hangs under the top bar in place of the ribbon. The setlist
  // knows the set; the reader only knows one song, so the host supplies it.
  underBar = null,
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
  const menuDocks = useMediaQuery('(max-width: 699.98px)');
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

  const config = useMemo(
    () => resolveReaderConfig(settings, { wide, embedded, myInstrument, mode }),
    [settings, wide, embedded, myInstrument, mode]
  );

  // ── Edit mode ────────────────────────────────────────────────────────────
  // Not a panel. The owner's shape: press edit and the CHART becomes editable —
  // the tempo and time in the bar turn into fields, each section grows a play-
  // order handle. See `ReaderEditBar` for why there is no sheet.
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

  const jumpTo = useCallback((idx) => {
    const el = document.getElementById(`section-${idx}`);
    const sc = scrollRef.current;
    if (!el) return;
    if (!sc) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    // Land the section BELOW the sticky chrome. scrollIntoView aligns to the
    // container's top edge, which is behind the header, so the heading you
    // jumped to ended up hidden underneath it.
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    sc.scrollTo({ top: Math.max(0, top - headH - 8), behavior: 'smooth' });
  }, [headH]);

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
    const paint = (d) => {
      const head = headRef.current;
      if (head) head.style.transform = d ? `translateY(${d}px)` : '';
      const hint = hintRef.current;
      if (!hint) return;
      hint.style.opacity = String(Math.min(1, d / 28));
      hint.textContent = d >= TRIGGER ? 'Release to finish' : 'Pull down to finish';
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
      const head = headRef.current;
      // Animate the snap back, then take the transition off again so the next
      // pull tracks the thumb instead of easing behind it.
      if (head) head.style.transition = 'transform 180ms ease-out';
      paint(0);
      setTimeout(() => { if (head) head.style.transition = ''; }, 200);
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

  const tabColors = {
    ...(settings?.tabStringColor ? { line: settings.tabStringColor, label: settings.tabStringColor } : null),
    ...(settings?.tabNumberColor ? { number: settings.tabNumberColor } : null),
    ...(settings?.tabBg ? { bg: settings.tabBg } : null),
  };

  if (!song) return null;

  const displayKey = selectedKey || song.key;
  // Element 1 is fixed — no customization, by decision. An earlier cut gave it
  // three density states nobody asked for, and a stored 'min' was silently
  // hiding the title.
  const showChrome = !embedded;
  // Editing forces the map back on (owner, 2026-08-04). The structure can be
  // hidden, and hiding the thing you edit the play order with makes the ↑/↓
  // handles' retirement a dead end — there would be no way to reorder at all.
  // Forced to 'top' rather than restored to whatever it was: a floating side
  // rail is 48px wide, which is not somewhere you drag chips.
  const ribbonPlace = editing && (config.ribbon === 'off' || ribbonSideOf(config.ribbon))
    ? 'top'
    : config.ribbon;
  const ribbonSide = ribbonPlace === 'left' || ribbonPlace === 'right';

  const ribbonNode = ribbonPlace !== 'off' && ordered.length > 0 ? (
    <StructureRibbon
      structure={ordered.map(s => s.type)}
      activeIndex={activeSection}
      // No jumping while editing (owner, 2026-08-04). A chip is a drag handle
      // now, and a gesture that both moves the section AND throws the page
      // somewhere else is a gesture nobody can aim.
      onSelect={editing ? null : jumpTo}
      // Editing forces 'codes' as well as forcing the map on: a chip has to be
      // a DRAG HANDLE now, and 'dots' is a 10px circle while 'numbered' is bare
      // text with no box — nothing there to grab, and nothing to paint a drop
      // outline on.
      style={editing ? 'codes' : (settings?.ribbonStyle || 'codes')}
      orientation={ribbonSide ? 'vertical' : 'horizontal'}
      // EXPANDED while editing (owner: "I imagine that when the user presses
      // the edit the cx3 expands to c c c"). Right — a collapsed `C ×3` is one
      // chip standing for three slots, so dragging it is dragging three things
      // at once and dropping "between the second and third" cannot be
      // expressed. Expanded, every chip is exactly one slot and the drag means
      // what it looks like.
      collapse={!editing}
      activeFill
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

  const menuNode = ownAaAnchor ? (
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
    <div className="h-full flex">
      {/* ── The desktop panel ───────────────────────────────────────────────
          On the LEFT, and it starts BELOW the top bar. Owner, 2026-08-04:
          *"Maybe we can still do it in a way that the ☰ is still in the same
          place when we open somehow? We move everything lower?"* — right: a
          full-height panel pushed the whole reader across, so the ☰ you had
          just pressed jumped 320px sideways and you lost the thing you were
          aiming at. Offsetting by the MEASURED header height (`headH`, which
          the reader already tracks for the sticky headings) leaves the bar —
          and the ☰ in it — exactly where it was.

          Width is responsive: a fixed 320 is a third of a 1024px laptop and a
          sliver of a big display. It also slides, so the layout arrives rather
          than jumping. It is NOT a permanent strip (owner: *"I don't know if I
          want to have another strip always there… the settings are not that
          needed, like the rail"*) — it does not exist until the ☰ opens it. */}
      {!menuDocks && menuNode && (
        <div
          className="shrink-0 overflow-hidden"
          style={{
            width: 'min(320px, 30vw)',
            marginTop: headH || undefined,
            height: headH ? `calc(100% - ${headH}px)` : '100%',
            animation: 'reader-side-in 200ms cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          {menuNode}
        </div>
      )}
    <div className="flex-1 min-w-0 h-full flex flex-col">
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
          aboveBar={underBar}
          leading={railButton}
          title={song.title}
          onMenu={editing ? null : (rect) => setOwnAaAnchor(a => (a ? null : rect))}
          menuOpen={!!ownAaAnchor}
          onExit={onExit}
          editing={editing}
          exitDisabled={editing}
          progress={progress}
          tools={(
            <>
              {config.can.practiceTools && (
                <IconButton
                  size="sm"
                  className={BAR_BUTTON}
                  aria-label={practiceOpen ? 'Close practice tools' : 'Practice tools'}
                  aria-pressed={practiceOpen}
                  // Inert while editing, along with the ☰, the rail and the
                  // song nav: an edit is a mode you leave deliberately, and
                  // every one of these is a way to wander out of it with the
                  // change applied and Cancel out of reach.
                  disabled={editing}
                  onClick={togglePractice}
                  style={practiceOpen ? { color: 'var(--chord)' } : undefined}
                >
                  <MetronomeIcon />
                </IconButton>
              )}
              {/* Beside practice, per the ☰'s round-3 cut: "the top bar keeps
                  ☰ · practice · edit · exit". */}
              {canEdit && (
                <IconButton
                  size="sm"
                  className={BAR_BUTTON}
                  aria-label={editing ? 'Stop editing' : 'Edit this song'}
                  aria-pressed={editing}
                  onClick={toggleEdit}
                  style={editing ? { color: 'var(--color-brand)' } : undefined}
                >
                  <EditIcon />
                </IconButton>
              )}
            </>
          )}
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
              className="absolute left-0 right-0 top-full pt-2 flex justify-center pointer-events-none text-label-11 font-semibold"
              style={{ opacity: 0, color: EDIT_ACCENT }}
            >
              Pull down to finish
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
        {ribbonPlace === 'left' && ribbonNode && (
          <div
            className="absolute left-0 top-0 bottom-0 z-10 w-12 overflow-y-auto no-scrollbar px-1 py-2 pointer-events-none [&_button]:pointer-events-auto"
            style={{ background: 'transparent' }}
          >
            {ribbonNode}
          </div>
        )}

        {/* ── Elements 3–6 — the song ──────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* The multi-column context MUST be established on the same element
              that carries the width constraint. With `columnCount` on the
              full-width parent and `wide-container` on a child, the columns
              spanned the whole window while the header stayed at 1600px —
              which is why the body never lined up with the bar above it. */}
          <div
            className="wide-container py-3"
            style={{
              fontSize: config.display.lyricFontSize,
              // SectionBlock sizes chords off these vars, not inherited size.
              ['--chart-font-size-lyric']: `${config.display.lyricFontSize}px`,
              ['--chart-font-size-chord']: `${config.display.chordFontSize}px`,
              ['--chart-line-height-lyric']: settings?.lyricLineHeight ?? 1.35,
              ['--chart-section-gap']: `${settings?.sectionSpacing ?? 24}px`,
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
              // Trailing space so the LAST section can still scroll up far
              // enough to pin. Without it the song stops moving as soon as its
              // bottom meets the viewport, so the final section's heading never
              // reaches the sticky position and the ribbon never catches up to
              // it. Only where headings actually pin — `config.sticky` is
              // phone-only by element 3's decision, and on a desktop this would
              // just be a screen of blank paper.
              ...(config.sticky ? { paddingBottom: '60vh' } : null),
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
              transpose={transpose}
              modOffset={offsets[idx]}
              repeatOf={repeats[idx]}
              onJumpToFirst={() => jumpTo(repeats[idx])}
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
            />
          ))}
          </div>
        </div>

        {ribbonPlace === 'right' && ribbonNode && (
          <div
            className="absolute right-0 top-0 bottom-0 z-10 w-12 overflow-y-auto no-scrollbar px-1 py-2 pointer-events-none [&_button]:pointer-events-auto"
            style={{ background: 'transparent' }}
          >
            {ribbonNode}
          </div>
        )}
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
            <div className={`wide-container py-1${footer ? ' border-b' : ''}`} style={footer ? rule : undefined}>
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
          {editing && (
            <div className={`wide-container py-1${footer ? ' border-b' : ''}`} style={footer ? rule : undefined}>
              <ReaderEditBar
                onDone={toggleEdit}
                onCancel={cancelEdit}
                onUndo={undo}
                canUndo={history.length > 0}
                onSaveAsArrangement={onSaveAsArrangement ? saveAsArrangement : null}
                dirty={isDirty(editBase, song)}
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

      {/* The dock. A fixed share of the READER, not of the viewport, so it is
          the same share whatever chrome sits above it. 40%, up from the 30%
          round 4 shipped: round 6 made every control bigger and 30% then held
          about two and a half rows before it had to scroll. */}
      {menuDocks && menuNode && (
        <div className="shrink-0 min-h-0" style={{ flex: '0 0 40%' }}>{menuNode}</div>
      )}
    </div>
    </div>
  );
}
