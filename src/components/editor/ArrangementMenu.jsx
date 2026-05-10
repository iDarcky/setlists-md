import { useState, useEffect, useRef } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Input } from '../ui/Input';
import { useConfirm } from '../ui/useConfirmHook';

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const X = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const Plus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * Single-trigger arrangement picker styled after Proclaim.
 *
 * The trigger shows the active arrangement name + chevron. Clicking opens a
 * popover with one row per arrangement (each with its own × delete), then
 * a footer with "+ New", "Rename", and "Edit Arrangements…". Only one
 * arrangement = the × is hidden (you can't delete the last one).
 */
export default function ArrangementMenu({
  arrangements = [],
  activeId,
  defaultId,
  onSwitch,
  onAdd,
  onRename,
  onDelete,
  onEdit,
}) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Close on outside click + Esc.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = arrangements.find(a => a.id === activeId) || arrangements[0];
  const canDeleteAny = arrangements.length > 1;

  const handleDeleteRow = async (arr, e) => {
    e.stopPropagation();
    if (!canDeleteAny) return;
    const ok = await confirm({
      title: 'Delete arrangement?',
      description: `"${arr.name}" will be removed from this song.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (ok) onDelete?.(arr.id);
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] text-label-12 text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)] cursor-pointer transition-colors max-w-[220px]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Arrangement"
      >
        <span className="truncate">{active?.name || 'Arrangement'}</span>
        <span className="opacity-70 shrink-0"><ChevronDown /></span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute z-40 left-0 mt-1 min-w-[260px] max-w-[320px] rounded-xl bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] shadow-2xl overflow-hidden"
        >
          <ul className="max-h-[300px] overflow-y-auto m-0 p-0 list-none">
            {arrangements.map(arr => (
              <li key={arr.id} className="m-0 p-0">
                <div
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-copy-13 ${
                    arr.id === activeId
                      ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] font-semibold'
                      : 'text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-alpha-100)]'
                  }`}
                  onClick={() => { onSwitch?.(arr.id); setOpen(false); }}
                >
                  <span className="flex-1 min-w-0 truncate">
                    {arr.name}
                    {arr.id === defaultId && (
                      <span className="ml-1.5 text-label-10 uppercase tracking-wider opacity-60">default</span>
                    )}
                  </span>
                  {canDeleteAny && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteRow(arr, e)}
                      aria-label={`Delete ${arr.name}`}
                      title={`Delete ${arr.name}`}
                      className="shrink-0 p-1 rounded-md text-[var(--ds-gray-600)] hover:text-[var(--ds-error-600)] hover:bg-[var(--ds-gray-alpha-100)] cursor-pointer bg-transparent border-none"
                    >
                      <X />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-[var(--ds-gray-300)]" />

          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-copy-13 text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-alpha-100)] cursor-pointer bg-transparent border-none text-left"
            onClick={() => { setOpen(false); onAdd?.(); }}
          >
            <Plus />
            <span>New Arrangement</span>
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-copy-13 text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-alpha-100)] cursor-pointer bg-transparent border-none text-left"
            onClick={() => { setOpen(false); onRename?.(); }}
          >
            Rename Arrangement
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-copy-13 font-semibold text-[var(--color-brand-text)] hover:bg-[var(--color-brand-soft)] cursor-pointer bg-transparent border-none text-left"
            onClick={() => { setOpen(false); onEdit?.(); }}
          >
            Edit Arrangements…
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Modal that lists every arrangement with inline rename, set-default, and
 * delete. Reachable from the menu's "Edit Arrangements…" item — a fuller
 * management UI for songs with several arrangements.
 */
export function EditArrangementsDialog({
  open,
  onClose,
  arrangements = [],
  defaultId,
  onRename,
  onDelete,
  onSetDefault,
  onAdd,
}) {
  const confirm = useConfirm();
  // Local mirror of names so the user can edit freely; we commit on blur or
  // Enter so the parent re-render doesn't fight the input.
  const [drafts, setDrafts] = useState({});
  useEffect(() => {
    if (!open) return;
    const next = {};
    for (const a of arrangements) next[a.id] = a.name;
    setDrafts(next);
  }, [open, arrangements]);

  const commitName = (id) => {
    const next = (drafts[id] || '').trim();
    if (!next) return;
    const current = arrangements.find(a => a.id === id);
    if (!current || current.name === next) return;
    onRename?.(id, next);
  };

  const handleDelete = async (arr) => {
    const ok = await confirm({
      title: 'Delete arrangement?',
      description: `"${arr.name}" will be removed from this song.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (ok) onDelete?.(arr.id);
  };

  const canDelete = arrangements.length > 1;

  return (
    <Dialog open={open} onClose={onClose} size="md" ariaLabel="Edit arrangements">
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-heading-18 font-semibold text-[var(--ds-gray-1000)] m-0">
            Edit Arrangements
          </h2>
          <Button variant="secondary" size="sm" onClick={onAdd}>
            + New
          </Button>
        </div>
        <p className="text-copy-13 text-[var(--ds-gray-700)] m-0">
          Rename, choose a default, or remove arrangements. The default opens
          first when this song is added to a setlist.
        </p>

        <ul className="flex flex-col gap-2 m-0 p-0 list-none">
          {arrangements.map(arr => {
            const isDefault = arr.id === defaultId;
            return (
              <li key={arr.id} className="flex items-center gap-2 m-0 p-0">
                <button
                  type="button"
                  onClick={() => onSetDefault?.(arr.id)}
                  aria-label={isDefault ? 'Default arrangement' : `Set ${arr.name} as default`}
                  title={isDefault ? 'Default' : 'Set as default'}
                  className="shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-transparent cursor-pointer transition-colors"
                  style={{
                    borderColor: isDefault ? 'var(--color-brand)' : 'var(--ds-gray-400)',
                  }}
                >
                  {isDefault && (
                    <span className="block w-2 h-2 rounded-full" style={{ background: 'var(--color-brand)' }} />
                  )}
                </button>
                <Input
                  value={drafts[arr.id] ?? ''}
                  onChange={e => setDrafts(d => ({ ...d, [arr.id]: e.target.value }))}
                  onBlur={() => commitName(arr.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.currentTarget.blur(); }
                    if (e.key === 'Escape') {
                      setDrafts(d => ({ ...d, [arr.id]: arr.name }));
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="Arrangement name"
                  size="sm"
                />
                <IconButton
                  size="sm"
                  variant="error"
                  onClick={() => handleDelete(arr)}
                  aria-label={`Delete ${arr.name}`}
                  disabled={!canDelete}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </IconButton>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="px-6 pb-6 pt-2 flex justify-end gap-2">
        <Button variant="brand" size="md" onClick={onClose}>
          Done
        </Button>
      </div>
    </Dialog>
  );
}
