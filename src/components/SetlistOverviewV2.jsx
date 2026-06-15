import { useMemo, useState, useRef } from 'react';
import { transposeKey } from '../music';
import { resolveSongView } from '../arrangements';
import { durationToSeconds, formatTotalDuration } from '../lib/duration';
import { StructureRibbon } from './StructureRibbon';
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

// ── Small inline icon helpers (kept local; the meta row uses tiny glyphs) ──
const ICONS = {
  calendar: <path d="M8 2v3M16 2v3M3 9h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  rehearsal: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  location: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  tag: <><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1.2" /></>,
};

function MetaChip({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-label-12 text-[var(--ds-gray-700)] min-w-0">
      {icon && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--ds-gray-500)]">
          {ICONS[icon]}
        </svg>
      )}
      <span className="truncate">{children}</span>
    </span>
  );
}

export default function SetlistOverviewV2({ setlist, songs, onBack, onEdit, onExportZip, onExportPdfOverview, onExportPdfFull, onPlay, onPractice, onDelete, isFullscreen = false, onToggleFullscreen, clockFormat = '12h', canEdit = true, embedded = false, hidePlay = false }) {
  const confirm = useConfirm();
  const { team, isAdmin } = useTeam();
  const { user } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState('setlist'); // 'setlist' | 'roster'
  const [density, setDensity] = useState('detailed'); // 'detailed' | 'compact'
  const showDetails = density === 'detailed';
  const scrollRef = useRef(null);

  const canShare = SHARE_ENABLED && !!user?.id && !embedded;
  const isTablet = useIsTablet();
  const wide = useIsDesktop();
  const showTopPlay = wide && !isTablet && !hidePlay;

  const getSong = (id, title, arrangementId) => {
    let s = songs.find(s => s.id === id);
    if (!s && title) s = songs.find(s => s.title === title);
    return s ? resolveSongView(s, arrangementId) : null;
  };

  const practiceAt = (i) => onPractice?.(Number.isInteger(i) ? i : 0);

  const { songCount, breakCount, totalSeconds, anyEstimated } = useMemo(() => {
    let sc = 0, bc = 0, total = 0, est = false;
    const DEFAULT_SONG_SECONDS = 240;
    for (const it of setlist.items) {
      if (it.type === 'break') { bc++; total += (it.duration || 0) * 60; continue; }
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
  const rehearsalStr = setlist.rehearsalDate
    ? new Date(setlist.rehearsalDate + 'T' + (setlist.rehearsalTime || '19:00') + ':00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      + (setlist.rehearsalTime ? ` ${formatClockTime(setlist.rehearsalTime, clockFormat)}` : '')
    : null;

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete setlist?',
      description: `"${setlist?.name || 'Untitled'}" will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (ok) onDelete?.();
  };

  const sheetStyle = {
    background: 'var(--ds-background-100)',
    border: '1px solid var(--ds-gray-300)',
    borderRadius: 18,
    boxShadow: '0 1px 2px rgba(0,0,0,0.10), 0 14px 36px rgba(0,0,0,0.14)',
  };

  // ── Overflow menu (export / share / edit / delete / fullscreen) ──
  const menuItems = [
    { label: 'Export', onClick: () => setExportOpen(true), show: true },
    { label: 'Share', onClick: () => setShareOpen(true), show: canShare },
    { label: 'Edit', onClick: onEdit, show: !!onEdit },
    { label: isFullscreen ? 'Exit fullscreen' : 'Fullscreen', onClick: onToggleFullscreen, show: !!onToggleFullscreen },
    { label: 'Delete', onClick: handleDelete, show: canEdit && !!onDelete, danger: true },
  ].filter(i => i.show);

  const overflowMenu = (
    <div className="relative">
      <IconButton variant="ghost" size="sm" onClick={() => setMenuOpen(o => !o)} aria-label="More actions" aria-expanded={menuOpen}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
      </IconButton>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full mt-1 z-[61] min-w-[176px] rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] shadow-xl py-1.5">
            {menuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => { setMenuOpen(false); item.onClick?.(); }}
                className={`w-full text-left px-3.5 py-2 text-copy-14 cursor-pointer border-none bg-transparent transition-colors hover:bg-[var(--ds-gray-100)] ${item.danger ? 'text-[var(--ds-red-700)]' : 'text-[var(--ds-gray-1000)]'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div ref={scrollRef} className={embedded ? 'h-full overflow-y-auto overflow-x-hidden material-page pb-10' : 'material-page pb-10'}>

      {/* ── Sticky header ── */}
      <div className="material-header" style={headerFrostStyle}>
        <div className="a4-container">
          {/* Meta row + window actions */}
          <div className="flex items-start justify-between gap-3 pt-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
              <MetaChip icon="calendar">{dateStr}</MetaChip>
              {timeStr && <MetaChip icon="clock">{timeStr}</MetaChip>}
              {rehearsalStr && <MetaChip icon="rehearsal">Rehearsal {rehearsalStr}</MetaChip>}
              {setlist.location && <MetaChip icon="location">{setlist.location}</MetaChip>}
              {setlist.service && <MetaChip icon="tag">{setlist.service}</MetaChip>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {overflowMenu}
              {onBack && (
                <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Close">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </IconButton>
              )}
            </div>
          </div>

          {/* Title */}
          <h1 className="text-heading-24 text-[var(--ds-gray-1000)] m-0 mt-1.5 mb-2 flex items-center gap-2 min-w-0">
            <span className="truncate">{setlist.name || 'Untitled Setlist'}</span>
            {setlist.status === 'draft' && (
              <span className="shrink-0 text-label-11 font-semibold px-1.5 py-0.5 rounded bg-[var(--ds-amber-100)] text-[var(--ds-amber-1000)] border border-[var(--ds-amber-400)]">Draft</span>
            )}
          </h1>

          {/* Tags */}
          {!!setlist.tags?.length && (
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {setlist.tags.map((tag, i) => (
                <Chip key={i} variant="success" className="normal-case tracking-normal">{tag}</Chip>
              ))}
            </div>
          )}

          {/* Controls row — tabs (team) on the left, Play/Practice on the right */}
          {(team || onPractice || (onPlay && showTopPlay)) && (
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              {team ? (
                <div className="inline-flex p-0.5 rounded-lg bg-[var(--ds-gray-alpha-100)] border border-[var(--ds-gray-300)]">
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
              ) : <span />}

              {(onPractice || (onPlay && showTopPlay)) && (
                <div className="flex items-center gap-2">
                  {onPlay && showTopPlay && (
                    <Button variant="brand" size="sm" onClick={onPlay} className="gap-1.5">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                      Play live
                    </Button>
                  )}
                  {onPractice && (
                    <Button variant="secondary" size="sm" onClick={() => practiceAt()} className="gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      Practice this set
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Set order ── on an elevated sheet */}
      {(!team || tab === 'setlist') && (
        <div className="a4-container pt-6">
          <div style={sheetStyle} className="overflow-hidden">
            {/* Toolbar — density control + discreet stats */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[var(--ds-gray-200)]">
              <div className="inline-flex p-0.5 rounded-lg bg-[var(--ds-gray-alpha-100)] border border-[var(--ds-gray-300)]">
                {[['detailed', 'Detailed'], ['compact', 'Compact']].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDensity(id)}
                    className={`px-3 h-7 rounded-md text-label-12 font-semibold transition-colors border-none cursor-pointer ${
                      density === id
                        ? 'bg-[var(--ds-background-100)] text-[var(--ds-gray-1000)] shadow-sm'
                        : 'bg-transparent text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-label-12 text-[var(--ds-gray-500)] tabular-nums shrink-0">
                {songCount} song{songCount !== 1 ? 's' : ''}
                {totalSeconds > 0 && ` · ${anyEstimated ? '~' : ''}${formatTotalDuration(totalSeconds)}`}
              </span>
            </div>

            {/* Rows */}
            <div className="p-3 sm:p-4 flex flex-col gap-2">
              {setlist.items.map((item, idx) => {
                if (item.type === 'break') {
                  return (
                    <div key={idx} className="flex items-center gap-3 px-1 py-1.5" aria-label="Break">
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)]">
                        <span className="text-label-13 font-semibold text-[var(--ds-gray-1000)]">{item.label || 'Break'}</span>
                        {(item.duration || 0) > 0 && (
                          <>
                            <span className="w-[3px] h-[3px] rounded-full bg-[var(--ds-gray-600)]" aria-hidden="true" />
                            <span className="text-label-11 text-[var(--ds-gray-700)] tabular-nums">{item.duration} min</span>
                          </>
                        )}
                      </span>
                      <span className="flex-1 border-t border-dashed border-[var(--ds-gray-400)]" aria-hidden="true" />
                    </div>
                  );
                }

                const song = getSong(item.songId, item.songTitle, item.arrangementId);
                const num = String(songNumberByIdx[idx] || 0).padStart(2, '0');

                if (!song) {
                  return (
                    <div key={idx} className="material-card slrow-v-soft flex items-center gap-3 px-4 py-3 opacity-60">
                      <span className="text-label-14 text-[var(--ds-gray-500)] tabular-nums w-7 text-center shrink-0">{num}</span>
                      <p className="text-heading-14 text-[var(--ds-gray-700)] m-0 truncate italic">Missing Song (Waiting for sync)</p>
                    </div>
                  );
                }

                const displayKey = transposeKey(song.key, item.transpose);
                const names = song.structure || song.sections?.map(s => s.type) || [];

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
                    className={`material-card slrow-v-soft flex items-center gap-3 px-3 sm:px-4 py-3 ${onPractice ? 'cursor-pointer transition-transform hover:-translate-y-px active:scale-[0.995]' : ''}`}
                  >
                    <span className="grid place-items-center w-7 h-7 rounded-full bg-[var(--ds-gray-alpha-100)] text-label-12 font-bold text-[var(--ds-gray-600)] tabular-nums shrink-0">
                      {num}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-heading-14 text-[var(--ds-gray-1000)] m-0 truncate">{song.title}</p>
                      {showDetails && names.length > 0 && (
                        <div className="mt-1 -ml-1">
                          <StructureRibbon structure={names} compact wrap />
                        </div>
                      )}
                      {showDetails && item.note && (
                        <p className="text-copy-12 text-[var(--ds-gray-600)] italic m-0 mt-1 whitespace-pre-wrap break-words">{item.note}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <span className="inline-flex items-center gap-1.5">
                        {(item.capo || 0) > 0 && (
                          <span className="text-label-10 text-[var(--ds-gray-600)] uppercase">Capo {item.capo}</span>
                        )}
                        <span className="grid place-items-center min-w-[34px] h-7 px-2 rounded-lg border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] text-label-14 font-bold text-[var(--ds-gray-1000)]">
                          {displayKey}
                        </span>
                      </span>
                      {showDetails && (song.tempo || song.time) && (
                        <span className="text-label-11 text-[var(--ds-gray-500)] tabular-nums">
                          {[song.tempo, song.time].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footnotes — full breakdown + authorship */}
          <div className="pt-3 pb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-12 text-[var(--ds-gray-500)]">
            <span className="tabular-nums">
              {songCount} song{songCount !== 1 ? 's' : ''}
              {breakCount > 0 && ` · ${breakCount} break${breakCount !== 1 ? 's' : ''}`}
              {totalSeconds > 0 && ` · ${anyEstimated ? '~' : ''}${formatTotalDuration(totalSeconds)}`}
            </span>
            {team && setlist.updatedByName && (
              <span>· Edited by {setlist.updatedByName}{setlist.updatedAt ? ` · ${new Date(setlist.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span>
            )}
            {team && setlist.createdByName && setlist.createdByName !== setlist.updatedByName && (
              <span>· Created by {setlist.createdByName}</span>
            )}
          </div>
        </div>
      )}

      {/* ── Roster tab ── */}
      {team && tab === 'roster' && (
        <div className="a4-container pt-6 pb-10">
          <div style={sheetStyle} className="p-4 sm:p-5">
            <RosterPanel
              inline
              v2
              setlistId={setlist.id}
              setlistDate={setlist.date}
              readOnly={!isAdmin}
              onClose={() => setTab('setlist')}
            />
          </div>
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
