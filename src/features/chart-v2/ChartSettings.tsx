import { useState, type ReactNode } from 'react';
import { Minus, Plus, SlidersHorizontal } from 'lucide-react';
import { Panel } from './Panel';
import { Segmented, Switch } from './ui';
import type { ChartDisplay } from './display';
import type { RibbonPosition, RibbonStyle } from './StructureRow';
import type { ChartMode } from './types';

interface Props {
  display: ChartDisplay;
  style: RibbonStyle;
  position: RibbonPosition;
  setlistBar: boolean;
  mode: ChartMode;
  /** Shown only where two columns can fit. */
  columns?: 1 | 2;
  onSetting: (key: string, value: unknown) => void;
  onMode: (mode: ChartMode) => void;
}

// A few colours that read on both themes; "Theme" follows light/dark.
const SWATCHES = ['', '#FFFFFF', '#E9BE6E', '#F2A65A', '#8FC1E3', '#F0A39B'];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-label text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-body">{label}</span>
      {children}
    </div>
  );
}

function Size({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  const btn = 'flex size-9 min-h-0 items-center justify-center rounded-control hover:bg-card disabled:opacity-40';
  return (
    <div className="inline-flex h-10 items-center gap-1 rounded-control bg-raised p-0.5">
      <button type="button" aria-label={`Smaller ${label}`} className={btn} disabled={value <= min} onClick={() => onChange(value - 1)}><Minus size={16} strokeWidth={1.8} /></button>
      <span className="min-w-8 text-center text-small font-semibold tabular-nums">{value}</span>
      <button type="button" aria-label={`Bigger ${label}`} className={btn} disabled={value >= max} onClick={() => onChange(value + 1)}><Plus size={16} strokeWidth={1.8} /></button>
    </div>
  );
}

function Swatches({ value, onPick, label }: { value: string; onPick: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1.5">
      {SWATCHES.map(c => {
        const on = (value || '') === c;
        return (
          <button
            key={c || 'theme'} type="button" role="radio" aria-checked={on} aria-label={c || 'Theme colour'}
            onClick={() => onPick(c)}
            className={`size-8 min-h-0 rounded-full border ${on ? 'ring-2 ring-link ring-offset-2 ring-offset-background' : ''} border-border`}
            style={{ background: c || 'conic-gradient(var(--foreground) 0 50%, var(--background) 0)' }}
          />
        );
      })}
    </div>
  );
}

/**
 * One button for everything about how the chart looks (☰, Aa and the old
 * settings button in one, owner's question 6, pending). A sheet on a phone, a
 * dialog from the iPad up. Today's Aa had about 25 options; this keeps the
 * ones people change. "Preview" is for testing only.
 */
export function ChartSettings({ display: d, style, position, setlistBar, mode, columns, onSetting, onMode }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Chart settings"
        onClick={() => setOpen(true)}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-raised hover:text-foreground"
      >
        <SlidersHorizontal size={20} strokeWidth={1.8} />
      </button>
      <Panel open={open} onOpenChange={setOpen} title="Chart">
        <div className="flex flex-col gap-5">
          <Group title="Text">
            <Line label="Lyrics"><Size label="lyrics" value={d.lyricPx} min={12} max={40} onChange={v => onSetting('defaultFontSize', v)} /></Line>
            <Swatches label="Lyric colour" value={d.lyricColor} onPick={v => onSetting('chartLyricColor', v || undefined)} />
            <Line label="Chords"><Size label="chords" value={d.chordPx} min={10} max={40} onChange={v => onSetting('chordFontSize', v)} /></Line>
            <Swatches label="Chord colour" value={d.chordColor} onPick={v => onSetting('chartChordColor', v || undefined)} />
          </Group>
          <Group title="Chords">
            <Segmented label="What the chart shows" size="sm" fill value={d.showChords ? 'chords' : 'lyrics'}
              options={[{ value: 'chords', label: 'Chords and lyrics' }, { value: 'lyrics', label: 'Lyrics only' }]}
              onChange={v => onSetting('displayMode', v)} />
            <Segmented label="Chord names" size="sm" fill value={d.notation}
              options={[{ value: 'letters', label: 'Letters' }, { value: 'nashville', label: 'Numbers' }, { value: 'roman', label: 'Numerals' }, { value: 'solfege', label: 'Do Re Mi' }]}
              onChange={v => onSetting('notation', v)} />
            <Segmented label="Sharps or flats" size="sm" fill value={d.accidentals}
              options={[{ value: 'auto', label: 'As written' }, { value: 'sharps', label: 'Sharps' }, { value: 'flats', label: 'Flats' }]}
              onChange={v => onSetting('accidentals', v)} />
          </Group>
          <Group title="Notes">
            <Line label="Band cues"><Switch label="Band cues" checked={d.showCues} onCheckedChange={on => onSetting('readerNotes', on ? 'on' : 'off')} /></Line>
            <Line label="Notes in the lyrics"><Switch label="Notes in the lyrics" checked={d.showInlineNotes} onCheckedChange={on => onSetting('readerInlineNotes', on ? 'on' : 'off')} /></Line>
          </Group>
          <Group title="Layout">
            <Segmented label="Structure style" size="sm" fill value={style}
              options={[{ value: 'codes', label: 'Boxes' }, { value: 'chips', label: 'Chips' }, { value: 'dots', label: 'Dots' }]}
              onChange={v => onSetting('ribbonStyle', v)} />
            <Segmented label="Structure position" size="sm" fill value={position}
              options={[{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'off', label: 'Off' }]}
              onChange={v => onSetting('structurePosition', v)} />
            <Line label="Setlist bar"><Switch label="Setlist bar" checked={setlistBar} onCheckedChange={on => onSetting('readerTopBar', on ? 'setlist' : 'ribbon')} /></Line>
            {columns && (
              <Segmented label="Columns" size="sm" fill value={String(columns)}
                options={[{ value: '1', label: 'One column' }, { value: '2', label: 'Two columns' }]}
                onChange={v => onSetting('defaultColumns', Number(v))} />
            )}
          </Group>
          <Group title="Preview (testing only)">
            <Segmented label="Preview mode" size="sm" fill value={mode}
              options={[{ value: 'practice', label: 'Practice' }, { value: 'live', label: 'Live' }]}
              onChange={v => onMode(v as ChartMode)} />
          </Group>
        </div>
      </Panel>
    </>
  );
}
