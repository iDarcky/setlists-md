import { useEffect } from 'react';
import ChartView from './ChartView';

// ── Fullscreen chart/lyrics viewer (WIP) ───────────────────────────────────
// Opened from the Chart / Lyrics tab header's full-screen button. A bare,
// distraction-free overlay wrapping an embedded ChartView.
//
// This is an early scaffold. Future work (per the Song Hub plan) lands here:
//   - the chart "view modes" (chords / lyrics / song map / tabs) that used to
//     live in the ⋮ menu — this is their new home;
//   - live performance controls (auto-scroll, metronome, font stepping).
export default function FullscreenChartViewer({ title, keyLabel, displayMode, chartProps, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-[var(--chart-bg,var(--ds-background-100))]"
      style={{
        color: 'var(--chart-text, var(--ds-gray-1000))',
        '--text-1': 'var(--chart-text, var(--ds-gray-1000))',
        '--text-2': 'var(--chart-subtle, var(--ds-gray-900))',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-[var(--border-1)]">
        <span className="inline-flex items-center h-5 px-2 rounded-md text-[10px] font-bold uppercase tracking-wider" style={{ background: 'var(--color-brand-soft)', color: 'var(--color-brand-text)' }}>WIP</span>
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <h2 className="m-0 truncate text-heading-16 font-semibold text-[var(--text-1)]">{title}</h2>
          {keyLabel && (
            <span className="shrink-0 font-mono text-[12px] font-bold px-1.5 h-5 grid place-items-center rounded" style={{ background: 'var(--chord)', color: '#0a0a0a' }}>{keyLabel}</span>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Exit full screen"
          className="shrink-0 w-9 h-9 grid place-items-center rounded-lg text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)] cursor-pointer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <ChartView embedded {...chartProps} displayMode={displayMode} />
      </div>
    </div>
  );
}
