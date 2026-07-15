import { useMemo, useState, useCallback } from 'react';
import { parseSongMd, songToMd, parseTabBlock } from '../../parser';
import { sectionStyle } from '../../music';
import TabBlock from '../TabBlock';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { showUndoToast } from '../../lib/undoToast';
import TabGridEditor from './TabGridEditorV2';
import { TAB_INSTRUMENTS, instrumentForStrings } from './tabInstruments';

function tabObjectFromEditor(saved) {
  const lines = saved.split('\n');
  const tm = saved.match(/\{tab(?:,\s*time:\s*([^}]+))?\}/);
  const time = tm && tm[1] ? tm[1].trim() : null;
  const stringLines = lines.map(l => l.trim()).filter(l => /^[eBGDAE]\|/.test(l));
  const tab = parseTabBlock(stringLines);
  tab.time = time;
  return tab;
}

function nextTabName(library = []) {
  const used = new Set(library.map(t => t.name));
  let n = library.length + 1;
  while (used.has(`Tab ${n}`)) n++;
  return `Tab ${n}`;
}

// Count how many section lines reference a named tab.
function countRefs(sections, name) {
  let n = 0;
  for (const s of sections) for (const l of (s.lines || [])) if (l && typeof l === 'object' && l.type === 'tabref' && l.name === name) n++;
  return n;
}

// Section types this tab is placed in (deduped, in song order) — shown as chips
// so the writer can see where a reusable block lives at a glance.
function placementSections(sections, name) {
  const out = [];
  for (const s of sections) {
    if ((s.lines || []).some(l => l && typeof l === 'object' && l.type === 'tabref' && l.name === name)) {
      if (!out.includes(s.type)) out.push(s.type);
    }
  }
  return out;
}

// Default instrument for a brand-new tab — the editor lets the user switch
// strings/tuning, so this is just a sensible starting point.
const DEFAULT_INSTRUMENT = 'acoustic';

const PencilIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
);
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6l-.9 13a2 2 0 0 1-2 1.9H7.9a2 2 0 0 1-2-1.9L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);

