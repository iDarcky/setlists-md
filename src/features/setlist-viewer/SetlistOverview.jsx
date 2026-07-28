import { useMemo, useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { transposeKey } from '@/music';
import { resolveSongView } from '@/arrangements';
import { durationToSeconds, formatTotalDuration } from '@/lib/duration';
import { StructureRibbon } from '@/features/chart/StructureRibbon';
import { Chip } from '@/ui/Chip';
import { IconButton } from '@/ui/IconButton';
import { Button } from '@/ui/Button';
import ExportSetlistDialog from '@/features/sharing/ExportSetlistDialog';
import ShareSetlistDialog from '@/features/sharing/ShareSetlistDialog';
import RosterPanel from '@/features/setlist-editor/RosterPanel';
import { useTeam } from '@/auth/useTeam';
import { useAuth } from '@/auth/useAuth';
import { SHARE_ENABLED } from '@/lib/setlistShare';
import { formatClockTime } from '@/lib/dateFormat';
import { useConfirm } from '@/ui/useConfirmHook';
import { toast } from '@/ui/use-toast';

/**
 * Card-language setlist viewer (Labs `setlistCards`). Read-only: a pinned
 * identity card leading with Play Live / Practice, then a Set order / Band tab
 * switcher. Tapping a song opens the practice view from that song.
 */
export default function SetlistOverview({
  setlist, songs, setlists = [], onBack, onEdit, onExportZip, onExportPdfOverview, onExportPdfFull,
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
  const rehearsalStr = setlist.rehearsalDate
    ? new Date(setlist.rehearsalDate + 'T' + (setlist.rehearsalTime || '19:00') + ':00')
        .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      + (setlist.rehearsalTime ? ` · ${formatClockTime(setlist.rehearsalTime, clockFormat)}` : '')
      + (setlist.rehearsalLocation ? ` · ${setlist.rehearsalLocation}` : '')
    : null;

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete setlist?',
      description: `"${setlist?.name || 'Untitled'}" will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete', variant: 'danger',
    });
    if (ok) onDelete?.();
  };

  // Plain-text running order for pasting into a group chat / email.
  const copySetOrder = async () => {
    const lines = [setlist.name || 'Untitled Setlist'];
    const meta = [dateStr, timeRange, setlist.location].filter(Boolean).join(' · ');
    if (meta) lines.push(meta);
    lines.push('');
    let n = 0;
    for (const item of setlist.items) {
      if (item.type === 'break') {
        const dur = (item.duration || 0) > 0 ? ` (${item.duration} min)` : '';
        lines.push(`— ${item.label || 'Break'}${dur} —`);
        continue;
      }
      const song = getSong(item.songId, item.songTitle, item.arrangementId);
      n += 1;
      if (!song) { lines.push(`${n}. (missing song)`); continue; }
      const key = transposeKey(song.key, item.transpose);
      const capo = (item.capo || 0) > 0 ? ` (capo ${item.capo})` : '';
      const tempo = item.tempo ?? song.tempo;
      const extra = [tempo ? `${tempo} bpm` : null, song.time].filter(Boolean).join(' · ');
      lines.push(`${n}. ${song.title} · ${key}${capo}${extra ? ` · ${extra}` : ''}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast({ title: 'Copied', description: 'Set order copied to clipboard.' });
    } catch {
      toast({ title: 'Could not copy', description: 'Clipboard is not available here.', variant: 'error' });
    }
  };

  const menuItems = [
    { label: 'Copy set order', onClick: copySetOrder, show: setlist.items.length > 0 },
    { label: 'Export', onClick: () => setExportOpen(true), show: true },
    { label: 'Share', onClick: () => setShareOpen(true), show: canShare },
    { label: isFullscreen ? 'Exit fullscreen' : 'Fullscreen', onClick: onToggleFullscreen, show: !!onToggleFullscreen },
    { label: 'Delete', onClick: handleDelete, show: canEdit && !!onDelete, danger: true },
  ].filter(i => i.show);

  const iconBtn = (label, onClick, path) => (
    <IconButton variant="ghost" size="sm" onClick={onClick} aria-label={label} title={label}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
    </IconButton>
  );

  const container = 'mx-auto w-full max-w-[1200px] px-3 sm:px-6';
  const notes = setlist.notes;

  // Shared identity pieces (desktop + mobile hub-style header reuse these).
  const statusBadge = setlist.status === 'ready' ? (
    <span className="text-label-11 font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-text)', border: '1px solid var(--color-brand-border)' }}>Ready</span>
  ) : setlist.status === 'draft' ? (
    <span className="text-label-11 font-semibold px-2 py-0.5 rounded-full shrink-0 bg-[var(--ds-amber-100)] text-[var(--ds-amber-900)]">Draft</span>
  ) : null;

  const metaBlock = (
    <>
      <div className="mt-1.5 text-label-12 sm:text-copy-13 text-[var(--ds-gray-700)] flex flex-col gap-0.5">
        <span>{[dateStr, timeRange, setlist.location].filter(Boolean).join(' · ')}</span>
      </div>
      {(rehearsalStr || setlist.service || (team && setlist.updatedByName) || setlist.tags?.length) ? (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {rehearsalStr && (
            <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-label-11 font-medium bg-[var(--ds-blue-100)] text-[var(--ds-blue-900)]">
              <span className="opacity-70">Rehearsal</span>{rehearsalStr}
            </span>
          )}
          {setlist.service && (
            <span className="inline-flex items-center h-6 px-2 rounded-md text-label-11" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-text)' }}>{setlist.service}</span>
          )}
          {team && setlist.updatedByName && (
            <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-[var(--border-1)] bg-[var(--ds-background-100)] text-label-11 text-[var(--ds-gray-1000)]">
              <span className="text-[10px] text-[var(--ds-gray-500)]">Edited by</span>{setlist.updatedByName}
            </span>
          )}
          {setlist.tags?.map(t => <Chip key={t}>{t}</Chip>)}
        </div>
      ) : null}
    </>
  );

  // Practice is a first-class action (not hidden in the ⋯ menu). Desktop shows
  // a labelled button; mobile a compact icon button.
  const practiceIconPath = <><circle cx="12" cy="12" r="9" /><path d="M10 8.5 16 12l-6 3.5v-7z" /></>;
  const practiceBtnDesktop = onPractice && (
    <Button variant="secondary" size="sm" onClick={() => practiceAt(0)} className="min-w-[108px] justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">{practiceIconPath}</svg>
      Practice
    </Button>
  );
  const practiceBtnMobile = onPractice && (
    <Button variant="secondary" size="sm" onClick={() => practiceAt(0)} className="shrink-0 px-2.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">{practiceIconPath}</svg>
      Practice
    </Button>
  );

  const editIconBtn = onEdit && iconBtn('Edit', onEdit, <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>);

  const moreMenuEl = menuItems.length > 0 && (
    <MoreMenu items={menuItems} open={menuOpen} setOpen={setMenuOpen} />
  );

  // ── Shared pieces (reused by the desktop two-card layout + the mobile tabs) ──
  const setCardEl = (
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
            const tempoLine = [tempo ? `${tempo} bpm` : null, song.time].filter(Boolean).join(' · ');
            const capoStr = (item.capo || 0) > 0 ? `capo ${item.capo}` : null;
            return (
              <div
                key={idx}
                {...(onPractice ? { role: 'button', tabIndex: 0, onClick: () => practiceAt(idx), onKeyDown: (e) => e.key === 'Enter' && practiceAt(idx), title: 'Open practice from here' } : {})}
                className={`flex items-start gap-3 px-4 py-3 transition-colors ${onPractice ? 'cursor-pointer hover:bg-[var(--ds-gray-alpha-100)]' : ''}`}
              >
                <span className="text-label-13 text-[var(--ds-gray-500)] tabular-nums w-6 text-center shrink-0 pt-0.5">{num}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-heading-15 text-[var(--ds-gray-1000)] m-0 truncate">{song.title}</p>
                  {capoStr && (
                    <p className="text-copy-12 text-[var(--ds-gray-600)] m-0 mt-0.5 truncate">{capoStr}</p>
                  )}
                  {names.length > 0 && <div className="mt-1.5 -ml-0.5"><StructureRibbon structure={names} compact wrap /></div>}
                  {item.note && (
                    <p className="text-copy-12 text-[var(--ds-gray-700)] italic m-0 mt-1.5 pl-2 border-l-2 whitespace-pre-wrap break-words" style={{ borderColor: 'var(--chord)' }}>{item.note}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="font-mono text-[12px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'var(--chord)', color: '#0a0a0a' }}>{displayKey}</span>
                  {dur && <span className="text-label-11 text-[var(--ds-gray-500)] tabular-nums">{dur}</span>}
                  {tempoLine && <span className="text-label-10 text-[var(--ds-gray-500)] tabular-nums">{tempoLine}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const notesEl = notes ? (
    <div className="rounded-2xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--ds-gray-300)]">
        <h3 className="text-heading-14 font-semibold text-[var(--ds-gray-1000)] m-0">Notes</h3>
      </div>
      <p className="px-4 py-3 text-copy-14 text-[var(--ds-gray-700)] m-0 whitespace-pre-wrap break-words leading-relaxed">{notes}</p>
    </div>
  ) : null;

  // Band (mobile tab) — full editable roster for teams, hint otherwise.
  const bandContent = team ? (
    <RosterPanel
      inline
      v2
      cardSections
      setlistId={setlist.id}
      setlistDate={setlist.date}
      setlists={setlists}
      overscheduleWarn={overscheduleWarn}
      streakLimit={streakLimit}
      readOnly={!isAdmin}
      onClose={() => setTab('setlist')}
    />
  ) : (
    <div className="py-10 text-center flex flex-col items-center gap-2">
      <div className="w-10 h-10 rounded-full bg-[var(--ds-gray-alpha-100)] grid place-items-center text-[var(--ds-gray-500)]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
      </div>
      <p className="text-heading-14 text-[var(--ds-gray-900)] m-0">Who's playing</p>
      <p className="text-copy-13 text-[var(--ds-gray-600)] m-0 max-w-xs">Assigning the band and tracking availability is part of a team workspace.</p>
    </div>
  );

  // The band — RosterPanel renders its own "Band" + "Add to the band" cards
  // (cardSections). Reused by the desktop side column and the mobile Band tab.
  const bandCardEl = bandContent;

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

        {/* ── Identity card (pinned) — mirrors the Song Hub header ── */}
        <div
          className="sticky top-0 z-20 rounded-2xl border border-[var(--border-1)] overflow-hidden"
          style={{ background: 'linear-gradient(180deg, var(--ds-background-100), var(--ds-background-200))', boxShadow: '0 6px 20px rgba(0,0,0,0.18)' }}
        >
          {/* Desktop / tablet (≥ sm) */}
          <div className="hidden sm:flex gap-4 px-5 pt-5 pb-4 items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="m-0 truncate font-[650] leading-[1.1] tracking-[-0.01em] text-[28px] text-[var(--text-1)]">{setlist.name || 'Untitled Setlist'}</h1>
                {statusBadge}
              </div>
              {metaBlock}
            </div>
            <div className="shrink-0 ml-auto flex items-center gap-2">
              {!hidePlay && onPlay && (
                <Button variant="brand" size="sm" onClick={onPlay} className="min-w-[108px] justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="mr-1.5"><path d="M8 5v14l11-7z" /></svg>
                  Play Live
                </Button>
              )}
              {practiceBtnDesktop}
              {editIconBtn}
              {moreMenuEl}
              {onBack && (
                <IconButton variant="ghost" size="sm" onClick={onBack} aria-label="Close">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </IconButton>
              )}
            </div>
          </div>

          {/* Mobile (< sm) — back · title · edit · ⋯, then details below */}
          <div className="sm:hidden p-3">
            <div className="flex items-center gap-1.5">
              {onBack && (
                <button type="button" onClick={onBack} aria-label="Back"
                  className="shrink-0 -ml-1.5 w-10 grid place-items-center rounded-xl text-[var(--text-1)] active:bg-[var(--ds-gray-100)] cursor-pointer" style={{ WebkitTapHighlightColor: 'transparent' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>
              )}
              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                <h1 className="m-0 truncate font-bold leading-tight text-[22px] text-[var(--text-1)]">{setlist.name || 'Untitled Setlist'}</h1>
                {statusBadge}
              </div>
              {editIconBtn}
              {moreMenuEl}
            </div>
            {metaBlock}
            {practiceBtnMobile && <div className="mt-3">{practiceBtnMobile}</div>}
          </div>
        </div>

        {/* ── Desktop / tablet: Set order beside a Who's playing + Notes card.
            The roster card is team/church-only; personal & sync never see it. ── */}
        <div className="hidden md:flex gap-3 mt-3 items-start">
          <div className="flex-1 min-w-0">{setCardEl}</div>
          {(team || notesEl) && (
            <div className="w-[320px] shrink-0 flex flex-col gap-3">
              {team && bandCardEl}
              {notesEl}
            </div>
          )}
        </div>

        {/* ── Mobile: Set order / Band tabs (Band only for team/church) ── */}
        <div className="md:hidden">
          {team ? (
            <>
              <div className="mt-3 flex items-center gap-1">
                {tabBtn('setlist', 'Set order')}
                {tabBtn('band', 'Band')}
              </div>
              {/* Both panels stay mounted and toggle with `hidden` so the band's
                  roster is fetched on load — switching to it is instant, no
                  "Loading roster…" flash. */}
              <div className={tab === 'setlist' ? 'mt-3 flex flex-col gap-3' : 'hidden'}>{setCardEl}{notesEl}</div>
              <div className={tab === 'band' ? 'mt-3' : 'hidden'}>{bandCardEl}</div>
            </>
          ) : (
            <div className="mt-3 flex flex-col gap-3">{setCardEl}{notesEl}</div>
          )}
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
      {canShare && shareOpen && (
        <ShareSetlistDialog setlist={setlist} songs={songs} ownerId={user?.id} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}

/**
 * The ⋯ overflow menu. The dropdown is rendered through a portal with fixed
 * positioning anchored to the trigger, so the identity card's `overflow-hidden`
 * (needed for its rounded corners) can never clip it.
 */
function MoreMenu({ items, open, setOpen }) {
  const triggerRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  return (
    <div ref={triggerRef} className="inline-flex">
      <IconButton variant="ghost" size="sm" onClick={() => setOpen(o => !o)} aria-label="More actions" aria-expanded={open}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
      </IconButton>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            className="fixed z-[61] w-[160px] rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] shadow-xl py-1.5"
            style={{ top: pos.top, right: pos.right }}
          >
            {items.map(item => (
              <button key={item.label} type="button" onClick={() => { setOpen(false); item.onClick?.(); }}
                className={`w-full text-left px-3 py-1.5 text-copy-13 cursor-pointer border-none bg-transparent hover:bg-[var(--ds-gray-100)] ${item.danger ? 'text-[var(--ds-red-700)]' : 'text-[var(--ds-gray-1000)]'}`}>
                {item.label}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
