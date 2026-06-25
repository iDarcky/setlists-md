import StructureEditor from './StructureEditor';

// The song's official structure (slide order), edited from the Arrange tab and
// mirrored into the Advanced tab. A checkbox picks auto (follows the arrangement
// order) vs. a custom, hand-tuned slide order; the slide-order editor only shows
// when custom. A one-time inline explainer teaches the concept.
//
// Props:
//   value             — comma-separated structure string
//   mode              — 'auto' | 'custom'
//   availableSections — section labels found in the song body
//   onChangeValue(next) / onChangeMode(custom)
//   tipSeen / onDismissTip — device-local once-seen explainer
export default function StructureRow({
  value,
  mode,
  availableSections,
  onChangeValue,
  onChangeMode,
  tipSeen,
  onDismissTip,
}) {
  const isCustom = mode === 'custom';
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <label
          className="flex items-center gap-1.5 shrink-0 text-label-11 font-medium text-[var(--ds-gray-700)] cursor-pointer select-none"
          title="When off, the play order follows your arrangement. When on, you set a custom slide order (repeat, reorder, or skip sections)."
        >
          <input
            type="checkbox"
            checked={isCustom}
            onChange={(e) => onChangeMode(e.target.checked)}
            className="accent-[var(--color-brand)]"
          />
          Custom slide order
        </label>
        {isCustom ? (
          <StructureEditor
            value={value}
            availableSections={availableSections}
            onChange={onChangeValue}
            autoSeed={false}
          />
        ) : (
          <span className="text-label-11 text-[var(--ds-gray-500)] italic truncate">
            Follows the arrangement order
          </span>
        )}
      </div>
      {!tipSeen && (
        <div className="mt-2 px-3 py-2 rounded-lg border border-[var(--ds-gray-300)] bg-[var(--ds-gray-100)] flex items-start gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5 text-[var(--color-brand-text)]"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
          <p className="flex-1 text-label-11 text-[var(--ds-gray-700)] leading-snug">
            <span className="font-semibold text-[var(--ds-gray-1000)]">Structure</span> is the order your sections play.
            Leave <span className="font-semibold">Custom slide order</span> off and it follows the sections as you arrange them.
            Turn it on to repeat, reorder, or skip sections (e.g. Verse · Chorus · Chorus) without changing the song itself.
          </p>
          <button
            type="button"
            onClick={onDismissTip}
            aria-label="Dismiss tip"
            className="shrink-0 text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-1000)] bg-transparent border-none cursor-pointer p-0.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
