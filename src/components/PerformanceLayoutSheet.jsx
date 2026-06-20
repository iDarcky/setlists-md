import BottomSheet, { SheetField } from './ui/BottomSheet';
import { SegmentedControl } from './ui/SegmentedControl';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import ChartStyleControls from './ChartStyleControls';
import { TAB_INSTRUMENTS } from './editor/tabInstruments';
import { STAGE_MODES } from '../data/stageModes';
import { cn } from '../lib/utils';

// Shared display-options sheet for PracticeView and PerformanceView.
//
// Reworked from the old flat list into clear groups (Display → Layout →
// Role → Style). The `variant` controls depth:
//   - 'practice' shows everything, including chart-style controls and the
//     Advanced settings shortcut.
//   - 'live' is a trimmed "safety" sheet — the knobs a leader might need
//     mid-service (view, instrument, type size, columns, role) without the
//     deeper styling rabbit holes.
export default function PerformanceLayoutSheet({
  open,
  onClose,
  variant = 'practice',
  stageMode,
  onApplyRole,
  displayMode,
  onChangeDisplayMode,
  tabInstrumentsPresent = [],
  tabInstrument,
  onChangeTabInstrument,
  notation,
  onChangeNotation,
  showChords,
  onToggleShowChords,
  showDiagrams,
  onToggleShowDiagrams,
  columns,
  onChangeColumns,
  fontSize,
  onChangeFontSize,
  chordFontSize,
  onChangeChordFontSize,
  settings,
  onUpdateSettings,
  onOpenAdvancedStyle,
}) {
  const full = variant !== 'live';

  return (
    <BottomSheet open={open} onClose={onClose} title="Display options">
      <div className="flex flex-col gap-5">
        {/* ── Display ── */}
        <div className="flex flex-col gap-4">
          <SheetField label="View">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'chords', label: 'Chords' },
                { id: 'chordsonly', label: 'Chords only' },
                { id: 'lyrics', label: 'Lyrics' },
                { id: 'tabs', label: 'Tabs' },
                { id: 'songmap', label: 'Map' },
              ].map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onChangeDisplayMode(b.id)}
                  aria-pressed={displayMode === b.id}
                  className={cn(
                    'px-3 h-8 rounded-lg border text-label-12 font-semibold cursor-pointer transition-colors',
                    displayMode === b.id
                      ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                      : 'border-[var(--border-1)] text-[var(--text-1)] bg-[var(--bg-1)] hover:border-[var(--border-3)]',
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </SheetField>

          {tabInstrumentsPresent.length >= 2 && (
            <SheetField label="Tab instrument">
              <div className="flex flex-wrap gap-2">
                {['all', ...tabInstrumentsPresent].map(id => (
                  <Button
                    key={id}
                    variant={tabInstrument === id ? 'brand' : 'secondary'}
                    size="sm"
                    onClick={() => onChangeTabInstrument(id)}
                  >
                    {id === 'all' ? 'All' : (TAB_INSTRUMENTS[id]?.label || id)}
                  </Button>
                ))}
              </div>
            </SheetField>
          )}

          <SheetField label="Notation">
            <SegmentedControl
              value={notation}
              onChange={onChangeNotation}
              options={[
                { value: 'letters', label: 'Letters' },
                { value: 'nashville', label: 'Nashville' },
                { value: 'solfege', label: 'Do-Re-Mi' },
              ]}
              size="sm"
            />
          </SheetField>

          <SheetField label="Show">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={onToggleShowChords} className={cn(!showChords && 'opacity-40')}>Chords</Button>
              <Button variant={showDiagrams ? 'brand' : 'secondary'} size="sm" onClick={onToggleShowDiagrams}>Diagrams</Button>
            </div>
          </SheetField>
        </div>

        {/* ── Layout ── */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 pt-1 border-t border-[var(--border-1)]">
          <SheetField label="Columns">
            <SegmentedControl
              value={columns}
              onChange={onChangeColumns}
              options={[
                { value: 1, label: '1 col' },
                { value: 2, label: '2 col' },
              ]}
              size="sm"
            />
          </SheetField>
          <SheetField label="Lyric size">
            <div className="flex items-center bg-[var(--bg-1)] border border-[var(--border-1)] rounded-lg p-0.5 w-fit">
              <IconButton variant="ghost" size="sm" onClick={() => onChangeFontSize(fontSize - 2)} aria-label="Decrease lyric size">−</IconButton>
              <span className="w-6 text-center text-label-12-mono text-[var(--text-1)] font-semibold tabular-nums">{fontSize}</span>
              <IconButton variant="ghost" size="sm" onClick={() => onChangeFontSize(fontSize + 2)} aria-label="Increase lyric size">+</IconButton>
            </div>
          </SheetField>
          <SheetField label="Chord size">
            <div className="flex items-center bg-[var(--bg-1)] border border-[var(--border-1)] rounded-lg p-0.5 w-fit">
              <IconButton variant="ghost" size="sm" onClick={() => onChangeChordFontSize(chordFontSize - 2)} aria-label="Decrease chord size">−</IconButton>
              <span className="w-6 text-center text-label-12-mono text-[var(--text-1)] font-semibold tabular-nums">{chordFontSize}</span>
              <IconButton variant="ghost" size="sm" onClick={() => onChangeChordFontSize(chordFontSize + 2)} aria-label="Increase chord size">+</IconButton>
            </div>
          </SheetField>
        </div>

        {/* ── Role ── */}
        <SheetField label="Role" className="pt-1 border-t border-[var(--border-1)]">
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 py-0.5">
            {STAGE_MODES.map(m => {
              const active = stageMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onApplyRole(m.id)}
                  className={cn(
                    'shrink-0 px-3 h-8 rounded-lg border transition-all text-label-12 font-semibold',
                    active
                      ? 'border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                      : 'border-[var(--border-1)] text-[var(--text-1)] bg-[var(--bg-1)] hover:border-[var(--border-3)]'
                  )}
                  title={m.description}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </SheetField>

        {/* ── Style (practice only) ── */}
        {full && (
          <div className="pt-1 border-t border-[var(--border-1)]">
            <ChartStyleControls settings={settings} onUpdateSettings={onUpdateSettings} />
            {onOpenAdvancedStyle && (
              <button
                type="button"
                onClick={() => { onClose?.(); onOpenAdvancedStyle(); }}
                className="mt-3 w-full h-11 rounded-xl bg-[var(--ds-background-100)] border border-[var(--border-1)] text-copy-14 font-semibold text-[var(--text-1)] flex items-center justify-center gap-2 hover:bg-[var(--bg-1)] transition-all"
                style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)' }}
              >
                Advanced settings
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
