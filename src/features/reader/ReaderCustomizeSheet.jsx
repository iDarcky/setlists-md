import BottomSheet, { SheetField } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { READER_PRESETS, READER_KNOBS } from '@/lib/readerConfig';

// Every knob the reader exposes, with human labels. The deal with this panel:
// *everything* is customizable and *none* of it lives in the header — the
// header was the thing that felt cluttered, and options are what clutter it.
const GROUPS = [
  {
    label: 'Header', knob: 'headerDensity',
    options: [['min', 'Minimal'], ['std', 'Standard'], ['full', 'Full']],
  },
  {
    label: 'Structure ribbon', knob: 'structurePosition',
    options: [['top', 'Top'], ['left', 'Left'], ['right', 'Right'], ['bottom', 'Bottom'], ['off', 'Hidden']],
  },
  {
    label: 'Section style', knob: 'sectionStyle',
    options: [['bar', 'Left bar'], ['block', 'Colour block'], ['card', 'Card'], ['mono', 'Grayscale']],
  },
  {
    label: 'Columns', knob: 'columnFlow',
    options: [['section', 'Keep sections whole'], ['balanced', 'Balanced']],
  },
  {
    label: 'Section heading', knob: 'headingStyle',
    options: [['name', 'Chorus'], ['code', 'C2']],
  },
  {
    label: 'Notes', knob: 'notePosition',
    options: [['margin', 'Right margin'], ['inline', 'In the chart'], ['peek', 'Peek only']],
  },
  {
    label: 'Repeated sections', knob: 'duplicateSections',
    options: [['full', 'Show in full'], ['ref', 'Reference'], ['cond', 'Condensed']],
  },
  {
    label: 'Exit', knob: 'exitStyle',
    options: [['both', '✕ and pull'], ['x', '✕ only'], ['pull', 'Pull down only']],
  },
];

// `duplicateSections` stores 'condensed', but the button reads better as
// "Condensed" under a short key — map the two.
const VALUE_ALIAS = { cond: 'condensed' };
const toStored = v => VALUE_ALIAS[v] || v;

export default function ReaderCustomizeSheet({
  open, onClose, config, preset, onPresetChange, onKnobChange, onReset, narrow,
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Customize">
      <div className="flex flex-col gap-1">
        <SheetField label="Preset">
          <div className="flex gap-1.5 flex-wrap">
            {READER_PRESETS.map(p => (
              <Button
                key={p.id}
                size="sm"
                variant={preset === p.id ? 'brand' : 'secondary'}
                onClick={() => onPresetChange(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </SheetField>

        <p className="m-0 px-1 pb-2 text-copy-12 text-[var(--ds-gray-700)]">
          {READER_PRESETS.find(p => p.id === preset)?.blurb}
          {' '}Changes below are saved to this preset only.
        </p>

        {GROUPS.map(g => {
          const allowed = READER_KNOBS[g.knob];
          return (
            <SheetField key={g.knob} label={g.label}>
              <div className="flex gap-1.5 flex-wrap">
                {g.options.map(([v, label]) => {
                  const stored = toStored(v);
                  if (allowed && !allowed.includes(stored)) return null;
                  const active = config[g.knob] === stored;
                  return (
                    <Button
                      key={v}
                      size="sm"
                      variant={active ? 'brand' : 'secondary'}
                      onClick={() => onKnobChange(g.knob, stored)}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            </SheetField>
          );
        })}

        {narrow && (
          <p className="m-0 px-1 py-2 text-copy-12 text-[var(--ds-gray-700)]">
            On a narrow screen the note margin and a side ribbon have nowhere to
            go, so they fall back to the chart and the top. Your choice is kept
            for when there is room.
          </p>
        )}

        <div className="pt-2">
          <Button size="sm" variant="ghost" onClick={onReset}>
            Reset this preset
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
