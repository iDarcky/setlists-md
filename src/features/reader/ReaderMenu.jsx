import { useState } from 'react';
import { CHART_THEMES } from '@/data/chartThemes';
import { READER_KNOBS, readerSettingKey } from '@/lib/readerConfig';

/**
 * The reader's display menu.
 *
 * Built to one rule, learned from why the Aa popover felt better than the
 * sheet that replaced it: **the panel must never cover what it changes.**
 * A full-height sheet of stacked rows means every adjustment is blind — you
 * change a thing, close the sheet, look, open it again. So this is a short
 * panel pinned under the top bar with icon tabs, showing one small group at a
 * time, with the chart live underneath.
 */

const TABS = [
  { id: 'text', label: 'Text', icon: 'Aa' },
  { id: 'layout', label: 'Layout', icon: '▤' },
  { id: 'sections', label: 'Sections', icon: '❑' },
  { id: 'theme', label: 'Theme', icon: '◐' },
];

const NOTATIONS = [
  { id: 'letters', label: 'ABC' },
  { id: 'nashville', label: '1-4-5' },
  { id: 'solfege', label: 'Do-Re' },
];

function Row({ label, children }) {
  return (
    <div className="flex items-center gap-3 py-1.5 min-h-[2rem]">
      <span className="text-label-11 text-[var(--chart-subtle,var(--ds-gray-700))] w-[5.5rem] shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1 flex-wrap min-w-0">{children}</div>
    </div>
  );
}

function Opt({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className="px-2.5 h-7 rounded-lg text-label-12 font-semibold cursor-pointer border transition-colors"
      style={{
        borderColor: active ? 'var(--chord)' : 'var(--chart-rule, var(--ds-gray-300))',
        color: active ? 'var(--chord)' : 'var(--chart-text, var(--ds-gray-1000))',
        background: active ? 'color-mix(in srgb, var(--chord) 14%, transparent)' : 'transparent',
      }}
    >
      {children}
    </button>
  );
}

function Stepper({ label, value, onChange, min, max }) {
  return (
    <div className="inline-flex items-center gap-1">
      <Opt onClick={() => onChange(Math.max(min, value - 1))} title={`Smaller ${label}`}>−</Opt>
      <span className="text-label-12 font-mono font-semibold tabular-nums w-9 text-center">{value}</span>
      <Opt onClick={() => onChange(Math.min(max, value + 1))} title={`Larger ${label}`}>+</Opt>
    </div>
  );
}

