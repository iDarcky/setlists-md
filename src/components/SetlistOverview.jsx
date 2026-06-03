import { useMemo, useState, useEffect, useRef } from 'react';
import { transposeKey, compactLabel } from '../music';
import { resolveSongView } from '../arrangements';
import { Chip } from './ui/Chip';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';
import ExportSetlistDialog from './ExportSetlistDialog';
import { useTeam } from '../auth/useTeam';
import RosterPanel from './setlist/RosterPanel';
import { headerFrostStyle } from '../lib/headerFrost';
import { formatClockTime } from '../lib/dateFormat';
import { useConfirm } from './ui/useConfirmHook';

export default function SetlistOverview({ setlist, songs, onBack, onEdit, onExportZip, onExportPdfOverview, onExportPdfFull, onPlay, onPractice, onDelete, isFullscreen = false, onToggleFullscreen, clockFormat = '12h', canEdit = true, embedded = false }) {
  const confirm = useConfirm();
  const { team, isAdmin } = useTeam();
  const [tab, setTab] = useState('setlist'); // 'setlist' | 'roster'
  const getSong = (id, title, arrangementId) => {
    let s = songs.find(s => s.id === id);
    if (!s && title) s = songs.find(s => s.title === title);
    return s ? resolveSongView(s, arrangementId) : null;
  };
  const [collapsed, setCollapsed] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const scrollRef = useRef(null);

  // Own scroll container (not window) so the overview scrolls correctly when
  // embedded in the tablet docked pane / side-peek, and so it presents a single
  // scrollbar inside `<main>` rather than nesting a second one. In the narrow
  // pane (embedded) we skip the scroll-collapse — the header height swap is
  // jarring in such a small viewport.
  useEffect(() => {
    if (embedded) return;
    const node = scrollRef.current;
    if (!node) return;
    const onScroll = () => setCollapsed(node.scrollTop > 60);
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, [embedded]);

  const { songCount, breakCount } = useMemo(() => {
    let sc = 0, bc = 0;
    for (const it of setlist.items) {
      if (it.type === 'break') bc++;
      else sc++;
    }
    return { songCount: sc, breakCount: bc };
  }, [setlist, songs]);

  // Per-row song number (skips breaks). Lookup table keeps the running
  // counter out of the render body so React Compiler stays happy.
  const songNumberByIdx = useMemo(() => {
    const acc = { n: 0 };
    return setlist.items.map(item => {
      if (item.type === 'break') return null;
      acc.n += 1;
      return acc.n;
    });
  }, [setlist.items]);

  const dateStr = new Date(setlist.date + 'T' + (setlist.time || '12:00') + ':00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const timeStr = formatClockTime(setlist.time, clockFormat);

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete setlist?',
      description: `"${setlist?.name || 'Untitled'}" will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (ok) onDelete?.();
  };

  const actionIcons = (
    <div className="flex items-center gap-1 shrink-0">
      {/* Practice — mobile only; desktop/tablet use the floating Practice pill.
          (Play live on mobile is the BottomNav morphing FAB.) */}
      {onPractice && (
        <span className="sm:hidden">
          <IconButton variant="ghost" size="sm" onClick={onPractice} aria-label="Practice setlist" title="Practice">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </IconButton>
        </span>
      )}
      <IconButton variant="ghost" size="sm" onClick={() => setExportOpen(true)} aria-label="Export setlist">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </IconButton>
      {onEdit && (
        <IconButton variant="ghost" size="sm" onClick={onEdit} aria-label="Edit setlist">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </IconButton>
      )}
      {onToggleFullscreen && (
        <IconButton
          variant={isFullscreen ? 'active' : 'ghost'}
          size="sm"
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v4a1 1 0 0 1-1 1H3" />
              <path d="M21 8h-4a1 1 0 0 1-1-1V3" />
              <path d="M3 16h4a1 1 0 0 1 1 1v4" />
              <path d="M16 21v-4a1 1 0 0 1 1-1h4" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8V3h5" />
              <path d="M21 8V3h-5" />
              <path d="M3 16v5h5" />
              <path d="M21 16v5h-5" />
            </svg>
          )}
        </IconButton>
      )}
      {onBack && (
        <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Close">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </IconButton>
      )}
    </div>
  );

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden material-page pb-8">

      {/* ── Sticky header ── */}
      <div className="material-header transition-all duration-200" style={headerFrostStyle}>
        <div className="a4-container">

          {collapsed ? (
            /* ── Collapsed: title + actions in one row ── */
            <div className="flex items-center justify-between gap-3 py-2.5">
              <h1 className="text-heading-16 text-[var(--ds-gray-1000)] m-0 truncate flex-1 min-w-0">
                {setlist.name || 'Untitled Setlist'}
              </h1>
              {actionIcons}
            </div>
          ) : (
            /* ── Expanded: date row, title, chip row ── */
            <>
              {/* Row 1: date + actions */}
              <div className="flex items-center justify-between pt-3 pb-1">
                <span className="text-label-11 text-[var(--ds-gray-700)] uppercase tracking-widest">
                  {dateStr} {timeStr && `• ${timeStr}`}
                </span>
                {actionIcons}
              </div>

              {/* Row 2: setlist name */}
              <h1 className="text-heading-24 text-[var(--ds-gray-1000)] m-0 mb-2 truncate">
                {setlist.name || 'Untitled Setlist'}
              </h1>

              {/* Row 2b: workspace + authorship — team workspaces only. */}
              {team && (setlist.workspaceName || setlist.updatedByName) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2.5 text-label-12 text-[var(--ds-gray-600)]">
                  {setlist.workspaceName && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--ds-gray-alpha-100)] border border-[var(--ds-gray-300)] text-[var(--ds-gray-900)] font-medium">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
                      </svg>
                      {setlist.workspaceName}
                    </span>
                  )}
                  {setlist.updatedByName && (
                    <span>
                      Edited by {setlist.updatedByName}
                      {setlist.updatedAt ? ` · ${new Date(setlist.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                    </span>
                  )}
                  {setlist.createdByName && setlist.createdByName !== setlist.updatedByName && (
                    <span>· Created by {setlist.createdByName}</span>
                  )}
                </div>
              )}

              {/* Row 3: tags + song count */}
              <div className="flex items-center justify-between gap-3 pb-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(setlist.tags?.length ? setlist.tags : setlist.service ? [setlist.service] : []).map((tag, i) => (
                    <Chip key={i} variant="success" className="normal-case tracking-normal">{tag}</Chip>
                  ))}
                  {setlist.location && (
                    <span className="flex items-center gap-1 text-label-13 text-[var(--ds-gray-700)] ml-2">
                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                       {setlist.location}
                    </span>
                  )}
                </div>
                <span className="text-label-12 text-[var(--ds-gray-700)] shrink-0">
                  {songCount} song{songCount !== 1 ? 's' : ''}
                  {breakCount > 0 && ` + ${breakCount} break${breakCount !== 1 ? 's' : ''}`}
                </span>
              </div>
            </>
          )}

        </div>
      </div>

      {/* ── Tabs (team workspaces only): Set order / Roster ── */}
      {team && (
        <div className="a4-container pt-5">
          <div className="inline-flex p-0.5 rounded-lg bg-[var(--ds-gray-alpha-100)] border border-[var(--ds-gray-300)]">
            {[['setlist', 'Set order'], ['roster', 'Roster']].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`px-3.5 h-8 rounded-md text-label-13 font-semibold transition-colors border-none cursor-pointer ${
                  tab === id
                    ? 'bg-[var(--ds-background-100)] text-[var(--ds-gray-1000)] shadow-sm'
                    : 'bg-transparent text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {(!team || tab === 'setlist') && (
      <>
      {/* ── Set order ── */}
      <div className="a4-container pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="section-title m-0">Set Order</p>
          <label className="flex items-center gap-2 cursor-pointer text-label-12 text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)] transition-colors select-none">
            <input
              type="checkbox"
              checked={showDetails}
              onChange={(e) => setShowDetails(e.target.checked)}
              className="w-3.5 h-3.5 accent-[var(--color-brand)] cursor-pointer m-0 rounded-sm"
            />
            Show details
          </label>
        </div>

        <div className="flex flex-col gap-2">
          {setlist.items.map((item, idx) => {

              /* ── Break banner ── separator-style, no song number ── */
              if (item.type === 'break') {
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 px-1 py-2"
                    aria-label="Break"
                  >
                    <span className="flex-1 border-t border-dashed border-[var(--ds-gray-400)]" aria-hidden="true" />
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--ds-gray-400)] slrow-pill slrow-v-soft">
                      <span className="text-label-13 font-semibold text-[var(--ds-gray-1000)]">
                        {item.label || 'Break'}
                      </span>
                      {(item.duration || 0) > 0 && (
                        <>
                          <span className="w-[3px] h-[3px] rounded-full bg-[var(--ds-gray-600)]" aria-hidden="true" />
                          <span className="text-label-11 text-[var(--ds-gray-700)] tabular-nums">
                            {item.duration} min
                          </span>
                        </>
                      )}
                    </span>
                    <span className="flex-1 border-t border-dashed border-[var(--ds-gray-400)]" aria-hidden="true" />
                  </div>
                );
              }

              /* ── Song row ── */
              const song = getSong(item.songId, item.songTitle, item.arrangementId);
              const num = String(songNumberByIdx[idx] || 0).padStart(2, '0');

              if (!song) {
                return (
                  <div key={idx} className="material-card flex items-center gap-3 px-4 py-3 opacity-60 slrow-v-soft">
                    <span className="text-label-14 text-[var(--ds-gray-500)] tabular-nums w-7 text-center shrink-0">
                      {num}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-heading-14 text-[var(--ds-gray-700)] m-0 truncate italic">
                        Missing Song (Waiting for sync)
                      </p>
                    </div>
                  </div>
                );
              }

              const displayKey = transposeKey(song.key, item.transpose);

              return (
                <div
                  key={idx}
                  className="material-card flex items-center gap-3 px-4 py-3 slrow-v-soft"
                >
                  <span className="text-label-14 text-[var(--ds-gray-500)] tabular-nums w-7 text-center shrink-0">
                    {num}
                  </span>

                <div className="flex-1 min-w-0">
                  <p className="text-heading-14 text-[var(--ds-gray-1000)] m-0 truncate">
                    {song.title}
                  </p>
                  {/* Show the song's section flow instead of the artist — the
                      structure is the actionable bit in a setlist context. */}
                  {showDetails && (() => {
                    const names = song.structure || song.sections?.map(s => s.type) || [];
                    const flow = names.map(n => compactLabel(n)).join(' · ');
                    return flow ? (
                      <p className="text-copy-12 text-[var(--ds-gray-700)] m-0 mt-0.5">
                        {flow}
                      </p>
                    ) : null;
                  })()}
                  {showDetails && item.note && (
                    <p className="text-copy-12 text-[var(--ds-gray-600)] italic m-0 mt-1 whitespace-pre-wrap break-words">
                      {item.note}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end shrink-0 gap-0.5">
                  <span className="text-label-14 text-[var(--ds-gray-1000)] font-semibold flex items-center gap-1.5">
                    {(item.capo || 0) > 0 && (
                      <span className="text-label-10 text-[var(--ds-gray-600)] uppercase font-normal">
                        Capo {item.capo}
                      </span>
                    )}
                    {displayKey}
                  </span>
                  {showDetails && (
                    <span className="text-label-11 text-[var(--ds-gray-600)] tabular-nums">
                      {[song.tempo, song.time].filter(Boolean).join(' ')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Delete ── */}
      {canEdit && onDelete && (
        <div className="px-5 py-6 mt-12 mb-8 mx-auto max-w-sm flex justify-center border-t border-[var(--modes-border-dashed)] border-dashed">
          <Button variant="danger" onClick={handleDelete} className="w-full justify-center">
            Delete Setlist
          </Button>
        </div>
      )}
      </>
      )}

      {/* ── Roster tab ── */}
      {team && tab === 'roster' && (
        <div className="a4-container pt-6 pb-10">
          <RosterPanel
            inline
            setlistId={setlist.id}
            setlistDate={setlist.date}
            readOnly={!isAdmin}
            onClose={() => setTab('setlist')}
          />
        </div>
      )}

      {/* ── Floating Practice + Play — desktop/tablet only. On mobile the
          BottomNav morphing FAB owns "Play live", and Practice lives in the
          header action row, so this block would duplicate them. ── */}
      <div
        className="fixed right-6 z-[150] hidden sm:flex flex-col items-end gap-2"
        style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
      >
        {onPractice && (
          <div
            role="button"
            tabIndex={0}
            onClick={onPractice}
            onKeyDown={(e) => e.key === 'Enter' && onPractice?.()}
            className="flex items-center gap-2 h-10 px-4 rounded-full bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] shadow-md cursor-pointer hover:bg-[var(--ds-background-100)] transition-all duration-150 active:scale-95 select-none"
            aria-label="Practice setlist"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ds-gray-900)]">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span className="text-label-13 font-semibold text-[var(--ds-gray-900)]">Practice</span>
          </div>
        )}
        <div
          role="button"
          tabIndex={0}
          onClick={onPlay}
          onKeyDown={(e) => e.key === 'Enter' && onPlay?.()}
          className="w-14 h-14 rounded-full bg-[var(--color-brand)] shadow-lg flex items-center justify-center cursor-pointer hover:opacity-90 transition-all duration-150 active:scale-95"
          aria-label="Play setlist"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white" className="ml-0.5">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>

      {exportOpen && (
        <ExportSetlistDialog
          onClose={() => setExportOpen(false)}
          onExportZip={() => { setExportOpen(false); onExportZip?.(); }}
          onExportPdfOverview={() => { setExportOpen(false); onExportPdfOverview?.(); }}
          onExportPdfFull={() => { setExportOpen(false); onExportPdfFull?.(); }}
        />
      )}

    </div>
  );
}
