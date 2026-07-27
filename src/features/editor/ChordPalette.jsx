import { useState } from 'react';
import { getDiatonicChords } from '@/music';
import { IconButton } from '@/ui/IconButton';
import ChordPicker from './ChordPicker';
 
export default function ChordPalette({ activeChord, onSelect, onClear, songKey, recentChords = [], selectedChord = null, onRemoveSelected = null }) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState(null);
 
  const diatonic = getDiatonicChords(songKey);
 
  // Merge diatonic + recent, de-duped, diatonic first
  const allChords = [...diatonic];
  for (const c of recentChords) {
    if (!allChords.includes(c)) allChords.push(c);
  }
 
  const handlePickerSelect = (chord) => {
    setShowPicker(false);
    onSelect(chord);
  };
 
  return (
    <div
      className="sticky top-0 z-[50] border-b border-[var(--ds-gray-400)] bg-[var(--ds-background-200)]"
      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
    >
      {/* Chord buttons row */}
      <div className="flex items-center gap-1 px-3 pt-2.5 pb-1 overflow-x-auto">
        {allChords.map(chord => (
          <button
            key={chord}
            onClick={() => activeChord === chord ? onClear() : onSelect(chord)}
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-label-12 font-semibold font-mono text-center cursor-pointer border transition-colors ${
              activeChord === chord
                ? 'bg-[var(--chord)] text-black border-[var(--chord)]'
                : 'bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)] border-[var(--ds-gray-400)] hover:bg-[var(--ds-gray-200)]'
            }`}
          >
            {chord}
          </button>
        ))}
        <div>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setPickerAnchor(rect);
              setShowPicker(v => !v);
            }}
            aria-label="Custom chord"
          >
            +
          </IconButton>
        </div>
      </div>
 
      {/* Active chord / move indicator */}
      <div className="flex items-center gap-2 px-3 pb-2 pt-0.5">
        {selectedChord ? (
          <>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-label-12 font-bold font-mono border"
              style={{
                color: 'var(--color-brand)',
                borderColor: 'var(--color-brand)',
                background: 'rgba(0,200,150,0.08)',
              }}
            >
              ↔ {selectedChord}
            </span>
            <span className="text-copy-11 text-[var(--ds-gray-500)]">Tap new position to move</span>
            <button
              onClick={onRemoveSelected}
              className="ml-auto text-label-11 font-semibold text-[var(--ds-red-700)] hover:text-[var(--ds-red-1000)] cursor-pointer px-2 py-0.5 rounded border border-[var(--ds-red-400)] hover:bg-[var(--ds-red-100)]"
            >
              Remove
            </button>
            <button
              onClick={onClear}
              className="text-label-11 text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] cursor-pointer px-2 py-0.5 rounded border border-[var(--ds-gray-400)]"
            >
              Cancel
            </button>
          </>
        ) : activeChord ? (
          <>
            <span className="text-copy-11 text-[var(--ds-gray-600)]">Active:</span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-label-12 font-bold font-mono border"
              style={{
                color: 'var(--chord)',
                borderColor: 'var(--chord)',
                background: 'rgba(226,168,50,0.1)',
              }}
            >
              {activeChord}
            </span>
            <span className="text-copy-11 text-[var(--ds-gray-500)]">Tap lyrics to place</span>
            <button
              onClick={onClear}
              className="ml-auto text-label-11 text-[var(--ds-gray-600)] hover:text-[var(--ds-gray-1000)] cursor-pointer px-2 py-0.5 rounded border border-[var(--ds-gray-400)]"
            >
              Clear
            </button>
          </>
        ) : (
          <span className="text-copy-11 text-[var(--ds-gray-500)]">Select a chord, or tap an existing chord to move it</span>
        )}
      </div>
 
      {/* ChordPicker popup */}
      {showPicker && (
        <ChordPicker
          onSelect={handlePickerSelect}
          onClose={() => setShowPicker(false)}
          anchorRect={pickerAnchor}
          recentChords={recentChords}
        />
      )}
    </div>
  );
}