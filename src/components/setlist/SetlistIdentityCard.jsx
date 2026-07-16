import { SegmentedControl } from '../ui/SegmentedControl';
import { Button } from '../ui/Button';
import SetlistMetaForm from './SetlistMetaForm';

/**
 * Identity card for the card-language setlist editor — an inline-editable title
 * with the Draft/Ready toggle (and, on desktop, Save/Cancel) in its header,
 * over the full metadata form plus a setlist-level note.
 */
export default function SetlistIdentityCard({
  name, date, time, endTime, location, tags, service,
  rehearsalDate, rehearsalTime, rehearsalLocation, notes, status,
  knownServices, firstDayOfWeek, clockFormat,
  onNameChange, onDateChange, onTimeChange, onEndTimeChange, onLocationChange,
  onTagsChange, onServiceChange, onRehearsalDateChange, onRehearsalTimeChange,
  onRehearsalLocationChange, onNotesChange, onStatusChange,
  onSave, onCancel,
}) {
  return (
    <div
      className="rounded-2xl border border-[var(--border-1)] p-4 sm:p-5 flex flex-col gap-4"
      style={{ background: 'linear-gradient(180deg, var(--ds-background-100), var(--ds-background-200))' }}
    >
      {/* Header: title + status + (desktop) Save/Cancel */}
      <div className="flex items-start gap-3">
        <input
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Untitled setlist"
          aria-label="Setlist name"
          maxLength={120}
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-heading-24 font-semibold text-[var(--text-1)] placeholder:text-[var(--ds-gray-500)] focus:bg-[var(--ds-gray-100)] rounded px-1 -mx-1"
        />
        <div className="flex items-center gap-2 shrink-0">
          <SegmentedControl
            value={status}
            onChange={onStatusChange}
            size="sm"
            options={[{ value: 'draft', label: 'Draft' }, { value: 'ready', label: 'Ready' }]}
          />
          {onCancel && <Button variant="ghost" size="sm" className="hidden lg:inline-flex" onClick={onCancel}>Cancel</Button>}
          {onSave && <Button variant="brand" size="sm" className="hidden lg:inline-flex" onClick={onSave}>Save</Button>}
        </div>
      </div>

      <SetlistMetaForm
        name={name}
        date={date}
        time={time}
        endTime={endTime}
        location={location}
        tags={tags}
        service={service}
        rehearsalDate={rehearsalDate}
        rehearsalTime={rehearsalTime}
        rehearsalLocation={rehearsalLocation}
        firstDayOfWeek={firstDayOfWeek}
        clockFormat={clockFormat}
        hideTitle
        onNameChange={onNameChange}
        onDateChange={onDateChange}
        onTimeChange={onTimeChange}
        onEndTimeChange={onEndTimeChange}
        onLocationChange={onLocationChange}
        onTagsChange={onTagsChange}
        onServiceChange={onServiceChange}
        onRehearsalDateChange={onRehearsalDateChange}
        onRehearsalTimeChange={onRehearsalTimeChange}
        onRehearsalLocationChange={onRehearsalLocationChange}
        knownServices={knownServices}
      />

      {/* Setlist-level note — one shared note for the whole set. */}
      <div className="flex flex-col gap-1">
        <label className="text-label-12 font-semibold text-[var(--ds-gray-600)] px-0.5">Setlist note</label>
        <textarea
          value={notes || ''}
          onChange={e => onNotesChange(e.target.value)}
          placeholder="Notes for the whole set — e.g. capo 2 on the acoustic, confirm keys by Friday…"
          rows={2}
          className="w-full px-3 py-2 rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] text-copy-14 text-[var(--ds-gray-1000)] outline-none focus:border-[var(--ds-gray-600)] resize-y placeholder:text-[var(--ds-gray-500)]"
        />
      </div>
    </div>
  );
}
