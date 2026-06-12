import { useState } from 'react';

// A comma-separated string editor rendered as chips. Stays compatible with the
// flat frontmatter model (value/onChange are plain "a, b, c" strings) — it just
// presents them as removable chips with a max count.
//
// allowSpace — when true, space also commits a chip (for single-word values like
//   themes/tags). Leave false for values that contain spaces (Bible verses,
//   liturgical moments), where only a comma should delimit.
export default function ChipInput({
  value = '',
  onChange,
  max = 99,
  allowSpace = false,
  maxChipLength = 40,
  placeholder = '',
}) {
  const chips = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  const [draft, setDraft] = useState('');
  const atMax = chips.length >= max;

  const commit = (next) => onChange(next.join(', '));

  const addChip = (raw) => {
    const v = raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxChipLength);
    if (!v) { setDraft(''); return; }
    if (chips.length >= max) { setDraft(''); return; }
    if (chips.some(c => c.toLowerCase() === v.toLowerCase())) { setDraft(''); return; }
    commit([...chips, v]);
    setDraft('');
  };

  const removeChip = (i) => commit(chips.filter((_, idx) => idx !== i));

  const handleInput = (e) => {
    const val = e.target.value;
    // Split on commas (and spaces when allowed) so pastes turn into chips too.
    const delim = allowSpace ? /[,\n\t ]/ : /[,\n\t]/;
    if (delim.test(val)) {
      const parts = val.split(delim);
      const last = parts.pop();
      parts.forEach(p => addChip(p));
      setDraft(last);
    } else {
      setDraft(val);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',' || (allowSpace && e.key === ' ')) {
      e.preventDefault();
      addChip(draft);
    } else if (e.key === 'Backspace' && !draft && chips.length) {
      removeChip(chips.length - 1);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-md min-h-[38px]">
      {chips.map((c, i) => (
        <span
          key={`${c}-${i}`}
          className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded bg-[var(--ds-gray-200)] text-copy-13 text-[var(--ds-gray-1000)]"
        >
          {c}
          <button
            type="button"
            onClick={() => removeChip(i)}
            aria-label={`Remove ${c}`}
            className="opacity-60 hover:opacity-100 bg-transparent border-none cursor-pointer leading-none px-0.5"
          >
            ✕
          </button>
        </span>
      ))}
      {!atMax && (
        <input
          value={draft}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onBlur={() => addChip(draft)}
          placeholder={chips.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-copy-13 text-[var(--ds-gray-1000)] py-0.5 font-mono"
        />
      )}
    </div>
  );
}
