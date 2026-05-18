import React, { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/Select';
import { useConfirm } from '../ui/useConfirmHook';
import UpgradeGate from '../ui/UpgradeGate';
import {
  CHART_THEMES,
  CHART_FONTS,
  CHART_FONT_MAP,
  CHART_THEME_MAP,
  DEFAULT_CHART_THEME_ID,
  DEFAULT_CHORD_FONT_ID,
  DEFAULT_LYRIC_FONT_ID,
  chartTheme,
} from '../../data/chartThemes';

// Cap on how many user-defined themes can exist. Keeps the picker grid
// readable and the synced preferences payload bounded.
const MAX_CUSTOM_THEMES = 4;

// Settings → Chart Style. Gated to paid plans via UpgradeGate. Lets the
// user pick one of the 8 curated themes, override the three key colours
// (background, text, chord) via a real colour wheel, and choose distinct
// fonts for chords vs lyrics from the curated 12-font library.

function ThemeSwatch({ theme, active, onSelect, onDelete }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onSelect(theme.id)}
        className="w-full group flex flex-col items-stretch text-left rounded-xl overflow-hidden border transition-all"
        style={{
          borderColor: active ? 'var(--color-brand)' : 'var(--modes-border)',
          boxShadow: active ? '0 0 0 2px var(--color-brand)' : 'none',
        }}
      >
        <div
          className="h-16 flex items-end justify-end p-2"
          style={{ background: theme.bg, color: theme.chord, fontFamily: 'var(--font-mono)' }}
        >
          <span className="text-label-12 font-bold">Am  G/B</span>
        </div>
        <div className="px-3 py-2 flex flex-col gap-0.5" style={{ background: 'var(--modes-surface)' }}>
          <div className="text-copy-13 font-semibold text-[var(--modes-text)]">{theme.name}</div>
          <div className="text-label-11 text-[var(--modes-text-muted)] truncate">{theme.description || (onDelete ? 'Custom theme' : '')}</div>
        </div>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(theme.id); }}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 hover:bg-black/70 text-white text-label-12 flex items-center justify-center"
          aria-label={`Delete theme ${theme.name}`}
        >
          ×
        </button>
      )}
    </div>
  );
}

function ColorWheelRow({ label, description, value, onChange, onReset, preset, open, onOpenChange }) {
  const showReset = value && value !== preset;
  const current = value || preset;

  return (
    <div className="py-3 border-b border-[var(--modes-border)] last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-copy-14 text-[var(--modes-text)] font-medium">{label}</span>
          <span className="text-label-12 text-[var(--modes-text-muted)]">{description}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showReset && (
            <Button size="sm" variant="ghost" onClick={onReset}>Reset</Button>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(open ? null : label)}
            className="h-9 w-14 rounded-lg border transition-all"
            style={{ background: current, borderColor: open ? 'var(--color-brand)' : 'var(--modes-border)' }}
            aria-label={`Pick ${label.toLowerCase()} colour`}
          />
        </div>
      </div>
      {open && (
        <div className="mt-3 flex flex-col gap-2 items-end">
          <HexColorPicker color={current} onChange={onChange} style={{ width: '100%', height: 180 }} />
          <div className="flex items-center gap-2 self-stretch">
            <span className="text-label-11 text-[var(--modes-text-muted)] uppercase tracking-wider">Hex</span>
            <input
              type="text"
              value={current}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (/^#?[0-9a-fA-F]{6}$/.test(v)) onChange(v.startsWith('#') ? v : `#${v}`);
              }}
              className="flex-1 h-8 px-2 rounded-md bg-[var(--modes-surface-strong)] text-copy-13 text-[var(--modes-text)] border border-[var(--modes-border)] font-mono"
            />
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(null)}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SpacingRow({ label, description, value, min, max, step, format, onChange, onReset, defaultValue }) {
  const showReset = value !== defaultValue;
  const dec = () => onChange(Math.max(min, +(value - step).toFixed(2)));
  const inc = () => onChange(Math.min(max, +(value + step).toFixed(2)));
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-copy-14 text-[var(--modes-text)] font-medium">{label}</span>
        <span className="text-label-12 text-[var(--modes-text-muted)]">{description}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {showReset && (
          <Button size="sm" variant="ghost" onClick={onReset}>Reset</Button>
        )}
        <div className="flex items-center bg-[var(--modes-surface-strong)] border border-[var(--modes-border)] rounded-lg p-0.5">
          <button
            type="button"
            onClick={dec}
            disabled={value <= min}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--modes-text)] hover:bg-[var(--modes-surface)] disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Decrease ${label.toLowerCase()}`}
          >
            −
          </button>
          <span className="w-12 text-center text-label-12-mono text-[var(--modes-text)] font-semibold tabular-nums">
            {format(value)}
          </span>
          <button
            type="button"
            onClick={inc}
            disabled={value >= max}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--modes-text)] hover:bg-[var(--modes-surface)] disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Increase ${label.toLowerCase()}`}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function FontPickerRow({ label, value, onChange, defaultId }) {
  const activeId = value || defaultId;
  const activeFont = CHART_FONT_MAP[activeId] || CHART_FONT_MAP[defaultId];
  const isChord = label.toLowerCase().includes('chord');
  const sampleText = isChord ? 'Am  G/B  C  D7sus4' : 'Amazing grace, how sweet the sound';

  return (
    <div className="flex flex-col gap-2 py-3 border-b border-[var(--modes-border)] last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-copy-14 text-[var(--modes-text)] font-medium">{label}</span>
        <Select value={activeId} onValueChange={onChange}>
          <SelectTrigger className="h-9 px-3 text-label-13 font-medium gap-1 min-w-[180px] w-auto">
            <SelectValue>
              <span style={{ fontFamily: activeFont?.stack }}>{activeFont?.name || 'System'}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {['system', 'sans', 'serif', 'mono'].map((group) => {
              const items = CHART_FONTS.filter(f => f.category === group);
              if (items.length === 0) return null;
              return items.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  <span style={{ fontFamily: f.stack }}>{f.name}</span>
                </SelectItem>
              ));
            })}
          </SelectContent>
        </Select>
      </div>
      <div
        className="px-3 py-2 rounded-md text-copy-15"
        style={{
          background: 'var(--modes-surface)',
          color: 'var(--modes-text)',
          fontFamily: activeFont?.stack,
        }}
      >
        {sampleText}
      </div>
    </div>
  );
}

