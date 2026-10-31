import { useEffect, useRef, useState } from 'react';
import { Sheet } from '@/ui/shadcn/sheet';
import { Input } from '@/ui/shadcn/input';
import { Button } from '@/ui/shadcn/button';

/**
 * PromptDialog: one text field, the app's replacement for window.prompt
 * (naming or renaming an arrangement). Same shape as a confirm: a bottom
 * drawer on a phone, a small dialog from the iPad up.
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
  // on each open; the effect only focuses and selects.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const submit = () => {
    if (!value.trim()) return;
    onSubmit?.(value.trim());
    onClose?.();
  };

  return (
    <Sheet open={!!open} onOpenChange={(o) => { if (!o) onClose?.(); }} title={title || 'Name'} className="h-auto max-h-[80dvh] sm:max-w-[420px]">
      <form className="flex flex-col gap-5 font-sans" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="flex flex-col gap-2">
          {label && <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>}
          <Input ref={inputRef} value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
          <Button type="submit" disabled={!value.trim()}>{confirmLabel}</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Sheet>
  );
}
