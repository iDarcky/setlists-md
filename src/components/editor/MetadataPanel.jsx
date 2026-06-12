import { useState, useEffect, useRef, useCallback } from 'react';
import { splitMd, replaceFrontmatter, parseFrontmatterFields, serializeFrontmatterFields } from '../../parser';
import ChipInput from '../ui/ChipInput';

// type: 'text' (default) | 'number' | 'time' | 'url' | 'chips'
// max: maxLength for text/number/time; maxChips for chips.
const FIELDS = [
  { key: 'title', label: 'Title', placeholder: 'Song title', span: 2, max: 80 },
  { key: 'artist', label: 'Artist', placeholder: 'Artist / band', span: 2, max: 60 },
  { key: 'originaltitle', label: 'Original title', placeholder: 'For translated songs', span: 2, max: 80 },
  { key: 'language', label: 'Language', placeholder: 'English', span: 1, max: 30 },
  { key: 'translator', label: 'Translator', placeholder: 'Name', span: 1, max: 60 },
  { key: 'capo', label: 'Capo', placeholder: '0', span: 1, type: 'number', max: 2 },
  { key: 'duration', label: 'Length', placeholder: '3:45', span: 1, type: 'time', max: 5 },
  { key: 'vocalrange', label: 'Vocal range', placeholder: 'A2–C5', span: 1, max: 10 },
  { key: 'year', label: 'Release year', placeholder: '1779', span: 1, type: 'number', max: 4 },
  { key: 'writers', label: 'Writers', placeholder: 'Comma separated', span: 2, max: 100 },
  { key: 'publishers', label: 'Publishers', placeholder: 'Comma separated', span: 2, max: 100 },
  { key: 'album', label: 'Album', placeholder: 'Album name', span: 1, max: 60 },
  { key: 'label', label: 'Label', placeholder: 'Record label', span: 1, max: 60 },
  { key: 'ccli', label: 'CCLI', placeholder: 'CCLI number', span: 1, type: 'number', max: 9 },
  { key: 'copyright', label: 'Copyright', placeholder: '© …', span: 1, max: 150 },
  { key: 'themes', label: 'Themes', placeholder: 'grace, redemption', span: 2, type: 'chips', max: 10, allowSpace: true },
  { key: 'genres', label: 'Genres', placeholder: 'hymn, worship', span: 2, type: 'chips', max: 5, allowSpace: true },
  { key: 'scripture', label: 'Bible verses', placeholder: 'Ephesians 2:8 (comma to add)', span: 2, type: 'chips', max: 10, allowSpace: false },
  { key: 'moment', label: 'Liturgical moment', placeholder: 'Communion (comma to add)', span: 2, type: 'chips', max: 3, allowSpace: false },
  { key: 'tags', label: 'Tags', placeholder: 'worship, hymn, fast', span: 2, type: 'chips', max: 10, allowSpace: true },
  { key: 'spotify', label: 'Spotify', placeholder: 'https://…', span: 2, type: 'url', max: 300 },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://…', span: 2, type: 'url', max: 300 },
  { key: 'story', label: 'Story behind', placeholder: 'The story behind the song', span: 2, max: 300 },
  { key: 'notes', label: 'Notes', placeholder: 'Performance notes', span: 2, max: 200 },
];

const INPUT_CLASS = 'w-full px-2.5 py-1.5 bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-md text-copy-13 text-[var(--ds-gray-1000)] outline-none font-mono';

export default function MetadataPanel({ md, onChange, isOpen, keyHistory }) {
  const isInternalUpdate = useRef(false);

  const [fields, setFields] = useState(() => parseFrontmatterFields(splitMd(md).frontmatter));

  // Sync from external md changes (e.g., WriteTab edited frontmatter directly)
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    setFields(parseFrontmatterFields(splitMd(md).frontmatter));
  }, [md]);

  const handleChange = useCallback((key, value) => {
    setFields(prev => {
      const updated = { ...prev, [key]: value };
      isInternalUpdate.current = true;
      onChange(replaceFrontmatter(md, serializeFrontmatterFields(updated)));
      return updated;
    });
  }, [md, onChange]);

  // Per-type input value filtering before it reaches the field.
  const filterValue = (f, raw) => {
    if (f.type === 'number') return raw.replace(/\D/g, '').slice(0, f.max);
    if (f.type === 'time') return raw.replace(/[^\d:]/g, '').slice(0, f.max);
    return f.max ? raw.slice(0, f.max) : raw;
  };

  const renderInput = (f) => {
    if (f.type === 'chips') {
      return (
        <ChipInput
          value={fields[f.key]}
          onChange={v => handleChange(f.key, v)}
          max={f.max}
          allowSpace={f.allowSpace}
          placeholder={f.placeholder}
        />
      );
    }
    return (
      <input
        value={fields[f.key]}
        onChange={e => handleChange(f.key, filterValue(f, e.target.value))}
        placeholder={f.placeholder}
        type={f.type === 'url' ? 'url' : 'text'}
        inputMode={f.type === 'number' ? 'numeric' : (f.type === 'time' ? 'numeric' : undefined)}
        maxLength={f.max && f.type !== 'chips' ? f.max : undefined}
        className={INPUT_CLASS}
      />
    );
  };

  // The toggle button now lives on the controls row in Editor.jsx so the
  // header stays compact. We only render the expanded body here.
  return (
    <div>
      {isOpen && (
        <div className="grid grid-cols-2 gap-2 pb-3">
          {FIELDS.map(f => (
            <label
              key={f.key}
              className="block"
              style={{ gridColumn: f.span === 2 ? 'span 2' : 'span 1' }}
            >
              <span className="text-label-12 font-semibold text-[var(--ds-gray-700)] block mb-0.5">
                {f.label}
              </span>
              {renderInput(f)}
            </label>
          ))}
          {keyHistory && Object.keys(keyHistory).length > 0 && (
            <div className="col-span-2">
              <span className="text-label-12 font-semibold text-[var(--ds-gray-700)] block mb-1">
                Most played in
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(keyHistory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, count]) => (
                    <span
                      key={k}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-label-11 border border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)]"
                    >
                      <span className="text-[var(--chord)] font-semibold">{k}</span>
                      <span className="text-[var(--ds-gray-600)] tabular-nums">·{count}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
