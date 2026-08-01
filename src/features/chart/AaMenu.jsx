import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEntitlement } from '@/hooks/useEntitlement';
import {
  CHART_THEMES,
  DEFAULT_CHART_THEME_ID,
  DEFAULT_CHORD_FONT_ID,
  DEFAULT_LYRIC_FONT_ID,
  FREE_CHART_THEME_IDS,
} from '@/data/chartThemes';
// Shared with the reader's ☰ menu — two private copies of a stepper drift
// within a release.
import { Stepper, Label, Pick, FontList, Swatches, ProHint } from '@/ui/PanelControls';

// The chart's single "Aa" display popover. Three tabs — Lyrics / Chords / Page —
// fold the old Display + Layout sheets into one anchored menu. Lyrics and Chords
// each get their own Size · Font · Colour (so chords can read small gold mono over
// larger sans lyrics); Page holds Theme · Notation · Columns · Show toggles. Fonts,
// colours and the non-free themes are gated behind the `chart-style` entitlement.
//
// All writes go through `onUpdateSettings` / the passed change handlers, so the
// menu is stateless beyond which tab is open. Everything is set-once-per-device.

const NOTATIONS = [
  { id: 'letters', label: 'Letters' },
  { id: 'nashville', label: 'Nashville' },
  { id: 'solfege', label: 'Do-Re-Mi' },
];

