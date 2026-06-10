import { useMemo, useState, useCallback } from 'react';
import { parseSongMd, songToMd, parseTabBlock } from '../../parser';
import { sectionStyle } from '../../music';
import TabBlock from '../TabBlock';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { useConfirm } from '../ui/useConfirmHook';
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

const PencilIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
);
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6l-.9 13a2 2 0 0 1-2 1.9H7.9a2 2 0 0 1-2-1.9L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);

// Tabs mode — create and organize the song's tabs. Creating a tab (instrument,
// strings, tuning, target section) happens in the tab tool; the gallery lists,
// edits and deletes them.
export default function TabsTab({ md, onChange, subdivision = 4 }) {
  const song = useMemo(() => { try { return parseSongMd(md); } catch { return null; } }, [md]);
  const sections = useMemo(() => song?.sections || [], [song]);
  const confirm = useConfirm();

  const [instrument, setInstrument] = useState('electric');
  const [editorFor, setEditorFor] = useState(null);

  const emit = useCallback((nextSong) => onChange(songToMd(nextSong)), [onChange]);

  const tabs = useMemo(() => {
    const out = [];
    sections.forEach((sec, secIdx) => {
      (sec.lines || []).forEach((line, lineIdx) => {
        if (line && typeof line === 'object' && line.type === 'tab') {
          out.push({ secIdx, lineIdx, tab: line, sectionType: sec.type });
        }
      });
    });
    return out;
  }, [sections]);

  const insertTab = (secIdx, tabObj) => {
    if (!song) return;
    emit({ ...song, sections: song.sections.map((s, i) => i !== secIdx ? s : ({ ...s, lines: [...s.lines, tabObj] })) });
  };
  const updateTab = (secIdx, lineIdx, tabObj) => {
    if (!song) return;
    emit({ ...song, sections: song.sections.map((s, i) => i !== secIdx ? s : ({ ...s, lines: s.lines.map((l, li) => li === lineIdx ? tabObj : l) })) });
  };
  const deleteTab = async (secIdx, lineIdx) => {
    if (!song) return;
    const ok = await confirm({ title: 'Delete this tab?', description: 'This removes the tab from its section.', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    emit({ ...song, sections: song.sections.map((s, i) => i !== secIdx ? s : ({ ...s, lines: s.lines.filter((_, li) => li !== lineIdx) })) });
  };

  const handleEditorSave = (saved, targetSec) => {
    const tabObj = tabObjectFromEditor(saved);
    if (editorFor.mode === 'new') insertTab(targetSec ?? 0, tabObj);
    else updateTab(editorFor.secIdx, editorFor.lineIdx, tabObj);
    setEditorFor(null);
  };

  if (!song) {
    return <div className="flex items-center justify-center h-40 text-[var(--ds-gray-600)]">Start a song in the Advanced tab to add tabs</div>;
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Create row — instrument + new tab. String count, tuning and target
          section are chosen inside the tab tool. */}
      <div className="shrink-0 flex flex-wrap items-end gap-2 pl-3 pr-6 py-3 border-b border-[var(--ds-gray-200)] bg-[var(--ds-background-200)]">
        <label className="flex flex-col gap-1">
          <span className="text-label-10 uppercase tracking-wider text-[var(--ds-gray-500)]">Instrument</span>
          <div className="flex gap-1">
            {Object.entries(TAB_INSTRUMENTS).map(([id, cfg]) => (
              <button
                key={id}
                type="button"
                onClick={() => setInstrument(id)}
                className={`px-2.5 py-1 rounded-md text-label-12 font-semibold cursor-pointer border ${instrument === id ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] border-[var(--color-brand-border)]' : 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-700)] border-[var(--ds-gray-400)]'}`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </label>
        <Button
          variant="brand"
          size="sm"
          disabled={sections.length === 0}
          onClick={() => setEditorFor({
            mode: 'new',
            tab: null,
            strings: TAB_INSTRUMENTS[instrument].strings,
            tunings: TAB_INSTRUMENTS[instrument].tunings,
            instrument,
            counts: TAB_INSTRUMENTS[instrument].counts,
            sections,
          })}
        >
          + New tab
        </Button>
      </div>

      {/* Gallery */}
      <div className="flex-1 overflow-auto pl-3 pr-6 py-4">
        {tabs.length === 0 ? (
          <p className="text-copy-13 text-[var(--ds-gray-600)] italic m-0">No tabs yet. Pick an instrument, then “New tab”.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
          {tabs.map((t, i) => {
            const st = sectionStyle(t.sectionType);
            const instr = instrumentForStrings(t.tab?.strings?.length);
            return (
              <div key={i} className="rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-label-11 font-black uppercase tracking-wider" style={{ color: st.b }}>{t.sectionType}</span>
                    <span className="text-label-10 text-[var(--ds-gray-500)]">{TAB_INSTRUMENTS[instr]?.label || 'Guitar'}</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <IconButton variant="ghost" size="xs" aria-label="Edit tab" title="Edit"
                      onClick={() => setEditorFor({ mode: 'edit', secIdx: t.secIdx, lineIdx: t.lineIdx, tab: t.tab, strings: t.tab.strings.map(s => s.note), tunings: TAB_INSTRUMENTS[instr].tunings, instrument: instr, counts: TAB_INSTRUMENTS[instr].counts })}>
                      <PencilIcon />
                    </IconButton>
                    <IconButton variant="error" size="xs" aria-label="Delete tab" title="Delete" onClick={() => deleteTab(t.secIdx, t.lineIdx)}>
                      <TrashIcon />
                    </IconButton>
                  </div>
                </div>
                <div className="overflow-x-auto"><TabBlock data={t.tab} /></div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {editorFor && (
        <TabGridEditor
          initialTab={editorFor.tab}
          strings={editorFor.strings}
          tunings={editorFor.tunings}
          instrument={editorFor.instrument}
          counts={editorFor.counts}
          sections={editorFor.sections}
          subdivision={subdivision}
          time={editorFor.tab?.time || song.time || '4/4'}
          onSave={handleEditorSave}
          onClose={() => setEditorFor(null)}
        />
      )}
    </div>
  );
}
