import React from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/ui/Select';
import { Button } from '@/ui/Button';
import { SheetField } from '@/ui/BottomSheet';
import { useEntitlement } from '@/hooks/useEntitlement';
import {
  CHART_THEMES,
  CHART_FONTS,
  CHART_FONT_MAP,
  CHART_THEME_MAP,
  DEFAULT_CHART_THEME_ID,
  DEFAULT_CHORD_FONT_ID,
  DEFAULT_LYRIC_FONT_ID,
  FREE_CHART_THEME_IDS,
} from '@/data/chartThemes';

// Chart-style controls — theme picker + chord/lyric font dropdowns +
// an "Advanced settings" CTA that hands off to the Settings → Chart
// Style panel. Used inside the Layout bottom sheet from ChartView,
// PracticeView, and PerformanceView so all three keep a consistent
// look-and-feel without duplicating the picker shells.

export default function ChartStyleControls({ settings, onUpdateSettings, onOpenAdvanced }) {
  const { allowed } = useEntitlement('chart-style');
  const update = (k, v) => onUpdateSettings?.(k, v);

  const themeId = settings?.chartTheme || DEFAULT_CHART_THEME_ID;
  const customThemes = settings?.customChartThemes || [];
  const allThemes = [...CHART_THEMES, ...customThemes];

  // Free users can pick from the 3 default themes; paid users see all.
  const visibleThemes = allowed
    ? allThemes
    : CHART_THEMES.filter(t => FREE_CHART_THEME_IDS.has(t.id));

  const chordFontId = settings?.chartChordFont || DEFAULT_CHORD_FONT_ID;
  const lyricFontId = settings?.chartLyricFont || DEFAULT_LYRIC_FONT_ID;
  const chordFont = CHART_FONT_MAP[chordFontId];
  const lyricFont = CHART_FONT_MAP[lyricFontId];

  return (
    <>
      <SheetField label="Theme">
        <div className="flex gap-2 overflow-x-auto py-1.5 -mx-1 px-1">
          {visibleThemes.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => update('chartTheme', t.id)}
              className="shrink-0 flex flex-col items-stretch rounded-lg overflow-hidden border transition-all"
              style={{
                borderColor: themeId === t.id ? 'var(--color-brand)' : 'var(--border-1)',
                boxShadow: themeId === t.id ? '0 0 0 2px var(--color-brand)' : 'none',
                width: 96,
              }}
              aria-label={`Theme: ${t.name}`}
              title={t.name}
            >
              <div
                className="h-10 flex items-end justify-end px-2 py-1"
                style={{ background: t.bg, color: t.chord, fontFamily: 'var(--font-mono)' }}
              >
                <span className="text-label-11 font-bold">Am</span>
              </div>
              <div className="px-2 py-1 text-label-11 font-medium text-[var(--text-1)] truncate" style={{ background: 'var(--bg-1)' }}>
                {t.name}
              </div>
            </button>
          ))}
        </div>
      </SheetField>

      {allowed ? (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <SheetField label="Chord font">
              <Select value={chordFontId} onValueChange={(v) => update('chartChordFont', v)}>
                <SelectTrigger className="h-9 px-3 text-label-13 font-medium text-[var(--text-1)] gap-1 min-w-[180px] w-auto">
                  <SelectValue>
                    <span style={{ fontFamily: chordFont?.stack }}>{chordFont?.name || 'System'}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CHART_FONTS.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      <span style={{ fontFamily: f.stack }}>{f.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SheetField>

            <SheetField label="Lyric font">
              <Select value={lyricFontId} onValueChange={(v) => update('chartLyricFont', v)}>
                <SelectTrigger className="h-9 px-3 text-label-13 font-medium text-[var(--text-1)] gap-1 min-w-[180px] w-auto">
                  <SelectValue>
                    <span style={{ fontFamily: lyricFont?.stack }}>{lyricFont?.name || 'System'}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CHART_FONTS.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      <span style={{ fontFamily: f.stack }}>{f.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SheetField>
          </div>

          {onOpenAdvanced && (
            <button
              type="button"
              onClick={onOpenAdvanced}
              className="mt-2 w-full h-11 rounded-xl bg-[var(--ds-background-100)] border border-[var(--border-1)] text-copy-14 font-semibold text-[var(--text-1)] flex items-center justify-center gap-2 hover:bg-[var(--bg-1)] transition-all"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)' }}
            >
              Advanced settings
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </>
      ) : (
        <SheetField label="More themes & fonts">
          <div className="text-copy-13 text-[var(--text-2)]">
            Upgrade to Pro to unlock all 8 themes, custom colours, and font choices.
          </div>
        </SheetField>
      )}
    </>
  );
}
