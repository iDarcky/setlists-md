import { useMemo, useState } from 'react';
import { transposeKey } from '../music';
import { resolveSongView } from '../arrangements';
import { durationToSeconds, formatTotalDuration } from '../lib/duration';
import { StructureRibbon } from './StructureRibbon';
import { Chip } from './ui/Chip';
import { IconButton } from './ui/IconButton';
import { Button } from './ui/Button';
import ExportSetlistDialog from './ExportSetlistDialog';
import ShareSetlistDialog from './ShareSetlistDialog';
import RosterPanel from './setlist/RosterPanel';
import { useTeam } from '../auth/useTeam';
import { useAuth } from '../auth/useAuth';
import { SHARE_ENABLED } from '../share/setlistShare';
import { formatClockTime } from '../lib/dateFormat';
import { useConfirm } from './ui/useConfirmHook';

/**
 * Card-language setlist viewer (Labs `setlistCards`). Read-only: a pinned
 * identity card leading with Play Live / Practice, then a Set order / Band tab
 * switcher. Tapping a song opens the practice view from that song.
 */
export default function SetlistViewerCards({
  setlist, songs, setlists = [], onEdit, onExportZip, onExportPdfOverview, onExportPdfFull,
  onPlay, onPractice, onDelete, isFullscreen = false, onToggleFullscreen,
  clockFormat = '12h', canEdit = true, embedded = false, hidePlay = false,
  overscheduleWarn = false, streakLimit = 3,
}) {
  const confirm = useConfirm();
  const { team, isAdmin } = useTeam();
  const { user } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState('setlist'); // 'setlist' | 'band'

  const canShare = SHARE_ENABLED && !!user?.id && !embedded;

  const getSong = (id, title, arrangementId) => {
    let s = songs.find(s => s.id === id);
    if (!s && title) s = songs.find(s => s.title === title);
    return s ? resolveSongView(s, arrangementId) : null;
  };

  const practiceAt = (i) => onPractice?.(Number.isInteger(i) ? i : 0);

  const { songCount, breakCount, totalSeconds, anyEstimated } = useMemo(() => {
    let sc = 0, bc = 0, total = 0, est = false;
    for (const it of setlist.items) {
      if (it.type === 'break') { bc++; total += (it.duration || 0) * 60; continue; }
      sc++;
      let raw = songs.find(s => s.id === it.songId);
      if (!raw && it.songTitle) raw = songs.find(s => s.title === it.songTitle);
      const view = raw ? resolveSongView(raw, it.arrangementId) : null;
      const secs = it.tempo ? 0 : durationToSeconds(view?.duration);
      if (secs > 0) total += secs; else { total += 240; est = true; }
    }
    return { songCount: sc, breakCount: bc, totalSeconds: total, anyEstimated: est };
  }, [setlist, songs]);

  const songNumberByIdx = useMemo(() => {
    const acc = { n: 0 };
    return setlist.items.map(item => (item.type === 'break' ? null : (acc.n += 1)));
  }, [setlist.items]);

  const dateStr = new Date(setlist.date + 'T' + (setlist.time || '12:00') + ':00')
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const startStr = formatClockTime(setlist.time, clockFormat);
  const endStr = setlist.endTime ? formatClockTime(setlist.endTime, clockFormat) : null;
  const timeRange = startStr ? (endStr ? `${startStr}–${endStr}` : startStr) : null;

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete setlist?',
      description: `"${setlist?.name || 'Untitled'}" will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete', variant: 'danger',
    });
    if (ok) onDelete?.();
  };

  const menuItems = [
    { label: isFullscreen ? 'Exit fullscreen' : 'Fullscreen', onClick: onToggleFullscreen, show: !!onToggleFullscreen },
    { label: 'Delete', onClick: handleDelete, show: canEdit && !!onDelete, danger: true },
  ].filter(i => i.show);

  const iconBtn = (label, onClick, path) => (
    <IconButton variant="secondary" size="sm" onClick={onClick} aria-label={label} title={label}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
    </IconButton>
  );

  const container = 'mx-auto w-full max-w-[1040px] px-3 sm:px-6';
  const notes = setlist.notes;

  const tabBtn = (id, label) => {
    const active = tab === id;
    return (
      <button
        type="button"
        onClick={() => setTab(id)}
        aria-current={active ? 'page' : undefined}
        className="h-8 px-3.5 rounded-lg text-label-13 font-semibold transition-colors cursor-pointer"
        style={active ? { background: 'var(--color-brand)', color: '#fff' } : { color: 'var(--ds-gray-600)' }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className={embedded ? 'h-full overflow-y-auto overflow-x-hidden material-page pb-10' : 'material-page pb-10'}>
      <div className={`${container} pt-4 sm:pt-6`}>

        {/* ── Identity card (pinned) ── */}
        <div
          className="sticky top-0 z-20 rounded-2xl border border-[var(--border-1)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-4"
          style={{ background: 'linear-gradient(180deg, var(--ds-background-100), var(--ds-background-200))', boxShadow: '0 6px 20px rgba(0,0,0,0.18)' }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <h1 className="text-heading-24 font-semibold text-[var(--text-1)] m-0 leading-tight">{setlist.name || 'Untitled Setlist'}</h1>
              {setlist.status === 'ready' ? (
                <span className="text-label-11 font-semibold px-2 py-0.5 rounded-full mt-1" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-text)', border: '1px solid var(--color-brand-border)' }}>Ready</span>
              ) : setlist.status === 'draft' ? (
                <span className="text-label-11 font-semibold px-2 py-0.5 rounded-full mt-1 bg-[var(--ds-amber-100)] text-[var(--ds-amber-900)]">Draft</span>
              ) : null}
            </div>
            <p className="text-copy-13 text-[var(--ds-gray-700)] m-0 mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span>{dateStr}</span>
              {timeRange && <><span className="text-[var(--ds-gray-500)]">·</span><span>{timeRange}</span></>}
              {setlist.location && <><span className="text-[var(--ds-gray-500)]">·</span><span>{setlist.location}</span></>}
              <span className="text-[var(--ds-gray-500)]">·</span>
              <span className="tabular-nums">{songCount} song{songCount !== 1 ? 's' : ''} · {anyEstimated ? '~' : ''}{formatTotalDuration(totalSeconds)}</span>
            </p>
            {(team && setlist.updatedByName) || (setlist.tags?.length) ? (
              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                {team && setlist.updatedByName && (
                  <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-[var(--border-1)] bg-[var(--ds-background-100)] text-label-12 text-[var(--ds-gray-1000)]">
                    <span className="text-[11px] text-[var(--ds-gray-500)]">Edited by</span>{setlist.updatedByName}
                  </span>
                )}
                {setlist.tags?.map(t => <Chip key={t}>{t}</Chip>)}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:justify-end">
            {!hidePlay && onPlay && (
              <Button variant="brand" size="sm" onClick={onPlay}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="mr-1.5"><path d="M8 5v14l11-7z" /></svg>
                Play Live
              </Button>
            )}
            {onPractice && <Button variant="secondary" size="sm" onClick={() => onPractice(0)}>Practice</Button>}
            {onEdit && iconBtn('Edit', onEdit, <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>)}
            {iconBtn('Export', () => setExportOpen(true), <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></>)}
            {canShare && iconBtn('Share', () => setShareOpen(true), <><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v14" /></>)}
            {menuItems.length > 0 && (
              <div className="relative">
                <IconButton variant="secondary" size="sm" onClick={() => setMenuOpen(o => !o)} aria-label="More actions" aria-expanded={menuOpen}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
                </IconButton>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                    <div className="absolute right-0 top-full mt-1 z-[61] min-w-[176px] rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] shadow-xl py-1.5">
                      {menuItems.map(item => (
                        <button key={item.label} type="button" onClick={() => { setMenuOpen(false); item.onClick?.(); }}
                          className={`w-full text-left px-3.5 py-2 text-copy-14 cursor-pointer border-none bg-transparent hover:bg-[var(--ds-gray-100)] ${item.danger ? 'text-[var(--ds-red-700)]' : 'text-[var(--ds-gray-1000)]'}`}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Tabs (only when a team gives us a Band tab) ── */}
        {team && (
          <div className="mt-3 flex items-center gap-1">
            {tabBtn('setlist', 'Set order')}
            {tabBtn('band', 'Band')}
          </div>
        )}

        {/* ── Band tab ── */}
        {team && tab === 'band' ? (
          <div className="mt-3 rounded-2xl border border-[var(--border-1)] bg-[var(--ds-background-100)] p-4 sm:p-5">
            <RosterPanel
              inline
              v2
              setlistId={setlist.id}
              setlistDate={setlist.date}
              setlists={setlists}
              overscheduleWarn={overscheduleWarn}
              streakLimit={streakLimit}
              readOnly={!isAdmin}
              onClose={() => setTab('setlist')}
            />
          </div>
        ) : (
          /* ── Set order tab ── */
          <div className="mt-3 flex flex-col gap-3">
            <div className="rounded-2xl border border-[var(--border-1)] bg-[var(--ds-background-100)] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-1)]">
                <h3 className="text-heading-14 font-semibold text-[var(--ds-gray-1000)] m-0">Set order</h3>
                <span className="text-copy-12 text-[var(--ds-gray-600)] tabular-nums">
                  {songCount} song{songCount !== 1 ? 's' : ''}{breakCount > 0 && ` · ${breakCount} break${breakCount !== 1 ? 's' : ''}`} · {anyEstimated ? '~' : ''}{formatTotalDuration(totalSeconds)}
                </span>
              </div>

              {setlist.items.length === 0 ? (
                <div className="py-12 text-center text-copy-13 text-[var(--ds-gray-600)]">No songs yet.</div>
              ) : (
                <div className="divide-y divide-[var(--border-1)]">
                  {setlist.items.map((item, idx) => {
                    if (item.type === 'break') {
                      return (
                        <div key={idx} className="px-4 py-3" style={{ background: 'var(--color-brand-soft)' }} aria-label="Break">
                          <div className="flex items-center gap-3">
                            <span className="text-[var(--color-brand-text)]" aria-hidden="true">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                            </span>
                            <span className="flex-1 min-w-0 text-label-13 font-semibold text-[var(--color-brand-text)] truncate">{item.label || 'Break'}</span>
                            {(item.duration || 0) > 0 && <span className="text-label-12 text-[var(--color-brand-text)] tabular-nums shrink-0">{item.duration} min</span>}
                          </div>
                          {item.note && <p className="text-copy-12 text-[var(--color-brand-text)] opacity-80 m-0 mt-1.5 pl-6 whitespace-pre-wrap break-words">{item.note}</p>}
                        </div>
                      );
                    }
                    const song = getSong(item.songId, item.songTitle, item.arrangementId);
                    const num = String(songNumberByIdx[idx] || 0).padStart(2, '0');
                    if (!song) {
                      return (
                        <div key={idx} className="flex items-center gap-3 px-4 py-3 opacity-60">
                          <span className="text-label-13 text-[var(--ds-gray-500)] tabular-nums w-6 text-center shrink-0">{num}</span>
                          <p className="text-heading-14 text-[var(--ds-gray-700)] m-0 truncate italic">Missing song (waiting for sync)</p>
                        </div>
                      );
                    }
                    const displayKey = transposeKey(song.key, item.transpose);
                    const names = (Array.isArray(item.structure) && item.structure.length) ? item.structure : (song.structure || song.sections?.map(s => s.type) || []);
                    const tempo = item.tempo ?? song.tempo;
                    const dur = song.duration ? formatTotalDuration(durationToSeconds(song.duration)) : null;
                    return (
                      <div
                        key={idx}
                        {...(onPractice ? { role: 'button', tabIndex: 0, onClick: () => practiceAt(idx), onKeyDown: (e) => e.key === 'Enter' && practiceAt(idx), title: 'Open practice from here' } : {})}
                        className={`flex items-start gap-3 px-4 py-3 transition-colors ${onPractice ? 'cursor-pointer hover:bg-[var(--ds-gray-alpha-100)]' : ''}`}
                      >
                        <span className="text-label-13 text-[var(--ds-gray-500)] tabular-nums w-6 text-center shrink-0 pt-0.5">{num}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-heading-15 text-[var(--ds-gray-1000)] m-0 truncate">{song.title}</p>
                          <p className="text-copy-12 text-[var(--ds-gray-600)] m-0 mt-0.5 truncate">
                            {[song.artist, (item.capo || 0) > 0 ? `capo ${item.capo}` : null].filter(Boolean).join(' · ')}
                          </p>
                          {names.length > 0 && <div className="mt-1.5 -ml-0.5"><StructureRibbon structure={names} compact wrap /></div>}
                          {item.note && (
                            <p className="text-copy-12 text-[var(--ds-gray-700)] italic m-0 mt-1.5 pl-2 border-l-2 whitespace-pre-wrap break-words" style={{ borderColor: 'var(--chord)' }}>{item.note}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="font-mono text-[12px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'var(--chord)', color: '#0a0a0a' }}>{displayKey}</span>
                          {dur && <span className="text-label-11 text-[var(--ds-gray-500)] tabular-nums">{dur}</span>}
                          {tempo && <span className="text-label-10 text-[var(--ds-gray-500)] tabular-nums">{tempo} bpm</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {notes && (
              <div className="rounded-2xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--ds-gray-300)]">
                  <h3 className="text-heading-14 font-semibold text-[var(--ds-gray-1000)] m-0">Notes</h3>
                </div>
                <p className="px-4 py-3 text-copy-14 text-[var(--ds-gray-700)] m-0 whitespace-pre-wrap break-words leading-relaxed">{notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {exportOpen && (
        <ExportSetlistDialog
          onClose={() => setExportOpen(false)}
          onExportZip={() => { setExportOpen(false); onExportZip?.(); }}
          onExportPdfOverview={() => { setExportOpen(false); onExportPdfOverview?.(); }}
          onExportPdfFull={() => { setExportOpen(false); onExportPdfFull?.(); }}
        />
      )}
      {canShare && shareOpen && (
        <ShareSetlistDialog setlist={setlist} songs={songs} ownerId={user?.id} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
