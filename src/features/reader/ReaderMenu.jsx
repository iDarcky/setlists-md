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
import {
  Stepper, Label, Pick, PickRow, FontList, Swatches, ProHint, Switch,
} from '@/ui/PanelControls';

/**
 * The reader's ☰ — its ONE menu.
 *
 * Aa was a display popover. This is not that with a new coat of paint: the
 * owner's constraint was *"there would be more options than just the visual"*,
 * so display is one of four rows rather than the whole thing.
 *
 * ## Why four rows and not nine
 *
 * The concept drafted on 2026-07-31 had nine, grouped into three. The owner
 * killed it with the objection that actually matters: **"this new menu will
 * require multiple clicks/taps for something that is currently achieved with
 * only one."** A menu that buries a one-tap control is a worse menu no matter
 * how well it is organised, so rows were cut rather than regrouped:
 *
 *  - **Jump to** — the structure ribbon already does it, and with the ribbon
 *    off, scrolling beats opening a menu. Conceded outright.
 *  - **Share / print** — lives in the song hub (element 23).
 *  - **Practice** — stays an ICON in the top bar, exactly as element 12
 *    shipped it. One tap mid-song is the whole point of the thing.
 *  - **Fix it** — the owner means an inline mini-editor opened from its own
 *    icon, not a menu row. It is its own element.
 *
 * What is left is four rows, ONE level of drill-in, and a top bar that still
 * reads ☰ · practice · exit. Nothing that was one tap became three.
 *
 * ## Two shapes
 *
 * Sheet on a phone, popover anchored to ☰ on a desktop — the same split Apple
 * makes by size class. Both obey the panel rule (`docs/READER.md`): the chart
 * stays visible, so a change can be seen as it is made. The sheet is capped at
 * 62vh for exactly that reason; a full-height sheet is a page, not a panel.
 */

const NOTATIONS = [['letters', 'Letters'], ['nashville', 'Nashville'], ['solfege', 'Do-Re-Mi']];

// "Who's playing" — a PRESET, not a hidden layer. Picking one writes the
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

const ROW_ICONS = {
  display: <><circle cx="12" cy="12" r="3.2" /><path d="M12 4v1.6M12 18.4V20M4 12h1.6M18.4 12H20M6.3 6.3l1.2 1.2M16.5 16.5l1.2 1.2M17.7 6.3l-1.2 1.2M7.5 16.5l-1.2 1.2" /></>,
  music: <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  notes: <><path d="M4 5h16M4 10h16M4 15h10" /><path d="M14.5 20.5 20 15l1.5 1.5-5.5 5.5H14.5v-1.5z" /></>,
  screen: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8" /></>,
};

function RowIcon({ name }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ROW_ICONS[name]}
    </svg>
  );
}

/**
 * One row of the root list. The subtitle is the CURRENT VALUE, so the menu
 * answers "what is this set to" without being opened twice.
 */
function MenuRow({ icon, label, value, onClick }) {
  return (
    <button
      type="button" onClick={onClick}
      className="w-full min-h-0 flex items-center gap-3 px-3 py-3 rounded-xl bg-transparent border-none cursor-pointer text-left hover:bg-[var(--bg-2)] transition-colors"
    >
      <span className="shrink-0 w-9 h-9 grid place-items-center rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)] text-[var(--text-2)]">
        <RowIcon name={icon} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-label-13 font-semibold text-[var(--text-1)]">{label}</span>
        <span className="block text-copy-13 text-[var(--text-2)] truncate">{value}</span>
      </span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--text-2)]" aria-hidden="true">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

