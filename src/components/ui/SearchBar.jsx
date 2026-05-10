import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const SearchIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const ClearIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

/**
 * Unified search bar used across Library, Setlists, and Dashboard.
 * - Tall pill (h-11) with brand-color focus ring
 * - Inline search icon prefix and × clear suffix when query is non-empty
 * - "modes" theme tokens so it sits nicely on dark surfaces
 *
 * Pass any standard <input> prop via ...rest (onFocus, onBlur, ref, etc.).
 */
const SearchBar = forwardRef(function SearchBar(
  { value, onChange, onClear, placeholder = 'Search…', className, ...rest },
  ref,
) {
  const handleClear = () => {
    if (onClear) onClear();
    else onChange?.({ target: { value: '' } });
  };

  return (
    <div className={cn('relative flex items-center', className)}>
      <span className="absolute left-3.5 text-[var(--modes-text-muted)] pointer-events-none">
        <SearchIcon />
      </span>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full h-11 pl-10 pr-10 rounded-xl border border-[var(--modes-border)] bg-[var(--modes-surface)] text-copy-14 text-[var(--modes-text)] placeholder:text-[var(--modes-text-dim)] outline-none transition-colors focus:border-[var(--color-brand)] focus:bg-[var(--modes-surface-strong)]"
        {...rest}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2 w-7 h-7 rounded-md flex items-center justify-center text-[var(--modes-text-muted)] hover:text-[var(--modes-text)] hover:bg-[var(--modes-surface-strong)] bg-transparent border-none cursor-pointer"
        >
          <ClearIcon />
        </button>
      )}
    </div>
  );
});

export { SearchBar };
export default SearchBar;
