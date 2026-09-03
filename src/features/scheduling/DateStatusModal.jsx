import { useEffect, useState } from 'react';
import { formatClockTime } from '@/lib/dateFormat';

const STATUS_OPTIONS = [
  {
    value: 'available',
    label: 'Available',
    description: "I can serve on this date.",
    bg: 'var(--ds-green-100)',
    border: 'var(--ds-green-300)',
    fg: 'var(--ds-green-800)',
    activeBg: 'var(--ds-green-600)',
    activeFg: '#fff',
  },
  {
    value: 'maybe',
    label: 'Maybe',
    description: 'Tentative — confirm closer to the date.',
    bg: 'var(--ds-amber-100)',
    border: 'var(--ds-amber-300)',
    fg: 'var(--ds-amber-900)',
    activeBg: 'var(--ds-amber-600)',
    activeFg: '#fff',
  },
  {
    value: 'unavailable',
    label: 'Unavailable',
    description: "I can't serve on this date.",
    bg: 'var(--ds-red-100)',
    border: 'var(--ds-red-300)',
    fg: 'var(--ds-red-800)',
    activeBg: 'var(--ds-red-700)',
    activeFg: '#fff',
  },
];

// Order + look for the per-member status pill. Borderless tinted fills (the
// light status borders read as a harsh outline on the dark schedule surface).
const STATUS_META = {
  available: { label: 'Available', order: 0, cls: 'bg-[var(--ds-green-100)] text-[var(--ds-green-800)]' },
  maybe: { label: 'Maybe', order: 1, cls: 'bg-[var(--ds-amber-100)] text-[var(--ds-amber-900)]' },
  pending: { label: 'No reply', order: 2, cls: 'bg-[var(--modes-surface-strong)] text-[var(--modes-text-dim)]' },
  unavailable: { label: 'Unavailable', order: 3, cls: 'bg-[var(--ds-red-100)] text-[var(--ds-red-800)]' },
};

/**
 * Day detail sheet: the setlists scheduled on a date, the team's availability
 * for it, and controls to set the current user's own status.
 */