export default function ReaderMenu({ open, onClose, config, settings, onUpdateSettings }) {
  const [tab, setTab] = useState('text');
  if (!open) return null;

  const set = (k, v) => onUpdateSettings?.(k, v);
  const setKnob = (knob, v) => set(readerSettingKey(knob), v);
  const has = (knob, v) => READER_KNOBS[knob].includes(v);

  return (
    <div
      className="shrink-0 border-b"
      style={{
        borderColor: 'var(--chart-rule, var(--ds-gray-300))',
        background: 'var(--chart-bg, var(--ds-background-100))',
        color: 'var(--chart-text, var(--ds-gray-1000))',
      }}
    >
      <div className="flex items-center gap-1 px-2.5 pt-2">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className="flex-1 h-8 rounded-lg text-label-11 font-semibold cursor-pointer border-none transition-colors inline-flex items-center justify-center gap-1.5"
            style={{
              color: tab === t.id ? 'var(--chord)' : 'var(--chart-subtle, var(--ds-gray-700))',
              background: tab === t.id ? 'color-mix(in srgb, var(--chord) 14%, transparent)' : 'transparent',
            }}
          >
            <span aria-hidden="true">{t.icon}</span>{t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close display menu"
          className="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer shrink-0"
          style={{ color: 'var(--chart-subtle, var(--ds-gray-700))' }}
        >
          ✕
        </button>
      </div>

      <div className="px-3 pb-2.5 pt-0.5">
        {tab === 'text' && (
          <>
            <Row label="Lyrics">
              <Stepper label="lyrics" value={config.display.lyricFontSize} min={10} max={40}
                onChange={v => set('defaultFontSize', v)} />
            </Row>
            <Row label="Chords">
              <Stepper label="chords" value={config.display.chordFontSize} min={8} max={40}
                onChange={v => set('chordFontSize', v)} />
            </Row>
            <Row label="Chord names">
              {NOTATIONS.map(n => (
                <Opt key={n.id} active={config.display.notation === n.id}
                  onClick={() => set('notation', n.id)} title={n.id}>{n.label}</Opt>
              ))}
            </Row>
          </>
        )}

        {tab === 'layout' && (
          <>
            <Row label="Columns">
              {[1, 2].map(c => (
                <Opt key={c} active={config.columns === c} onClick={() => set('defaultColumns', c)}>{c}</Opt>
              ))}
            </Row>
            <Row label="Top bar">
              {[['min', 'Minimal'], ['std', 'Normal'], ['full', 'Full']].map(([v, l]) => (
                <Opt key={v} active={config.header === v} onClick={() => setKnob('header', v)}>{l}</Opt>
              ))}
            </Row>
            <Row label="Structure">
              {[['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right'], ['off', 'Hide']]
                .filter(([v]) => has('ribbon', v))
                .map(([v, l]) => (
                  <Opt key={v} active={config.ribbon === v} onClick={() => setKnob('ribbon', v)}>{l}</Opt>
                ))}
            </Row>
            <Row label="Notes">
              {[['on', 'Show'], ['off', 'Hide']].map(([v, l]) => (
                <Opt key={v} active={config.notes === (v === 'on')} onClick={() => setKnob('notes', v)}>{l}</Opt>
              ))}
            </Row>
          </>
        )}

        {tab === 'sections' && (
          <>
            <Row label="Style">
              {[['bar', 'Bar'], ['block', 'Block'], ['card', 'Card'], ['mono', 'Grey']].map(([v, l]) => (
                <Opt key={v} active={config.sectionStyle === v} onClick={() => setKnob('sectionStyle', v)}>{l}</Opt>
              ))}
            </Row>
            <Row label="Heading">
              {[['name', 'Chorus'], ['code', 'C2']].map(([v, l]) => (
                <Opt key={v} active={config.heading === v} onClick={() => setKnob('heading', v)}>{l}</Opt>
              ))}
            </Row>
            <Row label="Pin heading">
              {[['on', 'Yes'], ['off', 'No']].map(([v, l]) => (
                <Opt key={v} active={config.sticky === (v === 'on')} onClick={() => setKnob('sticky', v)}>{l}</Opt>
              ))}
            </Row>
            <Row label="Repeats">
              {[['full', 'In full'], ['ref', 'As before'], ['condensed', 'Condensed']].map(([v, l]) => (
                <Opt key={v} active={config.repeats === v} onClick={() => setKnob('repeats', v)}>{l}</Opt>
              ))}
            </Row>
          </>
        )}

        {tab === 'theme' && (
          <div className="flex gap-1.5 flex-wrap py-1.5">
            {CHART_THEMES.map(t => {
              const active = (settings?.chartTheme || 'sunday-light') === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => set('chartTheme', t.id)}
                  aria-pressed={active}
                  title={t.name}
                  className="rounded-lg overflow-hidden border cursor-pointer p-0"
                  style={{ borderColor: active ? 'var(--chord)' : 'var(--chart-rule, var(--ds-gray-300))', borderWidth: active ? 2 : 1 }}
                >
                  <span className="flex items-center justify-center w-14 h-8" style={{ background: t.bg, color: t.chord }}>
                    <span className="text-label-11 font-bold">Am</span>
                  </span>
                  <span className="block px-1 py-0.5 text-[10px] leading-tight truncate max-w-[3.5rem]"
                    style={{ color: 'var(--chart-subtle, var(--ds-gray-700))' }}>{t.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
