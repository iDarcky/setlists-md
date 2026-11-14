import { cn } from './utils';

// The one on/off switch (2026-11-14). It is the setlist editor's switch, the
// first one built on the new design: 44×26, the link colour when on, the
// raised fill when off, a page-coloured knob. Settings had a bigger one of
// its own; every screen now uses this.
function Switch({ checked, onCheckedChange, label, disabled = false, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'relative h-[26px] w-11 min-h-0 shrink-0 cursor-pointer rounded-full border-0 p-0 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-link' : 'bg-input',
        className,
      )}
    >
      <span className={cn('absolute top-[3px] size-5 rounded-full bg-background transition-[left]', checked ? 'left-[21px]' : 'left-[3px]')} />
    </button>
  );
}

export { Switch };
