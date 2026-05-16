import React from 'react';
import { Button } from '../ui/Button';
import UpgradeGate from '../ui/UpgradeGate';
import {
  CHART_THEMES,
  CHART_FONTS,
  CHART_THEME_MAP,
  DEFAULT_CHART_THEME_ID,
  DEFAULT_CHORD_FONT_ID,
  DEFAULT_LYRIC_FONT_ID,
} from '../../data/chartThemes';

// Settings → Chart Style. Gated to paid plans via UpgradeGate. Lets the
// user pick one of the 8 curated themes, override the three key colours
// (background, text, chord), and choose distinct fonts for chords vs
// lyrics.

function ThemeSwatch({ theme, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      className="group flex flex-col items-stretch text-left rounded-xl overflow-hidden border transition-all"
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
        <div className="text-label-11 text-[var(--modes-text-muted)] truncate">{theme.description}</div>
      </div>
    </button>
  );
}

function ColorRow({ label, description, value, onChange, onReset, preset }) {
  const showReset = value && value !== preset;
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-[var(--modes-border)] last:border-b-0">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-copy-14 text-[var(--modes-text)] font-medium">{label}</span>
        <span className="text-label-12 text-[var(--modes-text-muted)]">{description}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {showReset && (
          <Button size="sm" variant="ghost" onClick={onReset}>Reset</Button>
        )}
        <label
          className="relative h-9 w-14 rounded-lg cursor-pointer overflow-hidden border"
          style={{ background: value || preset, borderColor: 'var(--modes-border)' }}
        >
          <input
            type="color"
            value={value || preset}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
}

function FontPicker({ label, value, onChange, defaultId, sampleText }) {
  return (
    <div className="flex flex-col gap-2 py-3 border-b border-[var(--modes-border)] last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-copy-14 text-[var(--modes-text)] font-medium">{label}</span>
        <select
          value={value || defaultId}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 px-2 rounded-lg bg-[var(--modes-surface-strong)] text-copy-13 text-[var(--modes-text)] border border-[var(--modes-border)]"
        >
          <optgroup label="System">
            {CHART_FONTS.filter(f => f.category === 'system').map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </optgroup>
          <optgroup label="Sans">
            {CHART_FONTS.filter(f => f.category === 'sans').map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </optgroup>
          <optgroup label="Serif">
            {CHART_FONTS.filter(f => f.category === 'serif').map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </optgroup>
          <optgroup label="Mono">
            {CHART_FONTS.filter(f => f.category === 'mono').map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </optgroup>
        </select>
      </div>
      <div
        className="px-3 py-2 rounded-md text-copy-15"
        style={{
          background: 'var(--modes-surface)',
          color: 'var(--modes-text)',
          fontFamily: `var(--chart-font-${label.toLowerCase().includes('chord') ? 'chord' : 'lyric'})`,
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
  const preset = CHART_THEME_MAP[activeThemeId] || CHART_THEME_MAP[DEFAULT_CHART_THEME_ID];

  const hasOverrides =
    !!(settings?.chartBg || settings?.chartText || settings?.chartChordColor);

  const resetAll = () => {
    update('chartBg', null);
    update('chartText', null);
    update('chartChordColor', null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold">
            Theme preset
          </h3>
          {hasOverrides && (
            <Button size="sm" variant="ghost" onClick={resetAll}>Clear overrides</Button>
          )}
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
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold px-2 mb-2">
          Color overrides
        </h3>
        <div className="modes-card p-4">
          <ColorRow
            label="Background"
            description="The chart page colour."
            value={settings?.chartBg}
            preset={preset.bg}
            onChange={(v) => update('chartBg', v)}
            onReset={() => update('chartBg', null)}
          />
          <ColorRow
            label="Lyric text"
            description="Body copy for lyrics, section names, and notes."
            value={settings?.chartText}
            preset={preset.text}
            onChange={(v) => update('chartText', v)}
            onReset={() => update('chartText', null)}
          />
          <ColorRow
            label="Chord colour"
            description="Used for every chord above the lyrics."
            value={settings?.chartChordColor}
            preset={preset.chord}
            onChange={(v) => update('chartChordColor', v)}
            onReset={() => update('chartChordColor', null)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-label-12 text-[var(--modes-text-dim)] uppercase tracking-wider font-semibold px-2 mb-2">
          Typography
        </h3>
        <div className="modes-card p-4">
          <FontPicker
            label="Chord font"
            value={settings?.chartChordFont}
            onChange={(v) => update('chartChordFont', v)}
            defaultId={DEFAULT_CHORD_FONT_ID}
            sampleText="Am  G/B  C  D7sus4"
          />
          <FontPicker
            label="Lyric font"
            value={settings?.chartLyricFont}
            onChange={(v) => update('chartLyricFont', v)}
            defaultId={DEFAULT_LYRIC_FONT_ID}
            sampleText="Amazing grace, how sweet the sound"
          />
        </div>
        <p className="text-label-11 text-[var(--modes-text-dim)] px-2 mt-2">
          Custom font uploads are coming with the native app.
        </p>
      </div>
    </div>
  );
}
