import { useState } from 'react';
import { Input } from '../ui/Input';
import { DatePicker } from '../ui/DatePicker';
import { useEntitlement } from '../../hooks/useEntitlement';

const MAX_TAGS = 3;

/**
 * Setlist metadata form — name, date, freeform tags, and (Church tier only) service.
 */
export default function SetlistMetaForm({ name, date, time = '20:00', location = '', tags, service = '', firstDayOfWeek = 'sunday', onNameChange, onDateChange, onTimeChange, onLocationChange, onTagsChange, onServiceChange }) {
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
        <label className="section-title px-0.5">Setlist Title</label>
        <Input
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="e.g. Sunday Morning Service"
        />
      </div>

      {/* Date & Time */}
      <div className="flex gap-4">
        <div className="flex-1 flex flex-col gap-1">
          <label className="section-title px-0.5">Date</label>
          <DatePicker
            value={date}
            onChange={onDateChange}
            firstDayOfWeek={firstDayOfWeek}
          />
        </div>
        <div className="w-32 flex flex-col gap-1">
          <label className="section-title px-0.5">Time</label>
          <Input
            type="time"
            value={time}
            onChange={e => onTimeChange(e.target.value)}
          />
        </div>
      </div>

      {/* Location */}
      <div className="flex flex-col gap-1">
        <label className="section-title px-0.5">Location</label>
        <Input
          value={location}
          onChange={e => onLocationChange(e.target.value)}
          placeholder="e.g. The Blue Note"
        />
      </div>

      {/* Service — Church tier only */}
      {useEntitlement('multi-service').allowed && onServiceChange && (
        <div className="flex flex-col gap-1">
          <label className="section-title px-0.5">
            Service
            <span className="ml-1.5 text-label-11 font-normal uppercase tracking-wider px-1.5 py-0.5 rounded-md" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand)' }}>
              Church
            </span>
          </label>
          <Input
            value={service}
            onChange={e => onServiceChange(e.target.value)}
            placeholder="e.g. 9am Traditional, 11am Contemporary"
          />
        </div>
      )}

      {/* Tags */}
      <div className="flex flex-col gap-1">
        <label className="section-title px-0.5">
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
