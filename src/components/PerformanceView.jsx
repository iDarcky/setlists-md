import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { transposeKey, ALL_KEYS, semitonesBetween } from '../music';
import SectionBlock from './SectionBlock';
import { StructureRibbon } from './StructureRibbon';
import FloatingNavPill from './ui/FloatingNavPill';
import { IconButton } from './ui/IconButton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/Select';
import NoteContent from './ui/NoteContent';
import { useWakeLock } from '../hooks/useWakeLock';

export default function PerformanceView({ setlist, songs, onBack }) {
  useWakeLock(true);
  const [idx, setIdx] = useState(0);
  const [selectedKey, setSelectedKey] = useState(null);
  const [fontSize, setFontSize] = useState(18);
  const [columns, setColumns] = useState(1);
  const [showOverflow, setShowOverflow] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const overflowRef = useRef(null);
  const scrollRef = useRef(null);

  const resolved = useMemo(() =>
    setlist.items
      .map(it => {
        if (it.type === 'break') return { ...it, isBreak: true };
        const song = songs.find(s => s.id === it.songId);
        return song ? { ...it, song } : null;
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
    setIdx(p => Math.min(resolved.length - 1, p + 1));
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [resolved.length]);

  const goPrev = useCallback(() => {
    setIdx(p => Math.max(0, p - 1));
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Keyboard / Bluetooth pedal navigation
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

  // Close overflow popover on outside click
  useEffect(() => {
    if (!showOverflow) return;
    const handler = (e) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target)) {
        setShowOverflow(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showOverflow]);

  if (!resolved.length) {
    return (
      <div className="p-10 text-center text-[var(--ds-gray-600)] text-copy-14">
        No items in setlist
      </div>
    );
  }

  if (!cur) return null;

  const displayKey = cur.isBreak ? null : (selectedKey || transposeKey(cur.song.key, cur.transpose || 0));

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto overflow-x-hidden bg-[var(--ds-background-100)]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* ── Minimal sticky header ── */}
      <div className="material-header" style={{ zIndex: 50 }}>
        {/* Title row — hidden when collapsed */}
        {!headerCollapsed && (
          <div className="a4-container flex items-center gap-2 py-3">
            {/* Back */}
            <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Back">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
              </svg>
            </IconButton>

            {/* Title */}
            <h1 className="text-heading-16 text-[var(--ds-gray-1000)] m-0 flex-1 min-w-0 truncate">
              {cur.isBreak ? (cur.label || 'Break') : cur.song.title}
            </h1>

            {/* Meta: key picker + tempo + time */}
            {!cur.isBreak && displayKey && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Select value={displayKey} onValueChange={setSelectedKey}>
                  <SelectTrigger className="h-7 px-2 border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] rounded-lg text-label-13 font-bold text-[var(--ds-gray-1000)] gap-1 min-w-0 w-auto focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_KEYS.map(k => {
                      const st = semitonesBetween(cur.song.key, k);
                      const display = st > 6 ? st - 12 : st;
                      return (
                        <SelectItem key={k} value={k}>
                          {k}{st !== 0 && ` (${display > 0 ? '+' : ''}${display})`}
                        </SelectItem>
                      );
                    })}
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

            {/* Separator */}
            <div className="w-px h-5 bg-[var(--ds-gray-400)] shrink-0" />

            {/* Overflow: font size + columns */}
            <div className="relative" ref={overflowRef}>
              <IconButton
                variant={showOverflow ? 'active' : 'default'}
                size="sm"
                onClick={() => setShowOverflow(s => !s)}
                aria-label="Display options"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </IconButton>
              {showOverflow && (
                <div className="absolute right-0 top-full mt-2 z-[200] min-w-[190px] rounded-xl bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] shadow-xl p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-label-12 text-[var(--ds-gray-700)]">Font size</span>
                    <div className="flex items-center bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] rounded-lg p-0.5">
                      <button
                        onClick={() => setFontSize(p => Math.max(12, p - 2))}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-100)] text-label-14 font-bold"
                      >−</button>
                      <span className="px-2 text-label-11-mono text-[var(--ds-gray-700)] tabular-nums">{fontSize}px</span>
                      <button
                        onClick={() => setFontSize(p => Math.min(32, p + 2))}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-100)] text-label-14 font-bold"
                      >+</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-label-12 text-[var(--ds-gray-700)]">Columns</span>
                    <div className="flex items-center gap-1.5">
                      {[1, 2].map(n => (
                        <button
                          key={n}
                          onClick={() => setColumns(n)}
                          className="h-7 px-3 rounded-lg text-label-12 font-semibold transition-colors border"
                          style={{
                            background: columns === n ? 'var(--color-brand)' : 'var(--ds-background-100)',
                            color: columns === n ? 'white' : 'var(--ds-gray-900)',
                            borderColor: columns === n ? 'transparent' : 'var(--ds-gray-400)',
                          }}
                        >{n}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Structure ribbon — only for songs */}
        {!cur.isBreak && cur.song.sections?.length > 0 && (
          <div className="a4-container pb-2 pt-0 flex items-center gap-1">
            <div className="flex-1 overflow-x-auto no-scrollbar">
              <StructureRibbon
                structure={cur.song.structure || cur.song.sections.map(s => s.type)}
                compact
                onSelect={(i) => {
                  const struct = cur.song.structure || cur.song.sections.map(s => s.type);
                  const name = struct[i];
                  const sectionIdx = cur.song.sections.findIndex(s => s.type === name);
                  if (sectionIdx !== -1) {
                    const el = document.getElementById(`perf-section-${sectionIdx}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              />
            </div>
            <IconButton
              size="xs"
              variant="ghost"
              onClick={() => setHeaderCollapsed(c => !c)}
              aria-label={headerCollapsed ? 'Expand header' : 'Collapse header'}
              className="shrink-0 text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-900)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={headerCollapsed ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
              </svg>
            </IconButton>
          </div>
        )}
      </div>

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
                className="w-full max-w-xl mt-4 px-5 py-4 rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)] text-copy-16 text-[var(--ds-gray-900)]"
              />
            )}
          </div>
        ) : displayKey ? (
          <SongChart
            song={cur.song}
            selectedKey={displayKey}
            capo={cur.capo || 0}
            fontSize={fontSize}
            columns={columns}
          />
        ) : null}
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
      />
    </div>
  );
}

function SongChart({ song, selectedKey, capo, fontSize, columns }) {
  const transpose = semitonesBetween(song.key, selectedKey) - (capo || 0);
  const [notesOpen, setNotesOpen] = useState(false);

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
        columnCount: columns,
        columnGap: '3rem',
        fontFamily: "var(--font-mono)",
      }}
    >
      {song.notes && (
        <div className="mb-3" style={{ columnSpan: 'all', WebkitColumnSpan: 'all' }}>
          {notesOpen ? (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)]" style={{ fontFamily: 'var(--font-sans)' }}>
              <span className="shrink-0 mt-0.5 text-[var(--ds-gray-600)]" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M8 13h6" />
                  <path d="M8 17h4" />
                </svg>
              </span>
              <p className="flex-1 m-0 text-copy-13 text-[var(--ds-gray-1000)] whitespace-pre-wrap">
                {song.notes}
              </p>
              <button
                type="button"
                onClick={() => setNotesOpen(false)}
                aria-label="Hide notes"
                className="shrink-0 text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              aria-label="Show song notes"
              aria-expanded="false"
              className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)] text-label-11 text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] transition-colors"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              Notes
            </button>
          )}
        </div>
      )}
      {song.sections.map((section, i) => (
        <div key={section.id || i} id={`perf-section-${i}`} style={{ breakInside: 'avoid', scrollMarginTop: '7rem' }}>
          <SectionBlock
            section={section}
            transpose={transpose}
            modOffset={sectionModOffsets[i]}
            showChords
            inlineNotes
            noteStyle="dashes"
          />
        </div>
      ))}
    </div>
  );
}