export default function DateStatusModal({
  date,
  currentStatus,
  availableCount,
  totalMembers,
  setlists = [],
  memberStatuses = [],
  rehearsals = [],
  canViewTeam = false,
  clockFormat = '12h',
  onSetStatus,
  onClear,
  onOpenSetlist,
  onClose,
}) {
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!date) return null;
  const myMeta = STATUS_META[currentStatus] || null;

  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const longDate = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const sortedMembers = [...memberStatuses].sort(
    (a, b) => (STATUS_META[a.status]?.order ?? 9) - (STATUS_META[b.status]?.order ?? 9) || a.name.localeCompare(b.name),
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-[var(--ds-background-100)] border border-[var(--modes-border)] rounded-2xl shadow-xl flex flex-col gap-4 p-5"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label={`Day detail for ${longDate}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-label-12 uppercase tracking-wider text-[var(--modes-text-dim)]">
              {weekday}
            </span>
            <span className="text-heading-20 font-bold text-[var(--modes-text)]">
              {longDate}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-transparent border-none text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface)] cursor-pointer"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Setlists on this date */}
        {setlists.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-label-12 uppercase tracking-wider font-semibold text-[var(--modes-text-dim)]">
              {setlists.length === 1 ? 'Setlist' : 'Setlists'}
            </span>
            {setlists.map(sl => (
              <div key={sl.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--modes-border)] bg-[var(--modes-surface)] px-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-copy-14 font-semibold text-[var(--modes-text)] truncate">{sl.name || 'Untitled Setlist'}</div>
                  {sl.time && <div className="text-label-12 text-[var(--modes-text-dim)]">{formatClockTime(sl.time, clockFormat)}</div>}
                </div>
                <button type="button" onClick={() => onOpenSetlist?.(sl)} className="text-label-13 font-semibold text-[var(--color-brand)] bg-transparent border-none cursor-pointer hover:underline shrink-0">Open</button>
              </div>
            ))}
          </div>
        )}

        {/* Rehearsals on this date */}
        {rehearsals.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-label-12 uppercase tracking-wider font-semibold text-[var(--modes-text-dim)]">Rehearsal</span>
            {rehearsals.map(sl => (
              <div key={`reh-${sl.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--modes-border)] bg-[var(--modes-surface)] px-3 py-2.5">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-label-11 px-2 py-0.5 rounded-full bg-[var(--ds-blue-100)] text-[var(--ds-blue-900)] shrink-0">Rehearsal</span>
                  <div className="min-w-0">
                    <div className="text-copy-14 font-semibold text-[var(--modes-text)] truncate">{sl.name || 'Untitled Setlist'}</div>
                    {sl.rehearsalTime && <div className="text-label-12 text-[var(--modes-text-dim)]">{formatClockTime(sl.rehearsalTime, clockFormat)}</div>}
                  </div>
                </div>
                <button type="button" onClick={() => onOpenSetlist?.(sl)} className="text-label-13 font-semibold text-[var(--color-brand)] bg-transparent border-none cursor-pointer hover:underline shrink-0">Open</button>
              </div>
            ))}
          </div>
        )}

        {/* My availability — collapsed by default; only the controls when
            editing. Keeps the day sheet focused on the team's status. */}
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--modes-border)] bg-[var(--modes-surface)] px-4 py-3 cursor-pointer hover:bg-[var(--modes-surface-strong)] transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-copy-14 font-medium text-[var(--modes-text)]">Your availability</span>
              {myMeta && <span className={`text-label-11 px-2 py-0.5 rounded-full shrink-0 ${myMeta.cls}`}>{myMeta.label}</span>}
            </span>
            <span className="text-label-13 font-semibold text-[var(--color-brand)] shrink-0">{currentStatus ? 'Change' : 'Set status'}</span>
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-label-12 uppercase tracking-wider font-semibold text-[var(--modes-text-dim)]">My availability</span>
            {STATUS_OPTIONS.map(opt => {
              const active = currentStatus === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSetStatus(opt.value)}
                  className="text-left rounded-xl border p-3 cursor-pointer transition-colors"
                  style={{
                    background: active ? opt.activeBg : opt.bg,
                    borderColor: active ? opt.activeBg : opt.border,
                    color: active ? opt.activeFg : opt.fg,
                  }}
                >
                  <div className="text-copy-14 font-bold">{opt.label} {active && '✓'}</div>
                  <div className="text-copy-12 mt-0.5 opacity-80">{opt.description}</div>
                </button>
              );
            })}
            {currentStatus && (
              <button
                type="button"
                onClick={onClear}
                className="text-copy-13 text-[var(--modes-text-muted)] hover:text-[var(--modes-text)] underline underline-offset-2 self-start cursor-pointer bg-transparent border-none p-0"
              >
                Clear my status for this date
              </button>
            )}
          </div>
        )}

        {/* Team availability — leaders/admins only (everyone else just sets
            their own status; the full band is gated). */}
        {canViewTeam && sortedMembers.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-[var(--modes-border)]">
            <div className="flex items-center justify-between">
              <span className="text-label-12 uppercase tracking-wider font-semibold text-[var(--modes-text-dim)]">Team availability</span>
              {typeof availableCount === 'number' && totalMembers > 0 && (
                <span className="text-label-12 text-[var(--modes-text-dim)]">{availableCount}/{totalMembers} available</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {sortedMembers.map(m => {
                const meta = STATUS_META[m.status] || STATUS_META.pending;
                return (
                  <div key={m.id} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[var(--modes-surface-strong)] border border-[var(--modes-border)] flex items-center justify-center overflow-hidden shrink-0 text-label-11 font-bold text-[var(--modes-text-muted)]">
                      {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" /> : (m.name[0] || '?').toUpperCase()}
                    </div>
                    <span className="flex-1 min-w-0 text-copy-13 text-[var(--modes-text)] truncate">
                      {m.name}{m.isYou && <span className="text-[var(--modes-text-dim)]"> (you)</span>}
                    </span>
                    <span className={`text-label-11 px-2 py-0.5 rounded-full shrink-0 ${meta.cls}`}>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
