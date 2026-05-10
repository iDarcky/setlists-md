import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { transposeKey, ALL_KEYS, semitonesBetween } from '../music';
import { resolveSongView } from '../arrangements';
import SectionBlock from './SectionBlock';
import { StructureRibbon } from './StructureRibbon';
import FloatingNavPill from './ui/FloatingNavPill';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/Select';
import NoteContent from './ui/NoteContent';
import { headerFrostStyle } from '../lib/headerFrost';

export default function PracticeView({ setlist, songs, onBack, onFinish, onUpdateSong, onUpdateSetlist, defaultFontSize, defaultColumns }) {
  const [idx, setIdx] = useState(0);
  const [selectedKey, setSelectedKey] = useState(null);
  const fontSize = defaultFontSize || 18;
  const columns = defaultColumns || 1;
  const [showStructureEditor, setShowStructureEditor] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const scrollRef = useRef(null);

  // Session metrics for the finale screen.
  const [sessionStartTime] = useState(() => Date.now());
  const startTimeRef = useRef(sessionStartTime);
  const transposeCountRef = useRef(0);
  const cueCountRef = useRef(0);
  const farthestIdxRef = useRef(0);
  const touchedSongIdsRef = useRef(new Set());

  const resolved = useMemo(() =>
    setlist.items
      .map((it, rawIdx) => {
        if (it.type === 'break') return { ...it, isBreak: true, _rawIdx: rawIdx };
        let raw = songs.find(s => s.id === it.songId);
        if (!raw && it.songTitle) raw = songs.find(s => s.title === it.songTitle);
        const song = resolveSongView(raw, it.arrangementId);
        return song ? { ...it, song, _rawIdx: rawIdx } : null;
      })
      .filter(Boolean),
    [setlist, songs]
  );

  const cur = resolved[idx] || null;
  const next = resolved[idx + 1] || null;

  // Reset key whenever the current item changes
  useEffect(() => {
    if (cur && !cur.isBreak) {
      setSelectedKey(transposeKey(cur.song.key, cur.transpose || 0));
    }
  }, [idx, cur?.song?.id]);

  const goNext = useCallback(() => {
    setIdx(p => {
      const next = Math.min(resolved.length - 1, p + 1);
      if (next > farthestIdxRef.current) farthestIdxRef.current = next;
      return next;
    });
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [resolved.length]);

  const goPrev = useCallback(() => {
    setIdx(p => Math.max(0, p - 1));
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleFinish = useCallback(() => {
    onFinish?.({
      startTime: startTimeRef.current,
      farthestIdx: farthestIdxRef.current,
      transposeCount: transposeCountRef.current,
      cueCount: cueCountRef.current,
      touchedSongIds: Array.from(touchedSongIdsRef.current),
    });
  }, [onFinish]);

  // Keyboard navigation (ignore when editing text)
  useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  // Save key change → persists to setlist item transpose
  const handleKeyChange = useCallback((newKey) => {
    setSelectedKey(newKey);
    if (!cur || cur.isBreak) return;
    const semitones = semitonesBetween(cur.song.key, newKey);
    if (semitones !== (cur.transpose || 0)) {
      transposeCountRef.current += 1;
      touchedSongIdsRef.current.add(cur.song.id);
    }
    onUpdateSetlist?.({
      ...setlist,
      items: setlist.items.map((it, i) =>
        i === cur._rawIdx ? { ...it, transpose: semitones } : it
      ),
    });
  }, [cur, setlist, onUpdateSetlist]);

  // Save band cue (section.note) → persists to song
  const handleSaveCue = useCallback((sectionIdx, newNote) => {
    if (!cur || cur.isBreak) return;
    cueCountRef.current += 1;
    touchedSongIdsRef.current.add(cur.song.id);
    onUpdateSong?.({
      ...cur.song,
      sections: cur.song.sections.map((sec, i) =>
        i === sectionIdx ? { ...sec, note: newNote } : sec
      ),
    });
  }, [cur, onUpdateSong]);

  // Save setlist note → persists to setlist item
  const handleSaveNote = useCallback((newNote) => {
    if (!cur || cur.isBreak) return;
    touchedSongIdsRef.current.add(cur.song.id);
    onUpdateSetlist?.({
      ...setlist,
      items: setlist.items.map((it, i) =>
        i === cur._rawIdx ? { ...it, notes: newNote } : it
      ),
    });
  }, [cur, setlist, onUpdateSetlist]);

  // Save structure update → persists to song
  const handleUpdateStructure = useCallback((newStructure) => {
    if (!cur || cur.isBreak) return;
    onUpdateSong?.({
      ...cur.song,
      structure: newStructure,
    });
  }, [cur, onUpdateSong]);

  if (!resolved.length) {
    return (
      <div className="p-10 text-center text-[var(--ds-gray-600)] text-copy-14">
        No items in setlist
      </div>
    );
  }

  if (!cur) return null;

  const displayKey = cur.isBreak ? null : (selectedKey || transposeKey(cur.song.key, cur.transpose || 0));

  // Chevron + close X — anchored to the right end of the title row in both
  // expanded and collapsed states. Same variant and size so they render
  // with matching color and weight.
  const headerControls = (
    <div className="flex items-center gap-1 shrink-0">
      <IconButton
        size="sm"
        variant="ghost"
        onClick={() => setHeaderCollapsed(c => !c)}
        aria-label={headerCollapsed ? 'Expand header' : 'Collapse header'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d={headerCollapsed ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
        </svg>
      </IconButton>
      <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Close practice">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </IconButton>
    </div>
  );

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto overflow-x-hidden bg-[var(--ds-background-100)]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* ── Minimal sticky header ──
          The title row always renders so the chevron + X stay anchored to
          the same spot regardless of collapse state. When collapsed, the
          structure ribbon takes the title's slot so the row stays useful
          (you can still jump between sections), and the title + meta +
          badge tuck away. The dedicated ribbon row below only renders
          when the header is expanded. */}
      {(() => {
        const structRibbon = !cur.isBreak && cur.song.sections?.length > 0 ? (
          <StructureRibbon
            structure={cur.song.structure || cur.song.sections.map(s => s.type)}
            compact
            onSelect={(i) => {
              const struct = cur.song.structure || cur.song.sections.map(s => s.type);
              const name = struct[i];
              const sectionIdx = cur.song.sections.findIndex(s => s.type === name);
              if (sectionIdx !== -1) {
                const el = document.getElementById(`practice-section-${sectionIdx}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
          />
        ) : null;
        return (
          <div className="material-header" style={{ zIndex: 50, ...headerFrostStyle }}>
            <div className={`a4-container flex items-center gap-2 ${headerCollapsed ? 'py-1.5' : 'py-3'}`}>
              {!headerCollapsed && (
                <>
                  {/* Title */}
                  <h1 className="text-heading-16 text-[var(--ds-gray-1000)] m-0 flex-1 min-w-0 truncate">
                    {cur.isBreak ? (cur.label || 'Break') : cur.song.title}
                  </h1>

                  {/* Meta: key (saves on change) + tempo + time */}
                  {!cur.isBreak && displayKey && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Select value={displayKey} onValueChange={handleKeyChange}>
                        <SelectTrigger className="h-7 px-2 border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] rounded-lg text-label-13 font-bold text-[var(--ds-gray-1000)] gap-1 min-w-0 w-auto focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_KEYS.map(k => (
                            <SelectItem key={k} value={k}>
                              {k}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {cur.capo > 0 && (
                        <span className="text-label-12 font-bold text-[var(--color-brand)] whitespace-nowrap bg-[var(--color-brand-soft)] px-1.5 py-0.5 rounded border border-[var(--color-brand-border)]">
                          Capo {cur.capo}
                        </span>
                      )}
                      {cur.song.tempo && (
                        <span className="text-label-12 text-[var(--ds-gray-700)] whitespace-nowrap">
                          ♩ {cur.song.tempo}
                        </span>
                      )}
                      {cur.song.time && (
                        <span className="text-label-12 text-[var(--ds-gray-700)] whitespace-nowrap">
                          {cur.song.time}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Practice badge */}
                  <span
                    className="hidden sm:inline-flex shrink-0 items-center px-2 py-0.5 rounded-md text-label-10 font-black uppercase tracking-widest"
                    style={{ background: 'var(--color-brand)', color: 'white' }}
                  >
                    Practice
                  </span>
                </>
              )}
              {headerCollapsed && (
                <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
                  {structRibbon}
                </div>
              )}
              {headerControls}
            </div>

            {/* Dedicated structure-ribbon row — only when expanded. */}
            {!headerCollapsed && structRibbon && (
              <div className="a4-container flex items-center gap-1 pb-2 pt-0">
                <div className="flex-1 overflow-x-auto no-scrollbar">
                  {structRibbon}
                </div>
                <IconButton
                  size="xs"
                  variant="ghost"
                  onClick={() => setShowStructureEditor(true)}
                  title="Edit structure"
                  className="shrink-0"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </IconButton>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Content ── */}
      <div className="a4-container pt-4 pb-32">
        {cur.isBreak ? (
          <div className="flex flex-col items-center justify-center py-20 min-h-[50vh]">
            <div className="text-heading-32 text-[var(--ds-gray-1000)] mb-2">{cur.label || 'Break'}</div>
            {cur.duration > 0 && (
              <div className="text-copy-16 text-[var(--ds-gray-600)] font-mono">{cur.duration} min</div>
            )}
            {cur.note && (
              <NoteContent
                text={cur.note}
                className="w-full max-w-xl mt-4 px-5 py-4 rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)] text-copy-15 text-[var(--ds-gray-900)]"
              />
            )}
          </div>
        ) : displayKey ? (
          <PracticeChart
            song={cur.song}
            selectedKey={displayKey}
            capo={cur.capo || 0}
            fontSize={fontSize}
            columns={columns}
            onSaveCue={handleSaveCue}
          />
        ) : null}

        {/* Setlist note card */}
        {!cur.isBreak && (
          <div className="mt-6">
            <SetlistNoteCard
              value={cur.notes || ''}
              onSave={handleSaveNote}
            />
          </div>
        )}
      </div>

      {/* ── Floating nav pill ── */}
      <FloatingNavPill
        current={idx + 1}
        total={resolved.length}
        nextLabel={next?.isBreak ? (next.label || 'Break') : next?.song?.title}
        onPrev={goPrev}
        onNext={goNext}
        hasPrev={idx > 0}
        hasNext={idx < resolved.length - 1}
        onFinish={onFinish ? handleFinish : undefined}
      />

      {showStructureEditor && (
        <StructureEditor
          structure={cur.song.structure || cur.song.sections.map(s => s.type)}
          availableSections={[...new Set(cur.song.sections.map(s => s.type))]}
          onUpdate={(newStruct) => {
            handleUpdateStructure(newStruct);
            setShowStructureEditor(false);
          }}
          onClose={() => setShowStructureEditor(false)}
        />
      )}
    </div>
  );
}

// Modal for editing the song's structure flow
function StructureEditor({ structure, availableSections, onUpdate, onClose }) {
  const [draft, setDraft] = useState([...structure]);

  const move = (idx, dir) => {
    const next = [...draft];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setDraft(next);
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-[var(--ds-gray-300)] flex items-center justify-between bg-[var(--ds-background-100)]">
          <h2 className="text-heading-18 m-0 text-[var(--ds-gray-1000)]">Edit Song Flow</h2>
          <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</IconButton>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-8">
          {/* Current Structure */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="text-label-12 text-[var(--ds-gray-600)] uppercase tracking-wider font-bold">
                Current Flow
              </label>
              <button 
                onClick={() => setDraft([])}
                className="text-label-11 font-bold text-[var(--ds-red-900)] hover:underline"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {draft.map((name, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] group"
                >
                  <span className="w-5 text-label-11-mono text-[var(--ds-gray-400)] font-bold">{i + 1}</span>
                  <span className="flex-1 text-label-14 font-bold text-[var(--ds-gray-900)]">{name}</span>
                  
                  <div className="flex items-center gap-1">
                    <IconButton 
                      size="xs" 
                      variant="ghost" 
                      onClick={() => move(i, -1)} 
                      disabled={i === 0}
                      className="h-7 w-7"
                    >↑</IconButton>
                    <IconButton 
                      size="xs" 
                      variant="ghost" 
                      onClick={() => move(i, 1)} 
                      disabled={i === draft.length - 1}
                      className="h-7 w-7"
                    >↓</IconButton>
                    <IconButton 
                      size="xs" 
                      variant="ghost" 
                      onClick={() => setDraft(p => p.filter((_, idx) => idx !== i))}
                      className="h-7 w-7 text-[var(--ds-red-900)] hover:bg-[var(--ds-red-100)]"
                    >✕</IconButton>
                  </div>
                </div>
              ))}
              {draft.length === 0 && (
                <div className="py-8 text-center border-2 border-dashed border-[var(--ds-gray-300)] rounded-xl text-copy-13 text-[var(--ds-gray-500)] italic">
                  Flow is empty. Add sections below.
                </div>
              )}
            </div>
          </div>

          {/* Add Sections */}
          <div>
            <label className="text-label-12 text-[var(--ds-gray-600)] uppercase tracking-wider font-bold mb-4 block">
              Add Section to Flow
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableSections.map((name, i) => (
                <button
                  key={i}
                  onClick={() => setDraft(p => [...p, name])}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] text-label-13 font-bold text-[var(--ds-gray-900)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-all"
                >
                  {name}
                  <span className="text-heading-18 leading-none opacity-40">+</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 bg-[var(--ds-gray-100)] border-t border-[var(--ds-gray-300)] flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="brand" onClick={() => onUpdate(draft)}>Apply Changes</Button>
        </div>
      </div>
    </div>
  );
}

// Chart with editable cue cards between sections
function PracticeChart({ song, selectedKey, capo, fontSize, columns, onSaveCue }) {
  const transpose = semitonesBetween(song.key, selectedKey) - (capo || 0);

  const sectionModOffsets = useMemo(() => {
    const acc = { total: 0 };
    return song.sections.map(section => {
      const offset = acc.total;
      (section.lines || []).forEach(line => {
        if (typeof line === 'object' && line.type === 'modulate') {
          acc.total += line.semitones;
        }
      });
      return offset;
    });
  }, [song.sections]);

  return (
    <div
      style={{
        fontSize,
        fontFamily: "var(--font-mono)",
      }}
    >
      {song.notes && (
        <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-lg border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)]">
          <span className="shrink-0 mt-0.5 text-[var(--ds-gray-600)]" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M8 13h6" />
              <path d="M8 17h4" />
            </svg>
          </span>
          <p className="flex-1 m-0 text-copy-13 text-[var(--ds-gray-1000)] whitespace-pre-wrap" style={{ fontFamily: 'var(--font-sans)' }}>
            {song.notes}
          </p>
        </div>
      )}
      {song.sections.map((section, i) => (
        <div key={section.id || i} id={`practice-section-${i}`} style={{ scrollMarginTop: '7rem' }}>
          <SectionBlock
            section={section}
            transpose={transpose}
            modOffset={sectionModOffsets[i]}
            showChords
            inlineNotes
            noteStyle="dashes"
          />
          <CueCard
            value={section.note || ''}
            sectionLabel={section.type}
            onSave={(newNote) => onSaveCue(i, newNote)}
          />
        </div>
      ))}
    </div>
  );
}

// Tappable cue card for a section's band cue
function CueCard({ value, sectionLabel, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef(null);

  // Sync draft when value changes externally (e.g. after save propagates)
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // Auto-focus and move cursor to end
  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.selectionStart = el.selectionEnd = el.value.length;
    }
  }, [editing]);

  const handleSave = () => {
    onSave(draft.trim());
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') handleCancel();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
  };

  if (!value && !editing) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => { setDraft(''); setEditing(true); }}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
        className="mb-6 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--ds-gray-400)] text-label-12 text-[var(--ds-gray-500)] cursor-pointer hover:border-[var(--ds-gray-600)] hover:text-[var(--ds-gray-700)] transition-colors select-none"
        style={{ fontSize: 13 }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add band cue after {sectionLabel}
      </div>
    );
  }

  return (
    <div
      className="mb-6 rounded-lg border overflow-hidden"
      style={{
        borderColor: editing ? 'var(--color-brand-border)' : 'var(--ds-gray-400)',
        background: 'var(--ds-background-200)',
        fontSize: 13,
      }}
    >
      {editing ? (
        <div className="p-3">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-[var(--color-brand)] font-bold text-label-12 mt-1">▶</span>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Band cue…"
              className="flex-1 resize-none bg-transparent outline-none text-[var(--ds-gray-1000)] text-copy-13 leading-snug placeholder:text-[var(--ds-gray-500)]"
              style={{ fontFamily: 'inherit' }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="h-7 px-3 rounded-lg text-label-12 text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="h-7 px-3 rounded-lg text-label-12 text-white font-semibold transition-colors"
              style={{ background: 'var(--color-brand)' }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => { setDraft(value); setEditing(true); }}
          onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
          className="flex items-start gap-2 px-3 py-2.5 cursor-pointer group"
        >
          <span className="text-[var(--color-brand)] font-bold text-label-12 mt-px">▶</span>
          <span className="flex-1 text-copy-13 text-[var(--ds-gray-900)] leading-snug">
            {value}
          </span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0 mt-0.5 text-[var(--ds-gray-500)] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
        </div>
      )}
    </div>
  );
}

// Setlist-level note card — tappable, persists to setlist item
function SetlistNoteCard({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.selectionStart = el.selectionEnd = el.value.length;
    }
  }, [editing]);

  const handleSave = () => {
    onSave(draft.trim());
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') handleCancel();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
  };

  if (!value && !editing) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => { setDraft(''); setEditing(true); }}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--ds-gray-400)] text-label-12 text-[var(--ds-gray-500)] cursor-pointer hover:border-[var(--ds-gray-600)] hover:text-[var(--ds-gray-700)] transition-colors select-none"
        style={{ fontSize: 13 }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add setlist note for this song
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: editing ? 'var(--color-brand-border)' : 'var(--ds-gray-400)',
        background: 'var(--ds-background-200)',
        fontSize: 13,
      }}
    >
      {editing ? (
        <div className="p-3">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-label-12 text-[var(--ds-gray-500)] mt-1 shrink-0">📝</span>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Setlist note for this song…"
              className="flex-1 resize-none bg-transparent outline-none text-[var(--ds-gray-1000)] text-copy-13 leading-snug placeholder:text-[var(--ds-gray-500)]"
              style={{ fontFamily: 'inherit' }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="h-7 px-3 rounded-lg text-label-12 text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="h-7 px-3 rounded-lg text-label-12 text-white font-semibold transition-colors"
              style={{ background: 'var(--color-brand)' }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => { setDraft(value); setEditing(true); }}
          onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
          className="flex items-start gap-2 px-3 py-2.5 cursor-pointer group"
        >
          <span className="text-label-12 text-[var(--ds-gray-500)] mt-px shrink-0">📝</span>
          <span className="flex-1 text-copy-13 text-[var(--ds-gray-900)] leading-snug">
            {value}
          </span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0 mt-0.5 text-[var(--ds-gray-500)] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
        </div>
      )}
    </div>
  );
}
