import { useState, useEffect, useRef } from 'react';
import { Button } from '@/ui/Button';

const ROOTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const SUFFIXES = [
  { label: 'maj', value: '' },
  { label: 'm', value: 'm' },
  { label: '7', value: '7' },
  { label: 'm7', value: 'm7' },
  { label: 'sus4', value: 'sus4' },
  { label: 'add9', value: 'add9' },
  { label: 'maj7', value: 'maj7' },
  { label: 'dim', value: 'dim' },
  { label: 'aug', value: 'aug' },
];

export default function ChordPicker({ onSelect, onClose, anchorRect, recentChords = [] }) {
  const [root, setRoot] = useState(null);
  const [accidental, setAccidental] = useState('');
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSuffix = (suffix) => {
    if (!root) return;
    onSelect(root + accidental + suffix);
    setRoot(null);
    setAccidental('');
  };

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] rounded-xl p-2.5 w-[290px]"
      style={{
        top: anchorRect ? anchorRect.bottom + 4 : '50%',
        left: anchorRect ? Math.min(anchorRect.left, window.innerWidth - 310) : '50%',
        ...(anchorRect ? {} : { transform: 'translate(-50%, -50%)' }),
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      {/* Recent chords (if any) */}
      {recentChords.length > 0 && (
        <div className="mb-1.5">
          <div className="text-label-10 text-[var(--ds-gray-500)] font-mono mb-1 uppercase tracking-wider">
            Recent
          </div>
          <div className="flex flex-wrap gap-1">
            {recentChords.slice(0, 10).map(c => (
              <button
                key={c}
                onClick={() => { onSelect(c); setRoot(null); setAccidental(''); }}
                className="rounded-md px-2 py-1 text-label-12 font-semibold font-mono bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)] border border-[var(--ds-gray-400)] cursor-pointer hover:bg-[var(--ds-gray-200)] transition-colors"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Root row */}
      <div className="flex gap-1 mb-1.5">
        {ROOTS.map(r => (
          <button
            key={r}
            onClick={() => setRoot(r)}
            className={`flex-1 rounded-md py-1.5 text-label-13 font-semibold font-mono text-center cursor-pointer border transition-colors ${
              root === r
                ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                : 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)] border-[var(--ds-gray-400)] hover:bg-[var(--ds-gray-200)]'
            }`}
          >
            {r}
          </button>
        ))}
        {/* Accidental toggles */}
        <button
          onClick={() => setAccidental(a => a === '#' ? '' : '#')}
          className={`w-8 rounded-md py-1.5 text-label-13 font-semibold font-mono text-center cursor-pointer border transition-colors ${
            accidental === '#'
              ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] border-[var(--color-brand-border)]'
              : 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-600)] border-[var(--ds-gray-400)]'
          }`}
        >
          #
        </button>
        <button
          onClick={() => setAccidental(a => a === 'b' ? '' : 'b')}
          className={`w-8 rounded-md py-1.5 text-label-13 font-semibold font-mono text-center cursor-pointer border transition-colors ${
            accidental === 'b'
              ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] border-[var(--color-brand-border)]'
              : 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-600)] border-[var(--ds-gray-400)]'
          }`}
        >
          b
        </button>
      </div>

      {/* Selected root preview */}
      {root && (
        <div className="text-center text-copy-11 text-[var(--ds-gray-600)] mb-1 font-mono">
          {root}{accidental} + suffix:
        </div>
      )}

      {/* Suffix row */}
      <div className="flex flex-wrap gap-1">
        {SUFFIXES.map(s => (
          <button
            key={s.label}
            onClick={() => handleSuffix(s.value)}
            className={`rounded-md px-2 py-1.5 text-label-11 font-semibold font-mono text-center border transition-colors ${
              root
                ? 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)] border-[var(--ds-gray-400)] cursor-pointer hover:bg-[var(--ds-gray-200)]'
                : 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-500)] border-[var(--ds-gray-300)] cursor-not-allowed opacity-40'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Slash chord option */}
      {root && (
        <div className="mt-1.5 flex gap-1 items-center">
          <span className="text-label-10 text-[var(--ds-gray-500)]">Slash:</span>
          {ROOTS.map(r => (
            <button
              key={r}
              onClick={() => {
                onSelect(root + accidental + '/' + r);
                setRoot(null); setAccidental('');
              }}
              className="rounded-md px-1.5 py-1 text-label-10 font-semibold font-mono bg-[var(--ds-gray-100)] text-[var(--ds-gray-600)] border border-[var(--ds-gray-400)] cursor-pointer hover:bg-[var(--ds-gray-200)] transition-colors"
            >
              /{r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