// Tabs mode — a library of independent, reusable tab blocks. Create/rename/edit
// them here; place them into sections from Arrange's “+ Add → Tab”. Blocks live
// in a trailing region of the .md and are referenced by name, so one block can
// be reused in many spots and edits propagate everywhere.
export default function TabsTab({ md, onChange, subdivision = 1 }) {
  const song = useMemo(() => { try { return parseSongMd(md); } catch { return null; } }, [md]);
  const library = useMemo(() => song?.tabLibrary || [], [song]);

  const [editorFor, setEditorFor] = useState(null);
  const [renaming, setRenaming] = useState(null); // { name, value }

  const emit = useCallback((nextSong) => onChange(songToMd(nextSong)), [onChange]);

  const createTab = useCallback((tab, desiredName) => {
    if (!song) return;
    const used = new Set(library.map(t => t.name));
    let name = (desiredName || '').trim();
    if (!name || used.has(name)) name = nextTabName(library);
    emit({ ...song, tabLibrary: [...library, { name, tab }] });
  }, [song, library, emit]);


  const renameTab = useCallback((oldName, raw) => {
    const newName = (raw || '').trim();
    setRenaming(null);
    if (!song || !newName || newName === oldName) return;
    if (library.some(t => t.name === newName)) return; // keep names unique
    emit({
      ...song,
      tabLibrary: library.map(t => t.name === oldName ? { ...t, name: newName } : t),
      sections: song.sections.map(s => ({
        ...s,
        lines: (s.lines || []).map(l => (l && typeof l === 'object' && l.type === 'tabref' && l.name === oldName) ? { ...l, name: newName } : l),
      })),
    });
  }, [song, library, emit]);

  const deleteTab = useCallback((name) => {
    if (!song) return;
    const refs = countRefs(song.sections, name);
    const prevSong = song; // snapshot — delete also strips every placement
    emit({
      ...song,
      tabLibrary: library.filter(t => t.name !== name),
      sections: song.sections.map(s => ({
        ...s,
        lines: (s.lines || []).filter(l => !(l && typeof l === 'object' && l.type === 'tabref' && l.name === name)),
      })),
    });
    showUndoToast({
      title: `Deleted “${name}”`,
      description: refs > 0 ? `Removed the block and ${refs} ${refs === 1 ? 'placement' : 'placements'}.` : 'Removed the saved tab block.',
      onUndo: () => emit(prevSong),
    });
  }, [song, library, emit]);

  const handleEditorSave = useCallback((saved, opts = {}) => {
    const tab = tabObjectFromEditor(saved);
    // Carry the chosen instrument so it round-trips through the .md format and
    // can be filtered in the chart/practice/live views.
    const instrument = opts.instrument || editorFor.instrument;
    if (instrument) tab.instrument = instrument;
    const desiredName = (opts.name || '').trim();
    if (editorFor.mode === 'new') {
      createTab(tab, desiredName);
    } else if (song) {
      // Rename (updating every placement) + content in a single write so the
      // second op doesn't run against a stale library.
      const oldName = editorFor.name;
      const newName = desiredName && desiredName !== oldName && !library.some(t => t.name === desiredName) ? desiredName : oldName;
      emit({
        ...song,
        tabLibrary: library.map(t => t.name === oldName ? { name: newName, tab } : t),
        sections: newName === oldName ? song.sections : song.sections.map(s => ({
          ...s,
          lines: (s.lines || []).map(l => (l && typeof l === 'object' && l.type === 'tabref' && l.name === oldName) ? { ...l, name: newName } : l),
        })),
      });
    }
    setEditorFor(null);
  }, [editorFor, createTab, song, library, emit]);

  if (!song) {
    return <div className="flex items-center justify-center h-40 text-[var(--ds-gray-600)]">Start a song in the Advanced tab to add tabs</div>;
  }

  // Open the grid editor for a brand-new tab on the chosen instrument.
  const startNewTab = (instrId) => {
    setEditorFor({
      mode: 'new',
      tab: null,
      strings: TAB_INSTRUMENTS[instrId].strings,
      tunings: TAB_INSTRUMENTS[instrId].tunings,
      instrument: instrId,
      counts: TAB_INSTRUMENTS[instrId].counts,
    });
  };

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Header — title + a single "New tab" action. Clicking it opens the grid
          editor straight away (strings/tuning are adjustable inside), so there's
          no confusing "pick an instrument at the top" detour. */}
      <div className="shrink-0 flex items-center gap-3 pl-3 pr-6 py-2.5 border-b border-[var(--border-1)]">
        <div className="min-w-0">
          <span className="text-label-11 font-semibold uppercase tracking-wider text-[var(--ds-gray-600)]">Tab library</span>
          <span className="text-label-10 text-[var(--ds-gray-500)] ml-2">{library.length} {library.length === 1 ? 'block' : 'blocks'}</span>
        </div>
        <div className="ml-auto">
          <Button variant="brand" size="sm" onClick={() => startNewTab(DEFAULT_INSTRUMENT)}>+ New tab</Button>
        </div>
      </div>

      {/* Library */}
      <div className="flex-1 overflow-auto pl-3 pr-6 py-4">
        {library.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full max-w-sm mx-auto gap-3 py-10">
            <div className="w-12 h-12 rounded-xl grid place-items-center bg-[var(--ds-gray-100)] border border-[var(--ds-gray-300)] text-[var(--ds-gray-500)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="16" x2="20" y2="16" /></svg>
            </div>
            <p className="text-copy-14 font-semibold text-[var(--ds-gray-1000)] m-0">No tabs yet</p>
            <p className="text-copy-13 text-[var(--ds-gray-600)] m-0">Create a reusable riff or lick once, then drop it into any section from Arrange’s “+ Add”.</p>
            <Button variant="brand" size="sm" onClick={() => startNewTab(DEFAULT_INSTRUMENT)}>+ New tab</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
          {library.map((entry) => {
            const instr = entry.tab?.instrument || instrumentForStrings(entry.tab?.strings?.length);
            const refs = countRefs(song.sections, entry.name);
            const places = placementSections(song.sections, entry.name);
            const isRenaming = renaming?.name === entry.name;
            return (
              <div key={entry.name} className="rounded-xl border border-[var(--border-1)] bg-[var(--ds-background-100)] p-3">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renaming.value}
                        onChange={e => setRenaming({ name: entry.name, value: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') renameTab(entry.name, renaming.value); else if (e.key === 'Escape') setRenaming(null); }}
                        onBlur={() => renameTab(entry.name, renaming.value)}
                        className="text-label-13 font-bold bg-[var(--ds-gray-100)] border border-[var(--color-brand-border)] rounded-md px-1.5 py-0.5 text-[var(--ds-gray-1000)] outline-none min-w-0 w-[140px]"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRenaming({ name: entry.name, value: entry.name })}
                        title="Rename"
                        className="text-label-13 font-bold text-[var(--ds-gray-1000)] bg-transparent border-none cursor-pointer p-0 truncate hover:text-[var(--color-brand-text)]"
                      >
                        {entry.name}
                      </button>
                    )}
                    <span className="text-label-10 text-[var(--ds-gray-500)] shrink-0">{TAB_INSTRUMENTS[instr]?.label || 'Guitar'}</span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <IconButton variant="ghost" size="xs" aria-label="Edit tab" title="Edit"
                      onClick={() => setEditorFor({ mode: 'edit', name: entry.name, tab: entry.tab, strings: entry.tab.strings.map(s => s.note), tunings: TAB_INSTRUMENTS[instr].tunings, instrument: instr, counts: TAB_INSTRUMENTS[instr].counts })}>
                      <PencilIcon />
                    </IconButton>
                    <IconButton variant="error" size="xs" aria-label="Delete tab" title="Delete" onClick={() => deleteTab(entry.name)}>
                      <TrashIcon />
                    </IconButton>
                  </div>
                </div>
                <TabBlock data={entry.tab} />
                {/* Placement chips — where this block is used across the song. */}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {refs === 0 ? (
                    <span className="text-label-10 text-[var(--ds-gray-500)] italic">Unused — not placed in any section yet</span>
                  ) : (
                    <>
                      <span className="text-label-10 text-[var(--ds-gray-500)] mr-0.5">Used in</span>
                      {places.map(t => {
                        const st = sectionStyle(t);
                        return (
                          <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wide border border-[var(--border-1)] bg-[var(--ds-background-200)]" style={{ color: st.b }}>
                            {t}
                          </span>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {editorFor && (
        <TabGridEditor
          initialTab={editorFor.tab}
          initialName={editorFor.mode === 'new' ? nextTabName(library) : (editorFor.name || '')}
          strings={editorFor.strings}
          tunings={editorFor.tunings}
          instrument={editorFor.instrument}
          counts={editorFor.counts}
          subdivision={subdivision}
          time={editorFor.tab?.time || song.time || '4/4'}
          onSave={handleEditorSave}
          onClose={() => setEditorFor(null)}
        />
      )}
    </div>
  );
}
