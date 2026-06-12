import { useState } from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';

/**
 * WorkspacePickerDialog — pick a destination workspace for moving/copying
 * songs. Lists the candidate workspaces (the current one is excluded by the
 * caller) and confirms the chosen target.
 */
export default function WorkspacePickerDialog({
  open,
  title = 'Choose a workspace',
  description,
  confirmLabel = 'Confirm',
  workspaces = [],
  onSelect,
  onClose,
}) {
  const [selected, setSelected] = useState(workspaces.length === 1 ? workspaces[0].id : null);

  if (!open) return null;

  const submit = () => {
    if (!selected) return;
    onSelect?.(selected);
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} size="sm" ariaLabel={title}>
      <div className="p-6 flex flex-col gap-3">
        <h2 className="text-heading-18 font-semibold text-[var(--ds-gray-1000)] m-0">{title}</h2>
        {description && (
          <p className="text-copy-13 text-[var(--ds-gray-700)] m-0">{description}</p>
        )}
        <div className="flex flex-col gap-1.5 mt-1">
          {workspaces.length === 0 ? (
            <p className="text-copy-13 text-[var(--ds-gray-600)] italic m-0">
              No other workspaces available.
            </p>
          ) : (
            workspaces.map(w => {
              const active = selected === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelected(w.id)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border text-left cursor-pointer transition-colors ${
                    active
                      ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]'
                      : 'border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-100)]'
                  }`}
                >
                  <span className="truncate text-copy-14 font-medium">{w.name}</span>
                  <span
                    aria-hidden
                    className={`shrink-0 w-4 h-4 rounded-full border-2 ${
                      active ? 'border-[var(--color-brand)] bg-[var(--color-brand)]' : 'border-[var(--ds-gray-400)]'
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>
      </div>
      <div className="px-6 pb-6 pt-1 flex justify-end gap-2">
        <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
        <Button variant="brand" size="md" onClick={submit} disabled={!selected}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
