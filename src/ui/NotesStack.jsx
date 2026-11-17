import { useState, useEffect, useRef } from 'react';
import NoteContent from './NoteContent';

// Unified notes surface used across chart / practice / live / setlist builder.
//
// Renders a collapsed "Notes" pill that expands to show one or more labelled
// entries stacked together. Each entry can be read-only (markdown via
// NoteContent) or inline-editable. In C1 it's passed a single shared entry; C2
// adds a second "My note" (private) entry without any call-site changes.
//
// entries: Array<{
//   key: string,
//   label?: string,        // small caption above the note (e.g. "Team", "Mine")
//   value: string,
//   editable?: boolean,    // shows edit affordance + onSave
//   onSave?: (text) => void,
//   placeholder?: string,  // textarea placeholder
//   addLabel?: string,     // empty-state call to action
// }>
export default function NotesStack({ entries = [], defaultOpen = false, pillLabel = 'Notes', className = '' }) {
  const visible = entries.filter(e => e && (e.value?.trim() || e.editable));
  const [open, setOpen] = useState(defaultOpen);

  if (!visible.length) return null;

  const hasContent = visible.some(e => e.value?.trim());

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded="false"
        className={`inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full border border-[var(--ds-gray-300)] bg-[var(--ds-gray-alpha-100)] text-label-11 text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-200)] hover:text-[var(--ds-gray-1000)] transition-colors ${className}`}
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
        {hasContent ? pillLabel : `Add ${pillLabel.toLowerCase()}`}
      </button>
    );
  }

  return (
    <div
      className={`rounded-lg border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] overflow-hidden ${className}`}
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--ds-gray-300)]">
        <span className="text-label-10 uppercase tracking-wider font-semibold text-[var(--ds-gray-600)]">{pillLabel}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Hide notes"
          className="text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
      <div className="divide-y divide-[var(--ds-gray-300)]">
        {visible.map(entry => (
          <NoteEntry key={entry.key} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function NoteEntry({ entry }) {
  const { label, value, editable, onSave, placeholder, addLabel } = entry;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const textareaRef = useRef(null);

  // Re-sync the draft when the value changes externally and we're not editing.
  const [prevSync, setPrevSync] = useState({ value, editing });
  if (prevSync.value !== value || prevSync.editing !== editing) {
    setPrevSync({ value, editing });
    if (!editing) setDraft(value || '');
  }

  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.selectionStart = el.selectionEnd = el.value.length;
    }
  }, [editing]);

  const save = () => { onSave?.(draft.trim()); setEditing(false); };
  const cancel = () => { setDraft(value || ''); setEditing(false); };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') cancel();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
  };

  return (
    <div className="px-3 py-2.5">
      {label && (
        <div className="text-label-10 uppercase tracking-wider font-semibold text-[var(--ds-gray-500)] mb-1">{label}</div>
      )}
      {editing ? (
        <div>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            placeholder={placeholder || 'Add a note…'}
            className="w-full resize-none bg-transparent outline-none text-[var(--ds-gray-1000)] text-copy-13 leading-snug placeholder:text-[var(--ds-gray-500)]"
          />
          <div className="flex justify-end gap-2 mt-1">
            <button onClick={cancel} className="h-7 px-3 rounded-lg text-label-12 text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] transition-colors">Cancel</button>
            <button onClick={save} className="h-7 px-3 rounded-lg text-label-12 text-white font-semibold transition-colors" style={{ background: 'var(--color-brand)' }}>Save</button>
          </div>
        </div>
      ) : value?.trim() ? (
        <div className="flex items-start gap-2 group">
          <NoteContent text={value} className="flex-1 text-copy-13 text-[var(--ds-gray-1000)]" />
          {editable && (
            <button
              type="button"
              onClick={() => { setDraft(value); setEditing(true); }}
              aria-label="Edit note"
              className="shrink-0 mt-0.5 text-[var(--ds-gray-500)] opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--ds-gray-1000)]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </button>
          )}
        </div>
      ) : editable ? (
        <button
          type="button"
          onClick={() => { setDraft(''); setEditing(true); }}
          className="flex items-center gap-2 text-label-12 text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-700)] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {addLabel || 'Add a note'}
        </button>
      ) : null}
    </div>
  );
}
