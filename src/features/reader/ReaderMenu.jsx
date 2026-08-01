import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEntitlement } from '@/hooks/useEntitlement';
import {
  CHART_THEMES,
  CHART_FONTS,
  CHART_COLOR_PALETTE,
  DEFAULT_CHART_THEME_ID,
  DEFAULT_CHORD_FONT_ID,
  DEFAULT_LYRIC_FONT_ID,
  FREE_CHART_THEME_IDS,
} from '@/data/chartThemes';

/**
 * The reader's ☰ — its ONE menu.
 *
 * ## Three rows
 *
 * The concept had nine. The owner cut it twice, and both cuts came from the
 * same objection: *"this new menu will require multiple clicks/taps for
 * something that is currently achieved with only one"*, then *"this is a bit
 * overwhelming."* Gone, each for a recorded reason (`docs/READER.md`):
 *
 *  - **Jump to** — the structure ribbon already does it.
 *  - **Share / print** — lives in the song hub (element 23).
 *  - **Practice** — stays an ICON in the top bar. Element 12's decision stands.
 *  - **Fix it** — an inline mini-editor from its own icon, not a menu row.
 *  - **The screen** — cut 2026-08-01. Keep-awake already lives in Settings, and
 *    a row holding one switch is a row holding nothing.
 *
 * ## The look is the mockup's
 *
 * Rows are ONE line: icon · label · current value right-aligned in mono ·
 * chevron. Not a two-line card with a bordered icon tile — that was the
 * "overwhelming" version, and it made three rows occupy the height of eight.
 * Inside a panel, controls are `Field` blocks: a small mono uppercase label
 * over a row of segmented pills. Colours are ours (`--color-brand`, `--chord`,
 * the `--ds-*` greys); the geometry is the mockup's.
 *
 * ## Two shapes
 *
 * Sheet on a phone, popover anchored to ☰ on a desktop. Both obey the panel
 * rule (`docs/READER.md`): the chart stays visible, so a change can be seen as
 * it is made. The sheet is capped at 58vh for exactly that reason.
 */

const NOTATIONS = [['letters', 'Letters'], ['nashville', 'Numbers'], ['solfege', 'Do-Re-Mi']];

// "You're playing" — a PRESET, not a hidden layer. Picking one writes the
// settings it implies, visibly, so there is never a second source of truth
// quietly overriding what the display panel says. (A hidden role layer is what
// turned the hub's Chart tab into a second Lyrics tab; see READER.md.)
const ROLES = [
  { id: 'leader', label: 'Leading', applies: { displayMode: 'chords', tabInstrument: 'all' } },
  { id: 'vocalist', label: 'Vocals', applies: { displayMode: 'lyrics', tabInstrument: 'all' } },
  { id: 'guitar', label: 'Guitar', applies: { displayMode: 'chords', tabInstrument: 'electric' } },
  { id: 'bass', label: 'Bass', applies: { displayMode: 'chords', tabInstrument: 'bass' } },
  { id: 'keys', label: 'Keys', applies: { displayMode: 'chords', tabInstrument: 'all' } },
  { id: 'drums', label: 'Drums', applies: { displayMode: 'lyrics', tabInstrument: 'all' } },
];

// The mockup's row glyphs: a single character each, not an icon set. At 19px in
// a 13.5px row, a drawn icon is noise — the label is doing the work.
const GLYPH = { look: 'Aa', layout: '▤', music: '♪', notes: '✉' };

// ── Mockup primitives ───────────────────────────────────────────────────────
// Geometry copied from the concept; every colour is one of ours.

function Row({ glyph, label, value, onClick }) {
  return (
    <button
      type="button" onClick={onClick}
      // min-h-0: the global `button { min-height: 44px }` on phones turns a
      // 9px-padded row into a slab. See READER.md's min-h-0 box.
      className="w-full min-h-0 flex items-center gap-[11px] px-4 py-[9px] bg-transparent border-none cursor-pointer text-left text-[13.5px] text-[var(--text-1)] hover:bg-[var(--bg-2)] transition-colors"
    >
      <span className="w-[19px] shrink-0 grid place-items-center font-mono text-[12px] font-bold text-[var(--text-2)]">{glyph}</span>
      <span className="truncate">{label}</span>
      <span className="ml-auto shrink-0 font-mono text-[11.5px] text-[var(--ds-gray-600)] whitespace-nowrap">{value}</span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round" className="shrink-0 ml-1.5 text-[var(--ds-gray-600)]" aria-hidden="true">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div className="px-4 pt-2.5 pb-0.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ds-gray-600)] mb-[7px]">{label}</div>
      {children}
    </div>
  );
}

