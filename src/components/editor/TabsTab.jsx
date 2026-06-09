import { useMemo, useState, useCallback } from 'react';
import { parseSongMd, songToMd, parseTabBlock } from '../../parser';
import { sectionStyle } from '../../music';
import TabBlock from '../TabBlock';
import { Button } from '../ui/Button';
import TabGridEditor from './TabGridEditor';
import { TAB_INSTRUMENTS } from './tabInstruments';

// Turn the grid editor's saved string into a clean tab object — raw holds only
// the string lines so it round-trips.
function tabObjectFromEditor(saved) {
  const lines = saved.split('\n');
  const tm = saved.match(/\{tab(?:,\s*time:\s*([^}]+))?\}/);
  const time = tm && tm[1] ? tm[1].trim() : null;
  const stringLines = lines.map(l => l.trim()).filter(l => /^[eBGDAE]\|/.test(l));
  const tab = parseTabBlock(stringLines);
  tab.time = time;
  return tab;
}

function instrumentOf(tab) {
  const n = tab?.strings?.length || 6;
  if (n <= 4) return 'bass';
  if (n === 5) return 'bass5';
  return 'electric';
}

// Tabs mode — a first-class workspace (sibling of Arrange/Advanced) to build
// and organize the song's tabs and insert them into sections.
export default function TabsTab({ md, onChange, subdivision = 4 }) {
  const song = useMemo(() => { try { return parseSongMd(md); } catch { return null; } }, [md]);
  const sections = useMemo(() => song?.sections || [], [song]);

  const [instrument, setInstrument] = useState('electric');
  const [targetSec, setTargetSec] = useState(0);
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
  const deleteTab = (secIdx, lineIdx) => {
    if (!song) return;
    emit({ ...song, sections: song.sections.map((s, i) => i !== secIdx ? s : ({ ...s, lines: s.lines.filter((_, li) => li !== lineIdx) })) });
  };

  const handleEditorSave = (saved) => {
    const tabObj = tabObjectFromEditor(saved);
    if (editorFor.mode === 'new') insertTab(editorFor.secIdx, tabObj);
    else updateTab(editorFor.secIdx, editorFor.lineIdx, tabObj);
    setEditorFor(null);
  };

  if (!song) {
    return <div className="flex items-center justify-center h-40 text-[var(--ds-gray-600)]">Start a song in the Advanced tab to add tabs</div>;
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Create row */}
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
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-label-10 uppercase tracking-wider text-[var(--ds-gray-500)]">Add to</span>
          <select
            value={targetSec}
            onChange={e => setTargetSec(Number(e.target.value))}
            className="h-8 px-2 rounded-md bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] text-label-12 text-[var(--ds-gray-1000)] outline-none"
          >
            {sections.map((s, i) => <option key={i} value={i}>{s.type}</option>)}
          </select>
        </label>
        <Button
          variant="brand"
          size="sm"
          disabled={sections.length === 0}
          onClick={() => setEditorFor({ mode: 'new', secIdx: targetSec, tab: null, strings: TAB_INSTRUMENTS[instrument].strings })}
        >
          + New tab
        </Button>
      </div>

      {/* Gallery */}
      <div className="flex-1 overflow-auto pl-3 pr-6 py-4">
        {tabs.length === 0 ? (
          <p className="text-copy-13 text-[var(--ds-gray-600)] italic m-0">No tabs yet. Pick an instrument and section, then “New tab”.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
          {tabs.map((t, i) => {
            const st = sectionStyle(t.sectionType);
            return (
              <div key={i} className="rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-label-11 font-black uppercase tracking-wider" style={{ color: st.b }}>{t.sectionType}</span>
                    <span className="text-label-10 text-[var(--ds-gray-500)]">{TAB_INSTRUMENTS[instrumentOf(t.tab)]?.label || 'Guitar'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="secondary" size="xs" onClick={() => setEditorFor({ mode: 'edit', secIdx: t.secIdx, lineIdx: t.lineIdx, tab: t.tab, strings: TAB_INSTRUMENTS[instrumentOf(t.tab)].strings })}>Edit</Button>
                    <Button variant="ghost" size="xs" onClick={() => deleteTab(t.secIdx, t.lineIdx)}>Delete</Button>
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
          subdivision={subdivision}
          time={editorFor.tab?.time || song.time || '4/4'}
          onSave={handleEditorSave}
          onClose={() => setEditorFor(null)}
        />
      )}
    </div>
  );
}