export default function AaMenu({
  anchorRect, onClose, settings, onUpdateSettings,
  lyricSize, onLyricSize, chordSize, onChordSize,
  columns, onColumns, notation, onNotation,
  onAdvanced, onReset,
  // When false, hide chart-only controls (theme, columns, fonts, colours,
  // advanced) — used by the editing-canvas Aa, which only needs notation + sizes.
  chartControls = true,
}) {
  const [tab, setTab] = useState('page');
  const { allowed: styleAllowed } = useEntitlement('chart-style');

  // Let the wheel scroll the theme strip horizontally while hovering it, not
  // just the scrollbar underneath it.
  const themesRef = useRef(null);
  useEffect(() => {
    const el = themesRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.deltaY || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [tab]);

  const themeId = settings?.chartTheme || DEFAULT_CHART_THEME_ID;
  const lyricFontId = settings?.chartLyricFont || DEFAULT_LYRIC_FONT_ID;
  const chordFontId = settings?.chartChordFont || DEFAULT_CHORD_FONT_ID;
  const visibleThemes = styleAllowed ? CHART_THEMES : CHART_THEMES.filter(t => FREE_CHART_THEME_IDS.has(t.id));

  // Position: below the anchor, clamped into the viewport. It aligns to
  // whichever edge of the anchor keeps it on screen — right-aligned for a
  // trigger on the right (the Song Hub's Aa), left-aligned for one on the left
  // (the reader's ☰, which otherwise pushed the panel off the screen edge).
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
  const W = Math.min(304, winW - 16);
  const anchorsLeft = anchorRect ? (anchorRect.left ?? 0) < winW / 2 : false;
  const left = anchorsLeft ? Math.min(Math.max(8, anchorRect.left ?? 8), winW - W - 8) : null;
  const right = anchorsLeft ? null : (anchorRect ? Math.max(8, winW - (anchorRect.right ?? winW)) : 8);
  const top = anchorRect ? Math.min(anchorRect.bottom + 6, winH - 80) : 60;

  const tabBtn = (id, label) => (
    <button type="button" onClick={() => setTab(id)}
      className={`flex-1 h-9 rounded-lg text-label-12 font-semibold cursor-pointer transition-colors ${tab === id ? 'bg-[var(--bg-2)] text-[var(--text-1)] border border-[var(--border-1)]' : 'text-[var(--text-2)] hover:text-[var(--text-1)]'}`}>
      {label}
    </button>
  );

  return createPortal((
    <>
      <button type="button" aria-label="Close display menu" tabIndex={-1} onClick={onClose}
        className="fixed inset-0 z-[119] bg-transparent border-none cursor-default" />
      <div role="dialog" aria-label="Display options"
        className="fixed z-[120] rounded-2xl border border-[var(--border-2)] bg-[var(--ds-background-100)] shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden"
        style={{ top, ...(left != null ? { left } : { right }), width: W, maxHeight: '74vh', display: 'flex', flexDirection: 'column', animation: 'pop-in 120ms ease-out' }}>
        {/* Tabs */}
        <div className="flex gap-1 p-1.5 bg-[var(--bg-1)] border-b border-[var(--border-1)]">
          {tabBtn('page', 'Page')}
          {tabBtn('lyrics', 'Lyrics')}
          {tabBtn('chords', 'Chords')}
        </div>

        <div className="p-3.5 overflow-y-auto">
          {tab === 'lyrics' && (
            <>
              <Label>Size</Label>
              <Stepper value={lyricSize} min={10} max={40} onChange={onLyricSize} label="lyric size" />
              {chartControls && (<>
                <Label>Font</Label>
                {styleAllowed
                  ? <FontList activeId={lyricFontId} onPick={(id) => onUpdateSettings?.('chartLyricFont', id)} />
                  : <ProHint>Upgrade to choose lyric fonts.</ProHint>}
                <Label>Colour</Label>
                {styleAllowed
                  ? <Swatches activeValue={settings?.chartLyricColor} onPick={(v) => onUpdateSettings?.('chartLyricColor', v || undefined)} />
                  : <ProHint>Upgrade to recolour lyrics.</ProHint>}
              </>)}
            </>
          )}

          {tab === 'chords' && (
            <>
              <Label>Size</Label>
              <Stepper value={chordSize} min={8} max={40} onChange={onChordSize} label="chord size" />
              {chartControls && (<>
                <Label>Font</Label>
                {styleAllowed
                  ? <FontList activeId={chordFontId} onPick={(id) => onUpdateSettings?.('chartChordFont', id)} />
                  : <ProHint>Upgrade to choose chord fonts.</ProHint>}
                <Label>Colour</Label>
                {styleAllowed
                  ? <Swatches activeValue={settings?.chartChordColor} onPick={(v) => onUpdateSettings?.('chartChordColor', v || undefined)} />
                  : <ProHint>Upgrade to recolour chords.</ProHint>}
              </>)}
              <Label>Sharps or flats</Label>
              <div className="flex gap-1.5 flex-wrap">
                {[['auto', 'Follow key'], ['sharps', '♯ Sharps'], ['flats', '♭ Flats']].map(o => (
                  <Pick key={o[0]} active={(settings?.accidentals || 'auto') === o[0]}
                    onClick={() => onUpdateSettings?.('accidentals', o[0])}>{o[1]}</Pick>
                ))}
              </div>
              {/* No diagram toggle. Element 11 made diagrams a question you
                  ask — tap any chord — rather than a strip you switch on and
                  then pay for on every screen. `showDiagrams` still drives the
                  pre-reader chart's strip; it has no control here because it
                  does nothing here. */}
            </>
          )}

          {tab === 'page' && (
            <>
              <Label>Show</Label>
              <div className="flex gap-1.5 flex-wrap">
                {[['chords', 'Chords + lyrics'], ['lyrics', 'Lyrics only'], ['chordsonly', 'Chords only']].map(o => (
                  <Pick key={o[0]} active={(settings?.displayMode || 'chords') === o[0]}
                    onClick={() => onUpdateSettings?.('displayMode', o[0])}>{o[1]}</Pick>
                ))}
              </div>

              {chartControls && (<>
              <Label>Theme</Label>
              <div ref={themesRef} className="flex gap-2 overflow-x-auto -mx-1 px-1 py-1">
                {visibleThemes.map(t => (
                  <button key={t.id} type="button" onClick={() => onUpdateSettings?.('chartTheme', t.id)}
                    className="shrink-0 flex flex-col items-stretch rounded-lg overflow-hidden border transition-all"
                    style={{ borderColor: themeId === t.id ? 'var(--color-brand)' : 'var(--border-1)', boxShadow: themeId === t.id ? '0 0 0 2px var(--color-brand)' : 'none', width: 76 }}
                    aria-label={`Theme: ${t.name}`} title={t.name}>
                    <div className="h-9 flex items-end justify-end px-2 py-1" style={{ background: t.bg, color: t.chord, fontFamily: 'var(--font-mono)' }}>
                      <span className="text-label-11 font-bold">Am</span>
                    </div>
                    <div className="px-1.5 py-1 text-label-10 font-medium text-[var(--text-1)] truncate" style={{ background: 'var(--bg-1)' }}>{t.name}</div>
                  </button>
                ))}
              </div>
              </>)}

              <Label>Notation</Label>
              <div className="flex flex-wrap gap-1.5">
                {NOTATIONS.map(n => (
                  <button key={n.id} type="button" onClick={() => onNotation(n.id)} aria-pressed={notation === n.id}
                    className={`px-3 h-8 rounded-lg border text-label-12 font-semibold cursor-pointer transition-colors ${notation === n.id ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand-soft)]' : 'border-[var(--border-1)] text-[var(--text-1)] bg-[var(--bg-1)] hover:border-[var(--border-3)]'}`}>
                    {n.label}
                  </button>
                ))}
              </div>

              {chartControls && (<>
              <Label>Columns</Label>
              <div className="flex flex-wrap gap-1.5">
                {[{ v: 1, l: '1' }, { v: 2, l: '2' }].map(o => (
                  <button key={o.l} type="button" onClick={() => onColumns(o.v)} aria-pressed={columns === o.v}
                    className={`px-4 h-8 rounded-lg border text-label-12 font-semibold cursor-pointer transition-colors ${columns === o.v ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand-soft)]' : 'border-[var(--border-1)] text-[var(--text-1)] bg-[var(--bg-1)] hover:border-[var(--border-3)]'}`}>
                    {o.l}
                  </button>
                ))}
              </div>
              </>)}

              {chartControls && onAdvanced && (
                <button type="button" onClick={() => { onClose(); onAdvanced(); }}
                  className="mt-4 w-full h-10 rounded-xl bg-[var(--bg-1)] border border-[var(--border-1)] text-label-13 font-semibold text-[var(--text-1)] flex items-center justify-center gap-2 hover:bg-[var(--bg-2)] transition-colors">
                  Spacing, role &amp; advanced
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              )}
            </>
          )}

          {onReset && (
            <button type="button" onClick={() => onReset(tab)}
              className="mt-4 w-full h-9 rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)] text-label-12 font-semibold text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)] cursor-pointer">
              Reset {tab} to default
            </button>
          )}
        </div>
      </div>
    </>
  ), document.body);
}