export default function ReaderMenu({
  anchorRect, onClose, settings, onUpdateSettings,
  song, config,
  lyricSize, onLyricSize, chordSize, onChordSize,
  // Practice-only surfaces (element 21/22 live here when they land).
  mode = 'live',
}) {
  const [panel, setPanel] = useState('root');
  const [displayTab, setDisplayTab] = useState('look');
  const { allowed: styleAllowed } = useEntitlement('chart-style');

  const set = (key, value) => onUpdateSettings?.(key, value);

  // Escape backs out one level, then closes. A menu that jumps straight to
  // closed from three levels down loses your place for no reason.
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
  }, [panel, displayTab]);

  // ── Geometry ───────────────────────────────────────────────────────────────
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
  const phone = winW < 640;
  const W = Math.min(320, winW - 16);
  // Align to whichever edge of the ☰ keeps the panel on screen. The reader's ☰
  // is top-LEFT, so a right-aligned popover pushed it off the edge.
  const anchorsLeft = anchorRect ? (anchorRect.left ?? 0) < winW / 2 : true;
  const left = anchorsLeft ? Math.min(Math.max(8, anchorRect?.left ?? 8), winW - W - 8) : null;
  const right = anchorsLeft ? null : Math.max(8, winW - (anchorRect?.right ?? winW));
  const top = anchorRect ? Math.min(anchorRect.bottom + 6, winH - 120) : 60;

  const themeId = settings?.chartTheme || DEFAULT_CHART_THEME_ID;
  const visibleThemes = styleAllowed ? CHART_THEMES : CHART_THEMES.filter(t => FREE_CHART_THEME_IDS.has(t.id));
  const themeName = CHART_THEMES.find(t => t.id === themeId)?.name || 'Theme';

  // ── Root-row subtitles: the current value, not a description ───────────────
  const roleId = settings?.displayRole || 'leader';
  const roleLabel = ROLES.find(r => r.id === roleId)?.label || 'Leading';
  const notationLabel = NOTATIONS.find(n => n[0] === (config?.display?.notation || 'letters'))?.[1] || 'Letters';
  const capo = song?.capo ? Number(song.capo) : 0;
  const arrangementNote = (song?.notes || '').trim();
  const cues = (song?.sections || [])
    .map(s => ({ section: s.type, note: (s.note || '').trim() }))
    .filter(c => c.note);
  const noteCount = cues.length + (arrangementNote ? 1 : 0);

  const back = (
    <button type="button" onClick={() => setPanel('root')} aria-label="Back"
      className="shrink-0 w-8 h-8 min-h-0 grid place-items-center rounded-lg bg-transparent border-none cursor-pointer text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
    </button>
  );

  const header = (title) => (
    <div className="shrink-0 flex items-center gap-1.5 px-2 py-2 border-b border-[var(--border-1)] bg-[var(--bg-1)]">
      {panel === 'root' ? <span className="w-2" /> : back}
      <span className="flex-1 min-w-0 text-label-13 font-semibold text-[var(--text-1)] truncate">{title}</span>
      <button type="button" onClick={onClose} aria-label="Close menu"
        className="shrink-0 w-8 h-8 min-h-0 grid place-items-center rounded-lg bg-transparent border-none cursor-pointer text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  );

  const title = panel === 'display' ? 'Display'
    : panel === 'music' ? 'The music'
      : panel === 'notes' ? 'Notes'
        : panel === 'screen' ? 'The screen'
          : song?.title || 'Menu';

  const body = (
    <div className="p-2 overflow-y-auto">
      {panel === 'root' && (
        <div className="flex flex-col">
          <MenuRow icon="display" label="Display" onClick={() => setPanel('display')}
            value={`${themeName} · ${config?.columns === 2 ? '2 columns' : '1 column'} · ${lyricSize}px`} />
          <MenuRow icon="music" label="The music" onClick={() => setPanel('music')}
            value={`${roleLabel} · ${notationLabel}${capo ? ` · capo ${capo}` : ''}`} />
          <MenuRow icon="notes" label="Notes" onClick={() => setPanel('notes')}
            value={noteCount ? `${noteCount} on this song` : 'None on this song'} />
          <MenuRow icon="screen" label="The screen" onClick={() => setPanel('screen')}
            value={settings?.keepAwake ? 'Staying awake' : 'Sleeps normally'} />
        </div>
      )}

      {/* ── Display ────────────────────────────────────────────────────────
          Two tabs, and the split is the owner's: LOOK is everything about how
          the page is painted, LAYOUT is everything about where things are.
          Tabs inside a panel are the pattern the app already has — Aa shipped
          three — so this is one fewer, not one more. */}
      {panel === 'display' && (
        <>
          <div className="flex gap-1 p-1 mb-1 rounded-xl bg-[var(--bg-1)] border border-[var(--border-1)]">
            {[['look', 'Look'], ['layout', 'Layout']].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setDisplayTab(id)}
                className={`flex-1 h-8 min-h-0 rounded-lg text-label-12 font-semibold cursor-pointer transition-colors border-none ${displayTab === id ? 'bg-[var(--bg-2)] text-[var(--text-1)]' : 'bg-transparent text-[var(--text-2)] hover:text-[var(--text-1)]'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="px-1.5 pb-1">
            {displayTab === 'look' && (
              <>
                <Label>Theme</Label>
                <div ref={themesRef} className="flex gap-2 overflow-x-auto -mx-1 px-1 py-1">
                  {visibleThemes.map(t => (
                    <button key={t.id} type="button" onClick={() => set('chartTheme', t.id)}
                      className="shrink-0 min-h-0 flex flex-col items-stretch rounded-lg overflow-hidden border transition-all cursor-pointer"
                      style={{ borderColor: themeId === t.id ? 'var(--color-brand)' : 'var(--border-1)', boxShadow: themeId === t.id ? '0 0 0 2px var(--color-brand)' : 'none', width: 76 }}
                      aria-label={`Theme: ${t.name}`} title={t.name}>
                      <div className="h-9 flex items-end justify-end px-2 py-1" style={{ background: t.bg, color: t.chord, fontFamily: 'var(--font-mono)' }}>
                        <span className="text-label-11 font-bold">Am</span>
                      </div>
                      <div className="px-1.5 py-1 text-label-10 font-medium text-[var(--text-1)] truncate" style={{ background: 'var(--bg-1)' }}>{t.name}</div>
                    </button>
                  ))}
                </div>

                <Label>Lyrics — size</Label>
                <Stepper value={lyricSize} min={10} max={40} onChange={onLyricSize} label="lyric size" />
                {styleAllowed ? (<>
                  <Label>Lyrics — font</Label>
                  <FontList activeId={settings?.chartLyricFont || DEFAULT_LYRIC_FONT_ID} onPick={(id) => set('chartLyricFont', id)} />
                  <Label>Lyrics — colour</Label>
                  <Swatches activeValue={settings?.chartLyricColor} onPick={(v) => set('chartLyricColor', v || undefined)} />
                </>) : <><Label>Lyrics — font &amp; colour</Label><ProHint>Upgrade to change the lyric font and colour.</ProHint></>}

                <Label>Chords — size</Label>
                <Stepper value={chordSize} min={8} max={40} onChange={onChordSize} label="chord size" />
                {styleAllowed ? (<>
                  <Label>Chords — font</Label>
                  <FontList activeId={settings?.chartChordFont || DEFAULT_CHORD_FONT_ID} onPick={(id) => set('chartChordFont', id)} />
                  <Label>Chords — colour</Label>
                  <Swatches activeValue={settings?.chartChordColor} onPick={(v) => set('chartChordColor', v || undefined)} />
                </>) : <><Label>Chords — font &amp; colour</Label><ProHint>Upgrade to change the chord font and colour.</ProHint></>}

                <Label>Line spacing</Label>
                <div className="flex items-center gap-2">
                  <Stepper value={Math.round((settings?.lyricLineHeight ?? 1.35) * 100)} min={100} max={240}
                    unit="%" label="line height" onChange={(v) => set('lyricLineHeight', Math.round(v) / 100)} />
                  {settings?.lyricLineHeight != null && <Pick onClick={() => set('lyricLineHeight', undefined)}>Reset</Pick>}
                </div>

                <Label>Gap between sections</Label>
                <div className="flex items-center gap-2">
                  <Stepper value={settings?.sectionSpacing ?? 24} min={8} max={64} label="section gap"
                    onChange={(v) => set('sectionSpacing', v)} />
                  {settings?.sectionSpacing != null && <Pick onClick={() => set('sectionSpacing', undefined)}>Reset</Pick>}
                </div>

                {/* Tabs are a LOOK concern — every one of these controls is about
                    how a tab is painted, so they belong beside the fonts and
                    colours rather than in a settings screen you leave the song
                    for. (Owner: "I think tab controls live here, right?") */}
                <Label>Tabs — size</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {[[0.85, 'Small'], [1, 'Medium'], [1.25, 'Large']].map(([v, l]) => (
                    <Pick key={l} active={(settings?.tabSize || 1) === v} onClick={() => set('tabSize', v)}>{l}</Pick>
                  ))}
                </div>

                <Label>Tabs — grid</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {[[1, '1/4'], [2, '1/8'], [4, '1/16']].map(([v, l]) => (
                    <Pick key={l} active={(settings?.tabSubdivision || 1) === v} onClick={() => set('tabSubdivision', v)}>{l}</Pick>
                  ))}
                </div>

                <Label>Tabs — colours</Label>
                <div className="flex flex-col gap-2">
                  {[
                    ['tabStringColor', 'Strings', '#9b9b9b'],
                    ['tabNumberColor', 'Numbers', '#e0a82e'],
                    ['tabBg', 'Background', '#101010'],
                  ].map(([key, label, fallback]) => (
                    <label key={key} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)] cursor-pointer">
                      <span className="flex-1 text-label-13 text-[var(--text-1)]">{label}</span>
                      <input
                        type="color" aria-label={`Tab ${label.toLowerCase()} colour`}
                        value={settings?.[key] || fallback}
                        onChange={(e) => set(key, e.target.value)}
                        className="w-9 h-7 min-h-0 rounded border border-[var(--border-1)] bg-transparent cursor-pointer p-0"
                      />
                      {settings?.[key] && (
                        <button type="button" onClick={(e) => { e.preventDefault(); set(key, undefined); }}
                          className="min-h-0 text-label-11 text-[var(--text-2)] hover:text-[var(--text-1)] bg-transparent border-none cursor-pointer underline underline-offset-2">
                          Reset
                        </button>
                      )}
                    </label>
                  ))}
                </div>
              </>
            )}

            {displayTab === 'layout' && (
              <>
                <PickRow label="Columns" value={settings?.defaultColumns === 2 ? 2 : 1}
                  options={[[1, 'One'], [2, 'Two']]} onChange={(v) => set('defaultColumns', v)} />

                <PickRow label="Structure — where" value={settings?.structurePosition || 'top'}
                  options={[['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right'], ['off', 'Hidden']]}
                  onChange={(v) => set('structurePosition', v)} />

                <PickRow label="Structure — style" value={settings?.ribbonStyle || 'codes'}
                  options={[['codes', 'Boxes'], ['chips', 'Chips'], ['numbered', 'Inline'], ['dots', 'Dots'], ['dotlabel', 'Dots+label']]}
                  onChange={(v) => set('ribbonStyle', v)} />

                <PickRow label="Under the top bar" value={settings?.readerTopBar || 'ribbon'}
                  options={[['ribbon', 'Song structure'], ['setlist', 'The set']]}
                  onChange={(v) => set('readerTopBar', v)} />

                <PickRow label="Section heading" value={settings?.readerHeading || 'name'}
                  options={[['name', 'Full name'], ['code', 'Letters'], ['caps', 'ALL CAPS']]}
                  onChange={(v) => set('readerHeading', v)} />

                <PickRow label="Heading pins as you scroll" value={settings?.readerSticky || 'on'}
                  options={[['on', 'Pinned'], ['off', 'Not pinned']]}
                  onChange={(v) => set('readerSticky', v)} />

                <PickRow label="Section style" value={settings?.readerSectionStyle || 'bar'}
                  options={[['bar', 'Bar'], ['plain', 'No line'], ['block', 'Block'], ['card', 'Card']]}
                  onChange={(v) => set('readerSectionStyle', v)} />

                <PickRow label="Repeated sections" value={settings?.duplicateSections || 'condensed'}
                  options={[['full', 'Full'], ['condensed', 'Condensed']]}
                  onChange={(v) => set('duplicateSections', v)} />

                <PickRow label="Song to song" value={settings?.readerNav || 'footer'}
                  options={[['footer', 'Bottom bar'], ['pill', 'Floating pill'], ['edge', 'Edge arrows'], ['swipe', 'Swipe']]}
                  onChange={(v) => set('readerNav', v)} />

                {/* Kept deliberately small and last. It is the emergency lever —
                    the owner's words: "I don't think this is where it should be
                    set, but it's ok to have it small in case of emergency." The
                    real answer is the role picker under The music. */}
                <Label>In a pinch</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {[['chords', 'Chords + lyrics'], ['lyrics', 'Lyrics only'], ['chordsonly', 'Chords only']].map(([v, l]) => (
                    <Pick key={v} active={(settings?.displayMode || 'chords') === v} onClick={() => set('displayMode', v)}>{l}</Pick>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── The music ──────────────────────────────────────────────────────
          Named for what it holds: how the music is SPELLED, not how the page
          looks. Accidentals moved here out of Display for that reason. No key
          change — element 1's key pill owns transpose, and a second control for
          it is a second answer. */}
      {panel === 'music' && (
        <div className="px-1.5 pb-1">
          <Label>You&rsquo;re playing</Label>
          <div className="flex gap-1.5 flex-wrap">
            {ROLES.map(r => (
              <Pick key={r.id} active={roleId === r.id}
                onClick={() => {
                  // Applies its settings VISIBLY. The alternative — a role that
                  // silently overrides the display panel — is the exact bug
                  // that turned the hub's Chart tab into a second Lyrics tab.
                  set('displayRole', r.id);
                  Object.entries(r.applies).forEach(([k, v]) => set(k, v));
                }}>
                {r.label}
              </Pick>
            ))}
          </div>
          <p className="mt-2 mb-0 text-copy-13 text-[var(--text-2)]">
            Sets what you see: Vocals and Drums drop the chords, Guitar and Bass open their own tabs.
            Everything stays changeable under Display.
          </p>

          <PickRow label="Chord names" value={config?.display?.notation || 'letters'}
            options={NOTATIONS} onChange={(v) => set('notation', v)} />

          <PickRow label="Sharps or flats" value={settings?.accidentals || 'auto'}
            options={[['auto', 'Follow key'], ['sharps', '♯ Sharps'], ['flats', '♭ Flats']]}
            onChange={(v) => set('accidentals', v)} />

          <Label>Capo</Label>
          {capo ? (
            <div className="px-3 py-2.5 rounded-xl border border-[var(--border-1)] bg-[var(--bg-1)]">
              <span className="block text-label-13 font-medium text-[var(--text-1)]">Capo {capo}</span>
              {/* Truthful rather than a knob that does nothing: the chart shows
                  SOUNDING chords today. Shapes-for-a-capoed-player is element
                  19 and is a real piece of work, not a toggle. */}
              <span className="block text-copy-13 text-[var(--text-2)] mt-0.5">
                The chords below are what the song sounds like. Shapes for a capoed player are coming.
              </span>
            </div>
          ) : (
            <p className="m-0 text-copy-13 text-[var(--text-2)]">No capo on this arrangement.</p>
          )}
        </div>
      )}

      {/* ── Notes ──────────────────────────────────────────────────────────
          Every note on this song, in one place — the owner asked to see them
          together. Read-only for now: WRITING a note (element 22, practice) is
          the piece with real work behind it. */}
      {panel === 'notes' && (
        <div className="px-1.5 pb-1">
          {arrangementNote && (
            <>
              <Label>About this arrangement</Label>
              <p className="m-0 text-copy-13 text-[var(--text-1)] whitespace-pre-wrap">{arrangementNote}</p>
            </>
          )}
          {cues.length > 0 && (
            <>
              <Label>Band cues</Label>
              <div className="flex flex-col gap-1.5">
                {cues.map((c, i) => (
                  <div key={i} className="px-3 py-2 rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)]">
                    <span className="block text-label-11 uppercase tracking-wider text-[var(--text-2)]">{c.section}</span>
                    <span className="block text-copy-13 text-[var(--text-1)] mt-0.5">{c.note}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {noteCount === 0 && (
            <p className="m-0 py-4 text-center text-copy-13 text-[var(--text-2)]">
              Nothing written on this song yet.
            </p>
          )}
          {mode === 'practice' && (
            <p className="mt-4 mb-0 text-copy-13 text-[var(--text-2)]">
              Writing a note from here is coming to practice.
            </p>
          )}
        </div>
      )}

      {panel === 'screen' && (
        <div className="px-1.5 pb-1 flex flex-col gap-2">
          <Switch
            checked={settings?.keepAwake === true}
            onChange={(v) => set('keepAwake', v)}
            label="Keep the screen awake"
            description="While you're reading. Turns itself off when you leave."
          />
          <p className="m-0 text-copy-13 text-[var(--text-2)]">
            Rotation follows your device. A way to rotate just this screen is coming.
          </p>
        </div>
      )}
    </div>
  );

  // Sheet on a phone, popover on a desktop. Both leave the chart visible — the
  // panel rule is the reason the sheet is capped rather than full-height.
  return createPortal((
    <>
      <button type="button" aria-label="Close menu" tabIndex={-1} onClick={onClose}
        className={`fixed inset-0 z-[119] border-none cursor-default ${phone ? 'bg-black/30' : 'bg-transparent'}`} />
      <div
        role="dialog" aria-label="Reader menu"
        className={
          'fixed z-[120] border border-[var(--border-2)] bg-[var(--ds-background-100)] shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden flex flex-col '
          + (phone ? 'left-0 right-0 bottom-0 rounded-t-2xl' : 'rounded-2xl')
        }
        style={phone
          ? {
            maxHeight: '62vh',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            animation: 'sheet-up 200ms cubic-bezier(0.32, 0.72, 0, 1)',
          }
          : {
            top, ...(left != null ? { left } : { right }), width: W,
            maxHeight: '74vh', animation: 'pop-in 120ms ease-out',
          }}
      >
        {header(title)}
        {body}
      </div>
    </>
  ), document.body);
}
