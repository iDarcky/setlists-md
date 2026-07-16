import { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { DatePicker } from '../ui/DatePicker';
import { TimePicker } from '../ui/TimePicker';
import { useEntitlement } from '../../hooks/useEntitlement';

const MAX_TAGS = 3;

// Colour-coded Draft/Ready toggle — the active side lights up (amber for Draft,
// brand-green for Ready) so the status reads at a glance.
function StatusToggle({ status, onChange }) {
  const opts = [
    { value: 'draft', label: 'Draft', activeBg: 'var(--ds-amber-100)', activeText: 'var(--ds-amber-900)' },
    { value: 'ready', label: 'Ready', activeBg: 'var(--color-brand-soft)', activeText: 'var(--color-brand-text)' },
  ];
  return (
    <div className="inline-flex p-0.5 rounded-lg border border-[var(--border-1)] bg-[var(--ds-background-100)]" role="tablist" aria-label="Setlist status">
      {opts.map(o => {
        const active = status === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className="inline-flex items-center h-7 px-3 rounded-md text-label-12 font-semibold transition-colors cursor-pointer"
            style={active ? { background: o.activeBg, color: o.activeText } : { background: 'transparent', color: 'var(--ds-gray-600)' }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const FieldLabel = ({ children }) => (
  <span className="text-label-11 font-semibold text-[var(--ds-gray-600)] shrink-0">{children}</span>
);

// Opt these plain text fields out of password managers (Dashlane/1Password/
// LastPass) — they're setlist metadata, not credentials.
const NO_AUTOFILL = { autoComplete: 'off', 'data-1p-ignore': true, 'data-lpignore': 'true', 'data-form-type': 'other' };

/**
 * Identity card for the card-language setlist editor. Compact inline-label
 * fields keep Date · Start · End · Location on one line (wrapping gracefully,
 * always aligned), with Rehearsal, then Tags + Notes below. The Draft/Ready
 * toggle sits in the header; Save/Cancel live in the sticky bottom bar.
 */
export default function SetlistIdentityCard({
  name, date, time, endTime, location, tags, service,
  rehearsalDate, rehearsalTime, rehearsalLocation, notes, status,
  knownServices = [], firstDayOfWeek, clockFormat,
  onNameChange, onDateChange, onTimeChange, onEndTimeChange, onLocationChange,
  onTagsChange, onServiceChange, onRehearsalDateChange, onRehearsalTimeChange,
  onRehearsalLocationChange, onNotesChange, onStatusChange,
}) {
  const [tagInput, setTagInput] = useState('');
  const canService = useEntitlement('multi-service').allowed && onServiceChange;

  const addTag = () => {
    const value = tagInput.trim().slice(0, 10);
    if (!value || tags.length >= MAX_TAGS || tags.some(t => t.toLowerCase() === value.toLowerCase())) { setTagInput(''); return; }
    onTagsChange([...tags, value]);
    setTagInput('');
  };
  const removeTag = (idx) => onTagsChange(tags.filter((_, i) => i !== idx));
  const onTagKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { if (!tagInput.trim()) return; e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) removeTag(tags.length - 1);
  };

  return (
    <div
      className="rounded-2xl border border-[var(--border-1)] p-4 sm:p-5 flex flex-col gap-4"
      style={{ background: 'linear-gradient(180deg, var(--ds-background-100), var(--ds-background-200))' }}
    >
      {/* Header: title + status */}
      <div className="flex items-start gap-3">
        <input
          {...NO_AUTOFILL}
          name="setlist-title"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Untitled setlist"
          aria-label="Setlist title"
          maxLength={50}
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-heading-24 font-semibold text-[var(--text-1)] placeholder:text-[var(--ds-gray-500)] focus:bg-[var(--ds-gray-100)] rounded px-1 -mx-1"
        />
        <StatusToggle status={status} onChange={onStatusChange} />
      </div>

      {/* Row: Date · Start · End · Location — inline labels keep them aligned. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <div className="flex items-center gap-2">
          <FieldLabel>Date</FieldLabel>
          <DatePicker value={date} onChange={onDateChange} firstDayOfWeek={firstDayOfWeek} className="w-[172px]" />
        </div>
        <div className="flex items-center gap-2">
          <FieldLabel>Start</FieldLabel>
          <TimePicker value={time} onChange={onTimeChange} clockFormat={clockFormat} className="w-[118px]" />
        </div>
        {endTime ? (
          <div className="flex items-center gap-2">
            <FieldLabel>End</FieldLabel>
            <TimePicker value={endTime} onChange={onEndTimeChange} clockFormat={clockFormat} className="w-[118px]" />
            <button type="button" onClick={() => onEndTimeChange?.('')} className="text-label-11 text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-900)] cursor-pointer" aria-label="Clear end time">clear</button>
          </div>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => onEndTimeChange?.('12:00')} className="text-[var(--ds-gray-700)]">+ End time</Button>
        )}
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <FieldLabel>Location</FieldLabel>
          <Input {...NO_AUTOFILL} value={location} onChange={e => onLocationChange(e.target.value)} placeholder="e.g. The Blue Note" maxLength={120} className="flex-1" />
        </div>
      </div>

      {/* Row: Rehearsal (+ optional Service pill) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <FieldLabel>Rehearsal</FieldLabel>
          {rehearsalDate ? (
            <>
              <DatePicker value={rehearsalDate} onChange={onRehearsalDateChange} firstDayOfWeek={firstDayOfWeek} className="w-[172px]" />
              <TimePicker value={rehearsalTime || '19:00'} onChange={onRehearsalTimeChange} clockFormat={clockFormat} className="w-[118px]" />
              <Input {...NO_AUTOFILL} value={rehearsalLocation || ''} onChange={e => onRehearsalLocationChange?.(e.target.value)} placeholder="Location (if different)" maxLength={120} className="w-[200px]" />
              <button type="button" onClick={() => onRehearsalDateChange('')} className="text-label-11 text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-900)] cursor-pointer" aria-label="Remove rehearsal">clear</button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => onRehearsalDateChange(date || new Date().toISOString().slice(0, 10))} className="text-[var(--ds-gray-700)]">+ Add rehearsal</Button>
          )}
        </div>
        {canService && (
          <div className="flex items-center gap-2">
            <FieldLabel>Service</FieldLabel>
            <Input {...NO_AUTOFILL} value={service} onChange={e => onServiceChange(e.target.value)} placeholder="Service" maxLength={40} className="w-[160px]" list="known-services" />
            <datalist id="known-services">{knownServices.map(s => <option key={s} value={s} />)}</datalist>
          </div>
        )}
      </div>

      {/* Row: Tags + Notes side by side */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex flex-col gap-1">
          <FieldLabel>Tags {tags.length > 0 && <span className="font-normal">({tags.length}/{MAX_TAGS})</span>}</FieldLabel>
          <div className="flex flex-wrap items-center gap-1.5 px-3 min-h-[42px] rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] focus-within:border-[var(--ds-gray-600)]">
            {tags.map((tag, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--ds-gray-200)] text-label-12 text-[var(--ds-gray-1000)]">
                {tag}
                <span role="button" tabIndex={0} onClick={() => removeTag(idx)} onKeyDown={e => e.key === 'Enter' && removeTag(idx)} className="text-[var(--ds-gray-600)] hover:text-[var(--ds-error-600)] cursor-pointer text-[10px] leading-none">✕</span>
              </span>
            ))}
            {tags.length < MAX_TAGS && (
              <input {...NO_AUTOFILL} name="setlist-tag" value={tagInput} onChange={e => setTagInput(e.target.value.slice(0, 10))} onKeyDown={onTagKey} onBlur={addTag} maxLength={10} placeholder={tags.length === 0 ? 'Type, then Enter…' : ''} className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-copy-14 text-[var(--ds-gray-1000)] placeholder:text-[var(--ds-gray-600)] py-1" />
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <FieldLabel>Setlist note</FieldLabel>
          <textarea
            {...NO_AUTOFILL}
            value={notes || ''}
            onChange={e => onNotesChange(e.target.value.slice(0, 500))}
            maxLength={500}
            placeholder="One note for the whole set — e.g. capo 2 on the acoustic, confirm keys by Friday…"
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] text-copy-14 text-[var(--ds-gray-1000)] outline-none focus:border-[var(--ds-gray-600)] resize-y placeholder:text-[var(--ds-gray-500)]"
          />
        </div>
      </div>
    </div>
  );
}
