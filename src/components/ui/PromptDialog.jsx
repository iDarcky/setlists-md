import { useState, useEffect, useRef } from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';

/**
 * PromptDialog — a single-text-field modal, the custom-UI replacement for
 * window.prompt (e.g. naming/renaming an arrangement). Mirrors ConfirmDialog's
 * shape so it sits consistently in the Geist dialog family.
 */
export default function PromptDialog({
  open,
  title,
  label,
  placeholder,
  initialValue = '',
  confirmLabel = 'OK',
  onSubmit,
  onClose,
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);

  // Mounted only while open (see call site), so initialValue is captured fresh
  // on each open — the effect just needs to focus + select, no state reset.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  if (!open) return null;

  const submit = () => {
    if (!value.trim()) return;
    onSubmit?.(value.trim());
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} size="sm" ariaLabel={title}>
      <div className="p-6 flex flex-col gap-3">
        {title && (
          <h2 className="text-heading-18 font-semibold text-[var(--ds-gray-1000)] m-0">{title}</h2>
        )}
        <label className="flex flex-col gap-1.5">
          {label && (
            <span className="text-label-12 font-semibold text-[var(--ds-gray-700)]">{label}</span>
          )}
          <input
            ref={inputRef}
            value={value}
            placeholder={placeholder}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
            className="w-full px-3 py-2 bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-md text-copy-14 text-[var(--ds-gray-1000)] outline-none"
          />
        </label>
      </div>
      <div className="px-6 pb-6 pt-1 flex justify-end gap-2">
        <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="md" onClick={submit} disabled={!value.trim()}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
