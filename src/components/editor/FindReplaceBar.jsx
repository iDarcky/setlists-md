import { useEffect } from 'react';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';

/* ─── Find / Replace bar ───
 * Presentational find/replace toolbar shared by the Advanced (WriteTab) editor
 * and the visual Arrange canvas. All match/replace logic lives in the caller;
 * this only renders the inputs + controls and wires keyboard shortcuts. */
export default function FindReplaceBar({
  findText, replaceText, caseSensitive, matchCount, matchIdx,
  findInputRef,
  onFindChange, onReplaceChange, onToggleCase,
  onPrev, onNext, onReplaceOne, onReplaceAll, onClose,
}) {
  useEffect(() => {
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, [findInputRef]);

  const handleFindKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) onPrev(); else onNext();
    }
  };

  const handleReplaceKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey || e.altKey) onReplaceAll(); else onReplaceOne();
    }
  };

  const hasMatches = matchCount > 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-2 p-1.5 rounded-lg bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)]">
      <input
        ref={findInputRef}
        value={findText}
        onChange={e => onFindChange(e.target.value)}
        onKeyDown={handleFindKey}
        placeholder="Find"
        className="flex-1 min-w-[120px] px-2 py-1 bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] rounded-md text-copy-12 text-[var(--ds-gray-1000)] outline-none font-mono"
      />
      <span
        className="text-label-11-mono whitespace-nowrap px-1"
        style={{ color: findText && !hasMatches ? 'var(--ds-red-900)' : 'var(--ds-gray-600)' }}
      >
        {findText ? (hasMatches ? `${matchIdx + 1} / ${matchCount}` : '0 / 0') : ''}
      </span>
      <IconButton variant="ghost" size="xs" onClick={onPrev} disabled={!hasMatches} aria-label="Previous match" title="Previous (Shift+Enter)">↑</IconButton>
      <IconButton variant="ghost" size="xs" onClick={onNext} disabled={!hasMatches} aria-label="Next match" title="Next (Enter)">↓</IconButton>
      <button
        onClick={onToggleCase}
        title="Case sensitive"
        className={`rounded-md px-2 py-1 text-label-11 font-semibold font-mono border transition-colors ${
          caseSensitive
            ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] border-[var(--color-brand-border)]'
            : 'bg-[var(--ds-background-200)] text-[var(--ds-gray-600)] border-[var(--ds-gray-400)] hover:bg-[var(--ds-gray-200)]'
        }`}
      >
        Aa
      </button>
      <input
        value={replaceText}
        onChange={e => onReplaceChange(e.target.value)}
        onKeyDown={handleReplaceKey}
        placeholder="Replace"
        className="flex-1 min-w-[120px] px-2 py-1 bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] rounded-md text-copy-12 text-[var(--ds-gray-1000)] outline-none font-mono"
      />
      <Button variant="secondary" size="xs" onClick={onReplaceOne} disabled={!hasMatches}>Replace</Button>
      <Button variant="secondary" size="xs" onClick={onReplaceAll} disabled={!hasMatches}>All</Button>
      <IconButton variant="ghost" size="xs" onClick={onClose} aria-label="Close find" title="Close (Esc)">✕</IconButton>
    </div>
  );
}
