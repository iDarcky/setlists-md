import { useMemo, useState } from 'react';
import { parseTabBlock } from '../../parser';
import { sectionStyle } from '../../music';
import TabBlock from '../TabBlock';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import TabGridEditor from './TabGridEditor';
import { TAB_INSTRUMENTS } from './tabInstruments';

// Turn the grid editor's saved string ("{tab, time: 4/4}\n e|..\n.. \n{/tab}")
// into a clean tab object — raw holds only the string lines so it round-trips.
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
  return (tab?.strings?.length || 6) <= 4 ? 'bass' : 'electric';
}

// Tab mode shell — build/organize a song's tabs and insert them into sections.
export default function TabManager({ song, defaultTime, onInsert, onUpdateTab, onDeleteTab, onClose }) {
  const sections = useMemo(() => song?.sections || [], [song]);
  const [instrument, setInstrument] = useState('electric');
  const [targetSec, setTargetSec] = useState(0);
  const [editorFor, setEditorFor] = useState(null); // { mode:'new'|'edit', secIdx, lineIdx, tab, strings }

  // All tab blocks in the song, with their location.
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

  const openNew = () => {
    setEditorFor({ mode: 'new', secIdx: targetSec, tab: null, strings: TAB_INSTRUMENTS[instrument].strings });
  };
  const openEdit = (t) => {
    setEditorFor({ mode: 'edit', secIdx: t.secIdx, lineIdx: t.lineIdx, tab: t.tab, strings: TAB_INSTRUMENTS[instrumentOf(t.tab)].strings });
  };
  const handleEditorSave = (saved) => {
    const tabObj = tabObjectFromEditor(saved);
    if (editorFor.mode === 'new') onInsert(editorFor.secIdx, tabObj);
    else onUpdateTab(editorFor.secIdx, editorFor.lineIdx, tabObj);
    setEditorFor(null);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full sm:w-[640px] max-h-[88vh] bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.5)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ds-gray-300)]">
          <h2 className="text-heading-16 font-semibold text-[var(--ds-gray-1000)] m-0">Tabs</h2>
          <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</IconButton>
        </div>

        {/* Add a tab */}
        <div className="px-4 py-3 border-b border-[var(--ds-gray-200)] flex flex-wrap items-end gap-2">
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
          <Button variant="brand" size="sm" onClick={openNew} disabled={sections.length === 0}>+ New tab</Button>
        </div>

        {/* Existing tabs */}
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-3">
          {tabs.length === 0 ? (
            <p className="text-copy-13 text-[var(--ds-gray-600)] italic m-0">No tabs yet. Pick an instrument and section, then “New tab”.</p>
          ) : (
            tabs.map((t, i) => {
              const st = sectionStyle(t.sectionType);
              return (
                <div key={i} className="rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-label-11 font-black uppercase tracking-wider" style={{ color: st.b }}>{t.sectionType}</span>
                      <span className="text-label-10 text-[var(--ds-gray-500)]">{TAB_INSTRUMENTS[instrumentOf(t.tab)].label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="secondary" size="xs" onClick={() => openEdit(t)}>Edit</Button>
                      <Button variant="ghost" size="xs" onClick={() => onDeleteTab(t.secIdx, t.lineIdx)}>Delete</Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto"><TabBlock data={t.tab} /></div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {editorFor && (
        <TabGridEditor
          initialTab={editorFor.tab}
          strings={editorFor.strings}
          time={editorFor.tab?.time || defaultTime || '4/4'}
          onSave={handleEditorSave}
          onClose={() => setEditorFor(null)}
        />
      )}
    </div>
  );
}
