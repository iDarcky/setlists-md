import { useEffect } from 'react';
import type { ComponentType } from 'react';
import { ClipboardPaste, PenLine } from 'lucide-react';
import { cn } from '@/ui/shadcn/utils';
import { Button } from '@/ui/typed';

// An empty chart: two big choices and no subtitles (approved mockup "new song
// chart" v1, owner 2026-11-20). A phone stacks the tiles, a tablet puts them
// side by side; from 1024px it is one dashed zone where ⌘V anywhere pastes.

function Tile({ icon: Icon, label, primary = false, onClick }: {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn('flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-card border bg-transparent px-4 py-7 font-sans text-body font-semibold text-foreground outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring',
        primary ? 'border-control-edge' : 'border-dashed border-input')}>
      <span className="flex size-12 items-center justify-center rounded-full bg-raised"><Icon size={22} strokeWidth={1.8} /></span>
      {label}
    </button>
  );
}

/**
 * @param onPaste  open the paste box, with the text when we already have it
 * @param onWrite  start with an empty verse
 */
export function StartChart({ wide, onPaste, onWrite }: {
  wide: boolean;
  onPaste: (text?: string) => void;
  onWrite: () => void;
}) {
  // From the desktop up, ⌘V anywhere on the page pastes the song, unless a
  // text box has focus (the title, say).
  useEffect(() => {
    if (!wide) return undefined;
    const onDocPaste = (e: ClipboardEvent) => {
      const el = document.activeElement;
      if (el && el.closest('input, textarea, [contenteditable="true"]')) return;
      const text = e.clipboardData?.getData('text/plain') || '';
      if (!text.trim()) return;
      e.preventDefault();
      onPaste(text);
    };
    document.addEventListener('paste', onDocPaste);
    return () => document.removeEventListener('paste', onDocPaste);
  }, [wide, onPaste]);

  // A tap reads the clipboard when the browser lets us (it asks first on
  // iOS); otherwise the paste box opens and a long press pastes.
  const paste = async () => {
    let text = '';
    try { text = (await navigator.clipboard?.readText?.()) || ''; } catch { /* not allowed: fall back to the box */ }
    onPaste(text.trim() ? text : undefined);
  };

  if (wide) {
    const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const kbd = 'rounded-[5px] border border-border bg-raised px-1.5 font-mono text-caption';
    return (
      <div className="flex justify-center py-10">
        {/* The zone is a button too: an iPad in landscape has no ⌘V. */}
        <div role="button" tabIndex={0} aria-label="Paste the song" onClick={paste} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); paste(); } }}
          className="flex w-full max-w-[620px] cursor-pointer flex-col items-center gap-4 rounded-[16px] border-[1.5px] border-dashed border-input px-8 py-14 text-center outline-none hover:bg-raised/40 focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex size-12 items-center justify-center rounded-full bg-raised"><ClipboardPaste size={22} strokeWidth={1.8} /></span>
          <b className="text-heading font-semibold">Paste the song</b>
          <span className="flex items-center gap-1.5 text-small text-muted-foreground">
            Press <kbd className={kbd}>{mac ? '⌘' : 'Ctrl'}</kbd><kbd className={kbd}>V</kbd> anywhere here
          </span>
          <span className="mt-2" onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" onClick={onWrite}><PenLine size={16} strokeWidth={1.8} />Write it instead</Button>
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Tile icon={ClipboardPaste} label="Paste the song" primary onClick={paste} />
      <Tile icon={PenLine} label="Write it" onClick={onWrite} />
    </div>
  );
}
