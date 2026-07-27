import { useState } from 'react';
import { Button } from '@/ui/Button';

const CHECK_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CHEVRON = (open) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

function buildItems({ settings, setlists, hasCloud, actions }) {
  const items = [
    {
      id: 'opened',
      title: 'Open a chord chart',
      done: !!settings?.firstSongOpened,
      action: 'Open one',
      onAction: actions.openFirstSong,
    },
    {
      id: 'transposed',
      title: 'Transpose a song',
      done: !!settings?.firstTransposed,
      action: 'Try it',
      onAction: actions.openFirstSong,
    },
    {
      id: 'setlist',
      title: 'Build your first setlist',
      done: setlists?.length > 0 || !!settings?.firstSetlistBuilt,
      action: 'Build one',
      onAction: actions.newSetlist,
    },
    {
      id: 'stage',
      title: 'Try stage mode',
      done: !!settings?.firstStageMode,
      action: 'Open stage',
      onAction: actions.openFirstSong,
    },
    {
      id: 'song',
      title: 'Add or import your own song',
      done: !!settings?.firstSongAdded,
      action: 'Add song',
      onAction: actions.newSong,
    },
    {
      id: 'sync',
      title: 'Sign in to sync across devices',
      done: !!hasCloud || !!settings?.firstCloudSyncSetup,
      action: 'Sign in',
      onAction: actions.signIn,
    },
  ];
  return items;
}

export default function ProgressChecklist({ settings, songs, setlists, hasCloud, actions, onDismiss }) {
  const items = buildItems({ settings, songs, setlists, hasCloud, actions });
  const completed = items.filter(i => i.done).length;
  const total = items.length;
  const pct = Math.round((completed / total) * 100);
  const allDone = completed === total;

  // Default: collapsed once 1+ task done, expanded on first run
  const [open, setOpen] = useState(completed === 0);

  if (allDone) return null;

  return (
    <div className="modes-card-strong relative overflow-hidden">
      {/* Dismiss */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer border-none z-10"
          style={{ background: 'transparent', color: 'var(--modes-text-dim)' }}
          aria-label="Hide checklist"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* Header (clickable to toggle) */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left p-5 pr-12 flex items-center gap-4 cursor-pointer border-none"
        style={{ background: 'transparent' }}
      >
        <div
          className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-copy-14"
          style={{
            background: 'conic-gradient(var(--color-brand) ' + pct + '%, var(--modes-border) 0)',
            color: 'var(--modes-text)',
          }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'var(--ds-background-100)' }}
          >
            <span className="text-label-12 font-bold text-[var(--modes-text)]">{completed}/{total}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-label-11 font-semibold uppercase tracking-widest" style={{ color: 'var(--color-brand)' }}>
              Get Started
            </span>
          </div>
          <h3 className="text-heading-20 text-[var(--modes-text)] m-0 leading-tight">
            {completed === 0 ? 'Try your first chord chart' : `${total - completed} step${total - completed === 1 ? '' : 's'} to go`}
          </h3>
        </div>
        <div className="shrink-0 text-[var(--modes-text-dim)]">{CHEVRON(open)}</div>
      </button>

      {/* Body */}
      {open && (
        <div className="px-5 pb-5 flex flex-col gap-2">
          {items.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-3 py-3 rounded-xl"
              style={{
                background: item.done ? 'transparent' : 'rgba(255,255,255,0.02)',
                border: item.done ? '1px solid transparent' : '1px solid var(--modes-border)',
              }}
            >
              <div
                className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  background: item.done ? 'var(--color-brand)' : 'transparent',
                  border: item.done ? 'none' : '1.5px solid var(--modes-border)',
                  color: 'white',
                }}
              >
                {item.done && CHECK_ICON}
              </div>
              <div className="flex-1 min-w-0 text-copy-14" style={{
                color: item.done ? 'var(--modes-text-dim)' : 'var(--modes-text)',
                textDecoration: item.done ? 'line-through' : 'none',
              }}>
                {item.title}
              </div>
              {!item.done && item.onAction && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={item.onAction}
                  className="shrink-0 text-[var(--color-brand)] hover:bg-white/5"
                >
                  {item.action}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
