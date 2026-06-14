import { useMemo, useState, useRef } from 'react';
import { transposeKey, compactLabel } from '../music';
import { resolveSongView } from '../arrangements';
import { durationToSeconds, formatTotalDuration } from '../lib/duration';
import { Chip } from './ui/Chip';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';
import ExportSetlistDialog from './ExportSetlistDialog';
import { useTeam } from '../auth/useTeam';
import { useAuth } from '../auth/useAuth';
import { SHARE_ENABLED } from '../share/setlistShare';
import ShareSetlistDialog from './ShareSetlistDialog';
import RosterPanel from './setlist/RosterPanel';
import { headerFrostStyle } from '../lib/headerFrost';
import { formatClockTime } from '../lib/dateFormat';
import { useConfirm } from './ui/useConfirmHook';
import { useIsTablet, useIsDesktop } from '../lib/useMediaQuery';

export default function SetlistOverview({ setlist, songs, onBack, onEdit, onExportZip, onExportPdfOverview, onExportPdfFull, onPlay, onPractice, onDelete, isFullscreen = false, onToggleFullscreen, clockFormat = '12h', canEdit = true, embedded = false, hidePlay = false }) {
  const confirm = useConfirm();
  const { team, isAdmin } = useTeam();
  const { user } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const canShare = SHARE_ENABLED && !!user?.id && !embedded;
  // "Play live" lives in the BottomNav FAB on mobile + tablet (iPad, both
  // orientations). Only desktop — which has no bottom nav — needs an in-page
  // Play button, so we surface it there and nowhere else to avoid duplicates.
  const isTablet = useIsTablet();
  const wide = useIsDesktop();
  const showTopPlay = wide && !isTablet && !hidePlay;
  const [tab, setTab] = useState('setlist'); // 'setlist' | 'roster'
  const getSong = (id, title, arrangementId) => {
    let s = songs.find(s => s.id === id);
    if (!s && title) s = songs.find(s => s.title === title);
    return s ? resolveSongView(s, arrangementId) : null;
  };
  // Header no longer collapses on scroll — it stays expanded (kept as a const so
  // the existing collapsed/expanded branch in the header markup still resolves).
  const collapsed = false;
  const [exportOpen, setExportOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const scrollRef = useRef(null);

  // Open practice; `i` is the item index to start on (tapping a song row),
  // omitted/non-numeric (e.g. from a button's event) starts at the top.
  const practiceAt = (i) => onPractice?.(Number.isInteger(i) ? i : 0);

  const { songCount, breakCount, totalSeconds, anyEstimated } = useMemo(() => {
    let sc = 0, bc = 0, total = 0, est = false;
    const DEFAULT_SONG_SECONDS = 240; // 4 min fallback when a song has no length
    for (const it of setlist.items) {
      if (it.type === 'break') {
        bc++;
        total += (it.duration || 0) * 60;
        continue;
      }
      sc++;
      let raw = songs.find(s => s.id === it.songId);
      if (!raw && it.songTitle) raw = songs.find(s => s.title === it.songTitle);
      const view = raw ? resolveSongView(raw, it.arrangementId) : null;
      const secs = durationToSeconds(view?.duration);
      if (secs > 0) total += secs;
      else { total += DEFAULT_SONG_SECONDS; est = true; }
    }
    return { songCount: sc, breakCount: bc, totalSeconds: total, anyEstimated: est };
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
      <IconButton variant="ghost" size="sm" onClick={() => setExportOpen(true)} aria-label="Export setlist">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </IconButton>
      {canShare && (
        <IconButton variant="ghost" size="sm" onClick={() => setShareOpen(true)} aria-label="Share setlist" title="Share setlist">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </IconButton>
      )}
      {canEdit && onDelete && (
        <IconButton variant="ghost" size="sm" onClick={handleDelete} aria-label="Delete setlist" title="Delete setlist">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </IconButton>
      )}
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
    <div ref={scrollRef} className={embedded ? 'h-full overflow-y-auto overflow-x-hidden material-page pb-8' : 'material-page pb-8'}>

      {/* ── Sticky header ── */}
      <div className="material-header" style={headerFrostStyle}>
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
              <h1 className="text-heading-24 text-[var(--ds-gray-1000)] m-0 mb-2 truncate flex items-center gap-2">
                <span className="truncate">{setlist.name || 'Untitled Setlist'}</span>
                {setlist.status === 'draft' && (
                  <span className="shrink-0 text-label-11 font-semibold px-1.5 py-0.5 rounded bg-[var(--ds-amber-100)] text-[var(--ds-amber-1000)] border border-[var(--ds-amber-400)]">Draft</span>
                )}
              </h1>

              {/* Row 2b: authorship — team workspaces only. (Workspace-name
                  reminder removed; it wasn't relevant here.) */}
              {team && (setlist.updatedByName || setlist.createdByName) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2.5 text-label-12 text-[var(--ds-gray-600)]">
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
                  {totalSeconds > 0 && ` · ${anyEstimated ? '~' : ''}${formatTotalDuration(totalSeconds)}`}
                </span>
              </div>
            </>
          )}

          {/* Tabs (team workspaces only) live in the header so they stay put
              while the body switches between Set order and Roster. */}
          {team && (
            <div className="inline-flex p-0.5 mt-1 mb-3 rounded-lg bg-[var(--ds-gray-alpha-100)] border border-[var(--ds-gray-300)]">
              {[['setlist', 'Set order'], ['roster', 'Band']].map(([id, label]) => (
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
          )}

        </div>
      </div>

      {/* Top actions — Play live (desktop only; mobile/tablet use the BottomNav
          FAB) + Practice (every breakpoint). Stacks on phones, sits inline on
          wider screens. */}
      {(onPractice || (onPlay && showTopPlay)) && (
        <div className="a4-container pt-4 flex flex-col sm:flex-row gap-2">
          {onPlay && showTopPlay && (
            <Button variant="brand" size="lg" onClick={onPlay} className="justify-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play live
            </Button>
          )}
          {onPractice && (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => practiceAt()}
              className="w-full sm:w-auto justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Practice this set
            </Button>
          )}
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
                  {...(onPractice ? {
                    role: 'button',
                    tabIndex: 0,
                    onClick: () => practiceAt(idx),
                    onKeyDown: (e) => { if (e.key === 'Enter') practiceAt(idx); },
                    title: 'Open in practice',
                  } : {})}
                  className={`material-card flex items-center gap-3 px-4 py-3 slrow-v-soft ${onPractice ? 'cursor-pointer transition-transform hover:-translate-y-px active:scale-[0.995]' : ''}`}
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

      {exportOpen && (
        <ExportSetlistDialog
          onClose={() => setExportOpen(false)}
          onExportZip={() => { setExportOpen(false); onExportZip?.(); }}
          onExportPdfOverview={() => { setExportOpen(false); onExportPdfOverview?.(); }}
          onExportPdfFull={() => { setExportOpen(false); onExportPdfFull?.(); }}
        />
      )}

      {shareOpen && (
        <ShareSetlistDialog
          setlist={setlist}
          songs={songs}
          ownerId={user?.id}
          onClose={() => setShareOpen(false)}
        />
      )}

    </div>
  );
}