function Seg({ active, onClick, children, title }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={!!active} title={title}
      className={`min-h-0 px-[11px] py-[5px] rounded-lg border text-[12px] cursor-pointer transition-colors ${
        active
          ? 'font-semibold text-white'
          : 'font-normal text-[var(--text-2)] bg-transparent hover:border-[var(--border-3)]'}`}
      style={active
        ? { background: 'var(--color-brand)', borderColor: 'var(--color-brand)' }
        : { borderColor: 'var(--border-2)' }}
    >
      {children}
    </button>
  );
}

/** A labelled row of segments bound to one setting. The workhorse. */
function Segs({ label, options, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex gap-[5px] flex-wrap">
        {options.map(([v, l]) => (
          <Seg key={String(v)} active={value === v} onClick={() => onChange(v)}>{l}</Seg>
        ))}
      </div>
    </Field>
  );
}

function MiniStepper({ value, min, max, onChange, label, unit = '', step = 1, onReset }) {
  return (
    <div className="flex items-center gap-[7px]">
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-[27px] h-[27px] min-h-0 grid place-items-center rounded-lg border border-[var(--border-2)] bg-transparent text-[var(--text-1)] text-[15px] leading-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg-2)]">−</button>
      <b className="font-mono text-[13px] font-semibold min-w-[52px] text-center tabular-nums text-[var(--text-1)]">{value}{unit}</b>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-[27px] h-[27px] min-h-0 grid place-items-center rounded-lg border border-[var(--border-2)] bg-transparent text-[var(--text-1)] text-[15px] leading-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg-2)]">+</button>
      {onReset && (
        <button type="button" onClick={onReset}
          className="min-h-0 ml-1 text-[11px] text-[var(--ds-gray-600)] hover:text-[var(--text-1)] bg-transparent border-none cursor-pointer underline underline-offset-2">
          Reset
        </button>
      )}
    </div>
  );
}

function Swatches({ activeValue, onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CHART_COLOR_PALETTE.map(c => {
        const on = (c.value || null) === (activeValue || null);
        return (
          <button key={c.id} type="button" onClick={() => onPick(c.value)} title={c.name} aria-label={c.name}
            className="w-[22px] h-[22px] min-h-0 rounded-full cursor-pointer"
            style={{
              background: c.value === null
                ? 'linear-gradient(135deg, var(--chart-text, #888) 50%, var(--chord, #e0b341) 50%)'
                : c.value,
              border: '2px solid ' + (on ? 'var(--text-1)' : 'transparent'),
              boxShadow: on ? '0 0 0 2px var(--bg-1), 0 0 0 3px var(--color-brand)' : 'inset 0 0 0 1px var(--border-2)',
            }} />
        );
      })}
    </div>
  );
}

function ProNote({ children }) {
  return <p className="m-0 text-[12px] text-[var(--ds-gray-600)]">{children}</p>;
}