export default function ChartStylePanel({ settings, update, onUpgrade }) {
  return (
    <UpgradeGate feature="chart-style" onUpgrade={onUpgrade}>
      <ChartStylePanelInner settings={settings} update={update} />
    </UpgradeGate>
  );
}

function ChartStylePanelInner({ settings, update }) {
  const activeThemeId = settings?.chartTheme || DEFAULT_CHART_THEME_ID;
  const customThemes = settings?.customChartThemes || [];
  const preset = chartTheme(activeThemeId, customThemes);
  const confirm = useConfirm();
  const [openPicker, setOpenPicker] = useState(null);
  const [savingName, setSavingName] = useState(null); // string when input shown, null when hidden

  // Built-in presets are read-only — to tweak colours, the user has to
  // duplicate the preset into a custom theme first.
  const isCustom = customThemes.some(t => t.id === activeThemeId);
  const activeCustom = isCustom ? customThemes.find(t => t.id === activeThemeId) : null;

  // Mutate a single field on the active custom theme.
  const patchActiveCustom = (patch) => {
    if (!activeCustom) return;
    update(
      'customChartThemes',
      customThemes.map(t => t.id === activeCustom.id ? { ...t, ...patch } : t),
    );
  };

  const atCustomThemeLimit = customThemes.length >= MAX_CUSTOM_THEMES;

  // Duplicate the currently-selected preset into a new custom theme and
  // switch to it so the colour rows start editing immediately. Both
  // writes go through a single update() call — back-to-back updates with
  // (key, value) each spread the stale settings prop and clobber each
  // other, which is why "+ New theme" appeared to do nothing before.
  const duplicateActiveTheme = () => {
    if (atCustomThemeLimit) return;
    const name = (savingName || preset.name + ' (custom)').trim();
    if (!name) return;
    const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const newTheme = {
      id,
      name,
      bg: preset.bg,
      text: preset.text,
      chord: preset.chord,
      subtle: preset.subtle,
    };
    update({
      customChartThemes: [...customThemes, newTheme],
      chartTheme: id,
    });
    setSavingName(null);
  };

  const deleteCustomTheme = async (id) => {
    const target = customThemes.find(t => t.id === id);
    const ok = await confirm({
      title: `Delete "${target?.name || 'theme'}"?`,
      description: 'This custom theme will be removed from this device and from your cloud preferences. Songs styled with it will revert to the default theme.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    const nextThemes = customThemes.filter(t => t.id !== id);
    if (activeThemeId === id) {
      update({ customChartThemes: nextThemes, chartTheme: DEFAULT_CHART_THEME_ID });
    } else {
      update('customChartThemes', nextThemes);
    }
  };

  const renameActiveCustom = (name) => patchActiveCustom({ name });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold">
            Theme
          </h3>
          <span className="text-label-11 text-[var(--modes-text-dim)]">
            {customThemes.length}/{MAX_CUSTOM_THEMES} custom
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {CHART_THEMES.map(t => (
            <ThemeSwatch
              key={t.id}
              theme={t}
              active={activeThemeId === t.id}
              onSelect={(id) => update('chartTheme', id)}
            />
          ))}
          {customThemes.map(t => (
            <ThemeSwatch
              key={t.id}
              theme={t}
              active={activeThemeId === t.id}
              onSelect={(id) => update('chartTheme', id)}
              onDelete={deleteCustomTheme}
            />
          ))}
        </div>
        {savingName == null ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSavingName(`${preset.name} (custom)`)}
            disabled={atCustomThemeLimit}
            className="self-start"
          >
            {atCustomThemeLimit
              ? `Custom theme limit reached (${MAX_CUSTOM_THEMES})`
              : '+ New theme'}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input
              autoFocus
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              placeholder="Theme name"
              className="flex-1 h-9 px-3 text-copy-13"
              onKeyDown={(e) => { if (e.key === 'Enter') duplicateActiveTheme(); if (e.key === 'Escape') setSavingName(null); }}
            />
            <Button size="sm" variant="brand" onClick={duplicateActiveTheme} disabled={!savingName.trim()}>Create</Button>
            <Button size="sm" variant="ghost" onClick={() => setSavingName(null)}>Cancel</Button>
          </div>
        )}
      </div>

      {isCustom && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-2 mb-2">
            <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold">
              Customise “{activeCustom?.name}”
            </h3>
            <Button size="sm" variant="ghost" onClick={() => deleteCustomTheme(activeCustom.id)}>Delete</Button>
          </div>
          <div className="modes-card p-4">
            <div className="flex items-center gap-3 pb-3 mb-3 border-b border-[var(--modes-border)]">
              <span className="text-label-11 text-[var(--modes-text-dim)] uppercase tracking-wider shrink-0">Name</span>
              <Input
                value={activeCustom?.name || ''}
                onChange={(e) => renameActiveCustom(e.target.value)}
                className="flex-1 h-8 px-2 text-copy-13"
              />
            </div>
            <ColorWheelRow
              label="Background"
              description="The chart page colour."
              value={activeCustom?.bg}
              preset={activeCustom?.bg}
              onChange={(v) => patchActiveCustom({ bg: v })}
              onReset={() => {}}
              open={openPicker === 'Background'}
              onOpenChange={setOpenPicker}
            />
            <ColorWheelRow
              label="Lyric text"
              description="Body copy for lyrics, section names, and notes."
              value={activeCustom?.text}
              preset={activeCustom?.text}
              onChange={(v) => patchActiveCustom({ text: v })}
              onReset={() => {}}
              open={openPicker === 'Lyric text'}
              onOpenChange={setOpenPicker}
            />
            <ColorWheelRow
              label="Chord colour"
              description="Used for every chord above the lyrics."
              value={activeCustom?.chord}
              preset={activeCustom?.chord}
              onChange={(v) => patchActiveCustom({ chord: v })}
              onReset={() => {}}
              open={openPicker === 'Chord colour'}
              onOpenChange={setOpenPicker}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold px-2 mb-2">
          Typography
        </h3>
        <div className="modes-card p-4">
          <FontPickerRow
            label="Chord font"
            value={settings?.chartChordFont}
            onChange={(v) => update('chartChordFont', v)}
            defaultId={DEFAULT_CHORD_FONT_ID}
          />
          <FontPickerRow
            label="Lyric font"
            value={settings?.chartLyricFont}
            onChange={(v) => update('chartLyricFont', v)}
            defaultId={DEFAULT_LYRIC_FONT_ID}
          />
        </div>
        <p className="text-label-11 text-[var(--modes-text-dim)] px-2 mt-2">
          Custom font uploads are coming with the native app.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold px-2 mb-2">
          Spacing
        </h3>
        <div className="modes-card p-4 flex flex-col gap-4">
          <SpacingRow
            label="Lyric line spacing"
            description="Vertical breathing room between lyric lines."
            value={settings?.lyricLineHeight ?? 1.35}
            min={1.05}
            max={2}
            step={0.05}
            format={(v) => v.toFixed(2)}
            onChange={(v) => update('lyricLineHeight', v)}
            onReset={() => update('lyricLineHeight', null)}
            defaultValue={1.35}
          />
          <SpacingRow
            label="Section spacing"
            description="Gap between Verse, Chorus, and other section blocks."
            value={settings?.sectionSpacing ?? 24}
            min={8}
            max={64}
            step={2}
            format={(v) => `${v}px`}
            onChange={(v) => update('sectionSpacing', v)}
            onReset={() => update('sectionSpacing', null)}
            defaultValue={24}
          />
        </div>
      </div>
    </div>
  );
}
