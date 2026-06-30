import { sectionStyle } from '../../music';
import StructureEditor from './StructureEditor';

// "Verse 1" -> "V1", "Pre Chorus 2" -> "PC2", "Chorus" -> "C".
function shortCode(type) {
  const base = type.replace(/\s*\d+$/, '');
  const num = (type.match(/(\d+)\s*:?\s*$/) || [])[1] || '';
  const initials = base.split(/\s+/).map(w => w[0] || '').join('').toUpperCase();
  return initials + num;
}

// The song's one official structure control, shared by the Arrange and Advanced
// tabs so the two always match. Just a checkbox (no text label) toggles a custom
// slide order; the chips show the play order (auto = section order; custom = the
// hand-tuned order). When custom, an "Edit order" link opens the reorder/repeat
// sheet.
//
//   mode          — 'auto' | 'custom'
//   value         — comma-separated structure string (the custom order)
//   sections      — section names in document order (strings)
//   onToggleMode(custom) / onChangeValue(next)
//   onJump(name)  — optional; scroll to that section (Arrange tab only)
export default function StructureControl({ mode, value, sections, customSectionTypes, onToggleMode, onChangeValue, onJump }) {
  const isCustom = mode === 'custom';
  const playOrder = (isCustom && value)
    ? value.split(',').map(s => s.trim()).filter(Boolean)
    : sections;
  const uniqueTypes = [...new Set(sections)];
  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <input
        type="checkbox"
        checked={isCustom}
        onChange={(e) => onToggleMode(e.target.checked)}
        title="Custom slide order — repeat, reorder, or skip sections"
        aria-label="Custom slide order"
        className="accent-[var(--color-brand)] shrink-0 cursor-pointer"
      />
      {/* Chips size to content (not flex-1) so "Edit order" sits right next to
          them; a trailing spacer keeps the group left and pushes anything after
          the control (e.g. the Arrange customize icon) to the far right. */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
        {playOrder.length ? playOrder.map((name, i) => {
          const st = sectionStyle(name, null, customSectionTypes);
          const Tag = onJump ? 'button' : 'span';
          return (
            <Tag
              key={i}
              {...(onJump ? { type: 'button', onClick: () => onJump(name) } : {})}
              className={`shrink-0 inline-flex items-center px-2 py-1 rounded-[7px] text-[11px] font-bold font-mono border border-[var(--border-1)] bg-[var(--ds-background-100)] ${onJump ? 'hover:opacity-80 cursor-pointer' : ''}`}
              style={{ color: st.b }}
              title={name}
            >
              {shortCode(name)}
            </Tag>
          );
        }) : (
          <span className="text-label-10 uppercase tracking-wider text-[var(--ds-gray-500)]">Structure</span>
        )}
      </div>
      {isCustom && (
        <StructureEditor
          variant="link"
          value={value}
          availableSections={uniqueTypes}
          onChange={onChangeValue}
          autoSeed={false}
        />
      )}
      <div className="flex-1" />
    </div>
  );
}