export default function ReaderMenu({
  anchorRect, onClose, settings, onUpdateSettings,
  song, config,
  lyricSize, onLyricSize, chordSize, onChordSize,
  // Practice-only surfaces (elements 21/22 attach here when they land).
  mode = 'live',
}) {
  const [panel, setPanel] = useState('root');
  const { allowed: styleAllowed } = useEntitlement('chart-style');

  const set = (key, value) => onUpdateSettings?.(key, value);

  // Escape backs out one level, then closes. Jumping straight to closed from
  // inside a panel loses your place for no reason.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (panel !== 'root') setPanel('root'); else onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panel, onClose]);

  // Let the wheel scroll the theme strip horizontally while hovering it.
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
  }, [panel]);

  // ── Geometry ───────────────────────────────────────────────────────────────
  // `clientWidth`, NOT `innerWidth`: innerWidth includes the scrollbar, so
  // clamping against it let the popover sit partly under (and past) the
  // scrollbar — the "overflows on the right" report. Falls back to innerWidth
  // where there is no document (tests).
  const winW = typeof document !== 'undefined'
    ? (document.documentElement?.clientWidth || window.innerWidth)
    : 1024;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
  // A sheet below 700px, not 640: at 640–700 the popover was wider than the
  // room beside the ☰, which is the other half of the same report.
  const phone = winW < 700;
  const W = Math.min(296, winW - 16);   // the mockup's popover width
  // Align to whichever edge of the ☰ keeps the panel on screen. The reader's ☰
  // is top-LEFT, so a right-aligned popover pushed it off the edge.
  const anchorsLeft = anchorRect ? (anchorRect.left ?? 0) < winW / 2 : true;
  const left = anchorsLeft ? Math.min(Math.max(8, anchorRect?.left ?? 8), winW - W - 8) : null;
  const right = anchorsLeft ? null : Math.max(8, winW - (anchorRect?.right ?? winW));
  const top = anchorRect ? Math.min(anchorRect.bottom + 6, winH - 120) : 60;

  const themeId = settings?.chartTheme || DEFAULT_CHART_THEME_ID;
  const visibleThemes = styleAllowed ? CHART_THEMES : CHART_THEMES.filter(t => FREE_CHART_THEME_IDS.has(t.id));
  const themeName = CHART_THEMES.find(t => t.id === themeId)?.name || 'Theme';

  // ── Row values: what it's set to, not what it does ──────────────────────────
  const roleId = settings?.displayRole || 'leader';
  const roleLabel = ROLES.find(r => r.id === roleId)?.label || 'Leading';
  const capo = song?.capo ? Number(song.capo) : 0;
  const arrangementNote = (song?.notes || '').trim();
  const cues = (song?.sections || [])
    .map(s => ({ section: s.type, note: (s.note || '').trim() }))
    .filter(c => c.note);
  const noteCount = cues.length + (arrangementNote ? 1 : 0);

  const title = panel === 'look' ? 'Look'
    : panel === 'layout' ? 'Layout'
      : panel === 'music' ? 'The music'
        : panel === 'notes' ? 'Notes' : '';

  // The ROOT has no header — the mockup's doesn't, and the song's name was
  // already in the top bar two rows up (owner: "why do we have the song name in
  // the title?"). A panel gets back + its own name; closing is the backdrop,
  // Escape, or the ☰ again.
  const head = panel === 'root' ? null : (
    <div className="shrink-0 flex items-center gap-[9px] px-3.5 pt-2 pb-2.5 border-b border-[var(--border-1)]">
      <button type="button" onClick={() => setPanel('root')} aria-label="Back"
        className="w-6 h-6 min-h-0 shrink-0 grid place-items-center rounded-[7px] border border-[var(--border-2)] bg-transparent text-[var(--text-1)] cursor-pointer hover:bg-[var(--bg-2)]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      <h4 className="m-0 flex-1 min-w-0 text-[13px] font-semibold text-[var(--text-1)] truncate">{title}</h4>
    </div>
  );

  const body = (
    // overflow-x-hidden: a wrapping seg row or the theme strip must never widen
    // the panel itself.
    <div className="overflow-y-auto overflow-x-hidden py-1.5">
      {panel === 'root' && (
        <>
          <Row glyph={GLYPH.look} label="Look" onClick={() => setPanel('look')}
            value={`${themeName} · ${lyricSize}px`} />
          <Row glyph={GLYPH.layout} label="Layout" onClick={() => setPanel('layout')}
            value={config?.columns === 2 ? '2 col' : '1 col'} />
          <Row glyph={GLYPH.music} label="The music" onClick={() => setPanel('music')}
            value={capo ? `${roleLabel} · capo ${capo}` : roleLabel} />
          <Row glyph={GLYPH.notes} label="Notes" onClick={() => setPanel('notes')}
            value={noteCount ? String(noteCount) : '—'} />
        </>
      )}

      {/* ── Look ───────────────────────────────────────────────────────────
          How the page is PAINTED. Its own root row rather than a tab inside a
          Display panel (owner, 2026-08-01: "because we have space, maybe we can
          do look and layout as different outside tabs?") — the two most-opened
          panels are now one tap, not two. */}
      {panel === 'look' && (
        <>
              <Field label="Theme">
                <div ref={themesRef} className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {visibleThemes.map(t => (
                    <button key={t.id} type="button" onClick={() => set('chartTheme', t.id)}
                      className="shrink-0 min-h-0 h-[30px] w-[54px] rounded-lg overflow-hidden border cursor-pointer flex items-end justify-end px-1.5 py-1"
                      style={{
                        background: t.bg, color: t.chord, fontFamily: 'var(--font-mono)',
                        borderColor: themeId === t.id ? 'var(--color-brand)' : 'var(--border-2)',
                        boxShadow: themeId === t.id ? '0 0 0 1.5px var(--color-brand)' : 'none',
                      }}
                      aria-label={`Theme: ${t.name}`} aria-pressed={themeId === t.id} title={t.name}>
                      <span className="text-[10px] font-bold">Am</span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={`Lyrics — ${lyricSize}px`}>
                <MiniStepper value={lyricSize} min={10} max={40} unit="px" label="lyric size" onChange={onLyricSize} />
              </Field>
              <Field label={`Chords — ${chordSize}px`}>
                <MiniStepper value={chordSize} min={8} max={40} unit="px" label="chord size" onChange={onChordSize} />
              </Field>

              <Field label="Line spacing">
                <MiniStepper
                  value={Math.round((settings?.lyricLineHeight ?? 1.35) * 100)} min={100} max={240} step={5}
                  unit="%" label="line height"
                  onChange={(v) => set('lyricLineHeight', Math.round(v) / 100)}
                  onReset={settings?.lyricLineHeight != null ? () => set('lyricLineHeight', undefined) : null}
                />
              </Field>
              <Field label="Gap between sections">
                <MiniStepper
                  value={settings?.sectionSpacing ?? 24} min={8} max={64} step={2} unit="px" label="section gap"
                  onChange={(v) => set('sectionSpacing', v)}
                  onReset={settings?.sectionSpacing != null ? () => set('sectionSpacing', undefined) : null}
                />
              </Field>

              {/* Fonts as pills rather than the old bordered list: the list was
                  44px per font and made this tab a page you scroll. */}
              {styleAllowed ? (
                <>
                  <Field label="Lyric font">
                    <div className="flex gap-[5px] flex-wrap">
                      {CHART_FONTS.map(f => (
                        <Seg key={f.id} active={(settings?.chartLyricFont || DEFAULT_LYRIC_FONT_ID) === f.id}
                          onClick={() => set('chartLyricFont', f.id)}>
                          <span style={{ fontFamily: f.stack }}>{f.name}</span>
                        </Seg>
                      ))}
                    </div>
                  </Field>
                  <Field label="Lyric colour">
                    <Swatches activeValue={settings?.chartLyricColor} onPick={(v) => set('chartLyricColor', v || undefined)} />
                  </Field>
                  <Field label="Chord font">
                    <div className="flex gap-[5px] flex-wrap">
                      {CHART_FONTS.map(f => (
                        <Seg key={f.id} active={(settings?.chartChordFont || DEFAULT_CHORD_FONT_ID) === f.id}
                          onClick={() => set('chartChordFont', f.id)}>
                          <span style={{ fontFamily: f.stack }}>{f.name}</span>
                        </Seg>
                      ))}
                    </div>
                  </Field>
                  <Field label="Chord colour">
                    <Swatches activeValue={settings?.chartChordColor} onPick={(v) => set('chartChordColor', v || undefined)} />
                  </Field>
                </>
              ) : (
                <Field label="Fonts &amp; colours">
                  <ProNote>Upgrade to change the chart&rsquo;s fonts and colours.</ProNote>
                </Field>
              )}

              {/* Tabs are a LOOK concern — every one of these is about how a tab
                  is painted. (Owner: "I think tab controls live here, right?") */}
              <Segs label="Tab size" value={settings?.tabSize || 1}
                options={[[0.85, 'S'], [1, 'M'], [1.25, 'L']]} onChange={(v) => set('tabSize', v)} />
              <Segs label="Tab grid" value={settings?.tabSubdivision || 1}
                options={[[1, '1/4'], [2, '1/8'], [4, '1/16']]} onChange={(v) => set('tabSubdivision', v)} />
              <Field label="Tab colours">
                <div className="flex items-center gap-2">
                  {[
                    ['tabStringColor', 'Strings', '#9b9b9b'],
                    ['tabNumberColor', 'Numbers', '#e0a82e'],
                    ['tabBg', 'Background', '#101010'],
                  ].map(([key, label, fallback]) => (
                    <input
                      key={key} type="color" aria-label={`Tab ${label.toLowerCase()} colour`} title={label}
                      value={settings?.[key] || fallback}
                      onChange={(e) => set(key, e.target.value)}
                      className="w-[27px] h-[27px] min-h-0 rounded-lg border border-[var(--border-2)] bg-transparent cursor-pointer p-0"
                    />
                  ))}
                </div>
              </Field>
        </>
      )}

      {/* ── Layout ─────────────────────────────────────────────────────────
          Where things ARE. */}
      {panel === 'layout' && (
        <>
              <Segs label="Columns" value={settings?.defaultColumns === 2 ? 2 : 1}
                options={[[1, '1'], [2, '2']]} onChange={(v) => set('defaultColumns', v)} />
              <Segs label="Structure — where" value={settings?.structurePosition || 'top'}
                options={[['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right'], ['off', 'Hidden']]}
                onChange={(v) => set('structurePosition', v)} />
              <Segs label="Structure — style" value={settings?.ribbonStyle || 'codes'}
                options={[['codes', 'Boxes'], ['chips', 'Chips'], ['numbered', 'Inline'], ['dots', 'Dots'], ['dotlabel', 'Dots+label']]}
                onChange={(v) => set('ribbonStyle', v)} />
              <Segs label="Under the top bar" value={settings?.readerTopBar || 'ribbon'}
                options={[['ribbon', 'Structure'], ['setlist', 'The set']]}
                onChange={(v) => set('readerTopBar', v)} />
              <Segs label="Section heading" value={settings?.readerHeading || 'name'}
                options={[['name', 'Name'], ['code', 'Letters'], ['caps', 'ALL CAPS']]}
                onChange={(v) => set('readerHeading', v)} />
              <Segs label="Heading pins as you scroll" value={settings?.readerSticky || 'on'}
                options={[['on', 'Pinned'], ['off', 'Not pinned']]}
                onChange={(v) => set('readerSticky', v)} />
              <Segs label="Section style" value={settings?.readerSectionStyle || 'bar'}
                options={[['bar', 'Bar'], ['plain', 'No line'], ['block', 'Block'], ['card', 'Card']]}
                onChange={(v) => set('readerSectionStyle', v)} />
              <Segs label="Repeated sections" value={settings?.duplicateSections || 'condensed'}
                options={[['full', 'Full'], ['condensed', 'Condensed']]}
                onChange={(v) => set('duplicateSections', v)} />
              <Segs label="Song to song" value={settings?.readerNav || 'footer'}
                options={[['footer', 'Bottom bar'], ['pill', 'Pill'], ['edge', 'Edge arrows'], ['swipe', 'Swipe']]}
                onChange={(v) => set('readerNav', v)} />
              {/* Last and small on purpose — the owner's words: "I don't think
                  this is where it should be set, but it's ok to have it small in
                  case of emergency." The real answer is the role picker. */}
              <Segs label="In a pinch" value={settings?.displayMode || 'chords'}
                options={[['chords', 'Both'], ['lyrics', 'Lyrics'], ['chordsonly', 'Chords']]}
                onChange={(v) => set('displayMode', v)} />
        </>
      )}

      {/* ── The music ──────────────────────────────────────────────────────
          Named for what it holds: how the music is SPELLED, not how the page
          looks — which is why accidentals live here and not in Display. No key
          change: element 1's key pill owns transpose, and a second control for
          it is a second answer. */}
      {panel === 'music' && (
        <>
          <Segs label="You're playing" value={roleId}
            options={ROLES.map(r => [r.id, r.label])}
            onChange={(id) => {
              // Applies its settings VISIBLY. A role that silently overrode the
              // display panel is the exact bug that turned the hub's Chart tab
              // into a second Lyrics tab.
              const r = ROLES.find(x => x.id === id);
              set('displayRole', id);
              Object.entries(r?.applies || {}).forEach(([k, v]) => set(k, v));
            }} />
          <div className="px-4 pt-1 pb-0.5">
            <p className="m-0 text-[12px] text-[var(--ds-gray-600)]">
              Vocals and Drums drop the chords; Guitar and Bass open their own tabs. All still changeable under Display.
            </p>
          </div>

          <Segs label="Chord names" value={config?.display?.notation || 'letters'}
            options={NOTATIONS} onChange={(v) => set('notation', v)} />
          <Segs label="Sharps or flats" value={settings?.accidentals || 'auto'}
            options={[['auto', 'Follow key'], ['sharps', '♯'], ['flats', '♭']]}
            onChange={(v) => set('accidentals', v)} />

          <Field label="Capo">
            {capo ? (
              // Truthful rather than a knob that does nothing: the chart shows
              // SOUNDING chords today. Shapes for a capoed player is element 19
              // and is real work, not a toggle.
              <p className="m-0 text-[12px] text-[var(--text-2)]">
                <span className="font-mono font-semibold text-[var(--chord)]">Capo {capo}</span>
                {' — '}the chords below are what it sounds like. Shapes are coming.
              </p>
            ) : (
              <ProNote>None on this arrangement.</ProNote>
            )}
          </Field>
        </>
      )}

      {/* ── Notes ──────────────────────────────────────────────────────────
          Every note on this song in one place, which is what "see them all in
          a place" asked for. Read-only: WRITING one is element 22, practice. */}
      {panel === 'notes' && (
        <>
          {arrangementNote && (
            <Field label="This arrangement">
              <p className="m-0 text-[12.5px] text-[var(--text-1)] whitespace-pre-wrap">{arrangementNote}</p>
            </Field>
          )}
          {cues.map((c, i) => (
            <Field key={i} label={c.section}>
              <p className="m-0 text-[12.5px] text-[var(--text-1)]">{c.note}</p>
            </Field>
          ))}
          {noteCount === 0 && (
            <div className="px-4 py-5 text-center">
              <ProNote>Nothing written on this song yet.</ProNote>
            </div>
          )}
          {mode === 'practice' && noteCount > 0 && (
            <div className="px-4 pt-3">
              <ProNote>Writing one from here is coming to practice.</ProNote>
            </div>
          )}
        </>
      )}

      <div className="h-1.5" />
    </div>
  );

  return createPortal((
    <>
      <button type="button" aria-label="Close menu" tabIndex={-1} onClick={onClose}
        className={`fixed inset-0 z-[119] border-none cursor-default ${phone ? 'bg-black/30' : 'bg-transparent'}`} />
      <div
        role="dialog" aria-label="Reader menu"
        className={
          'fixed z-[120] bg-[var(--ds-background-100)] overflow-hidden flex flex-col '
          + (phone
            ? 'left-0 right-0 bottom-0 rounded-t-[18px] border-t border-[var(--border-2)]'
            : 'rounded-[14px] border border-[var(--border-2)]')
        }
        style={phone
          ? {
            maxWidth: '100vw',
            maxHeight: '58vh',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            boxShadow: '0 -12px 44px rgba(0,0,0,0.35)',
            animation: 'sheet-up 200ms cubic-bezier(0.32, 0.72, 0, 1)',
          }
          : {
            top, ...(left != null ? { left } : { right }),
            width: W, maxWidth: 'calc(100vw - 16px)', maxHeight: '74vh',
            boxShadow: '0 18px 44px rgba(0,0,0,0.45)',
            animation: 'pop-in 120ms ease-out',
          }}
      >
        {/* The mockup's grab handle. It is the affordance that says "this drags
            and dismisses" before anyone tries it. */}
        {phone && <div className="shrink-0 w-[34px] h-1 rounded-full mx-auto mt-1.5 mb-0.5 bg-[var(--border-2)]" />}
        {head}
        {body}
      </div>
    </>
  ), document.body);
}
