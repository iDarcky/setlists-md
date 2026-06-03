import { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { DatePicker } from '../ui/DatePicker';
import { TimePicker } from '../ui/TimePicker';
import { useEntitlement } from '../../hooks/useEntitlement';

const MAX_TAGS = 3;

// Service picker — a real dropdown of known services + an "Add new" flow.
function ServiceField({ value, options, onChange }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const list = [...new Set([...(options || []), value].filter(Boolean))];
  const commit = () => { const v = draft.trim(); if (v) onChange(v); setAdding(false); setDraft(''); };

  if (adding) {
    return (
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { setAdding(false); setDraft(''); }
          }}
          placeholder="New service name"
        />
        <Button size="sm" variant="brand" onClick={commit}>Add</Button>
        <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setDraft(''); }}>Cancel</Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={e => { const v = e.target.value; if (v === '__add__') setAdding(true); else onChange(v); }}
        style={{ accentColor: 'var(--color-brand)' }}
        className="w-full h-10 px-3 pr-9 rounded-lg appearance-none cursor-pointer bg-[var(--ds-background-100)] border border-[var(--ds-gray-400)] text-copy-14 text-[var(--ds-gray-1000)] outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-soft)] transition-colors"
      >
        <option value="">No service</option>
        {list.map(s => <option key={s} value={s}>{s}</option>)}
        <option value="__add__">+ Add new service…</option>
      </select>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ds-gray-600)]">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

/**
 * Setlist metadata form — name, date, freeform tags, and (Church tier only) service.
 */
export default function SetlistMetaForm({ name, date, time = '20:00', location = '', tags, service = '', knownServices = [], firstDayOfWeek = 'sunday', clockFormat = '12h', onNameChange, onDateChange, onTimeChange, onLocationChange, onTagsChange, onServiceChange }) {
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    const value = tagInput.trim().slice(0, 10);
    if (!value) return;
    if (tags.length >= MAX_TAGS) return;
    if (tags.some(t => t.toLowerCase() === value.toLowerCase())) return;
    onTagsChange([...tags, value]);
    setTagInput('');
  };

  const removeTag = (idx) => {
    onTagsChange(tags.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e) => {
    // Both Enter and Space commit the current draft tag — space lets people
    // type "fast slow loud" and get three tags without ever lifting their
    // hand off the keyboard.
    if (e.key === 'Enter' || e.key === ' ') {
      if (!tagInput.trim()) return;
      e.preventDefault();
      addTag();
    }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="text-label-12 font-semibold text-[var(--ds-gray-600)] px-0.5">Setlist Title</label>
        <Input
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="e.g. Sunday Morning Service"
        />
      </div>

      {/* Date & Time */}
      <div className="flex gap-4">
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-label-12 font-semibold text-[var(--ds-gray-600)] px-0.5">Date</label>
          <DatePicker
            value={date}
            onChange={onDateChange}
            firstDayOfWeek={firstDayOfWeek}
          />
        </div>
        <div className="w-40 flex flex-col gap-1">
          <label className="text-label-12 font-semibold text-[var(--ds-gray-600)] px-0.5">Time</label>
          <TimePicker
            value={time}
            onChange={onTimeChange}
            clockFormat={clockFormat}
          />
        </div>
      </div>

      {/* Location */}
      <div className="flex flex-col gap-1">
        <label className="text-label-12 font-semibold text-[var(--ds-gray-600)] px-0.5">Location</label>
        <Input
          value={location}
          onChange={e => onLocationChange(e.target.value)}
          placeholder="e.g. The Blue Note"
        />
      </div>

      {/* Service — Church tier only */}
      {useEntitlement('multi-service').allowed && onServiceChange && (
        <div className="flex flex-col gap-1">
          <label className="text-label-12 font-semibold text-[var(--ds-gray-600)] px-0.5">
            Service
            <span className="ml-1.5 text-label-11 font-normal px-1.5 py-0.5 rounded-md" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}>
              Church
            </span>
          </label>
          <ServiceField
            value={service}
            options={knownServices}
            onChange={onServiceChange}
          />
        </div>
      )}

      {/* Tags */}
      <div className="flex flex-col gap-1">
        <label className="text-label-12 font-semibold text-[var(--ds-gray-600)] px-0.5">
          Tags {tags.length > 0 && <span className="font-normal text-[var(--ds-gray-600)]">({tags.length}/{MAX_TAGS})</span>}
        </label>
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] min-h-[42px] focus-within:border-[var(--ds-gray-600)] transition-colors">
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--ds-gray-200)] text-label-12 text-[var(--ds-gray-1000)] select-none"
            >
              {tag}
              <span
                role="button"
                tabIndex={0}
                onClick={() => removeTag(idx)}
                onKeyDown={(e) => e.key === 'Enter' && removeTag(idx)}
                className="text-[var(--ds-gray-600)] hover:text-[var(--ds-error-600)] cursor-pointer text-[10px] leading-none ml-0.5"
              >
                ✕
              </span>
            </span>
          ))}
          {tags.length < MAX_TAGS && (
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value.slice(0, 10))}
              onKeyDown={handleKeyDown}
              onBlur={addTag}
              maxLength={10}
              placeholder={tags.length === 0 ? 'Type, then press space or Enter…' : ''}
              className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-copy-14 text-[var(--ds-gray-1000)] placeholder:text-[var(--ds-gray-600)]"
              style={{ minHeight: 'auto', padding: 0 }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
