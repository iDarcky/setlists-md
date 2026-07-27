import { useState } from 'react';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';

// Pick how many semitones the key shifts. When showAddChords is set, the caller
// can also drop a chord line right after to write the new key's chords.
export default function KeyChangeDialog({ onConfirm, onClose, showAddChords = true }) {
  const [steps, setSteps] = useState(2);
  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-[var(--ds-background-200)] rounded-2xl border border-[var(--ds-gray-400)] w-full max-w-[340px] p-5" style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
        <h3 className="text-heading-15 font-semibold text-[var(--ds-gray-1000)] m-0 mb-1">Key change</h3>
        <p className="text-copy-13 text-[var(--ds-gray-600)] m-0 mb-4">Shift every chord after this point up or down.</p>
        <div className="flex items-center justify-center gap-4 mb-5">
          <IconButton variant="default" size="md" aria-label="Down a step" onClick={() => setSteps(s => Math.max(-12, s - 1))}>−</IconButton>
          <div className="text-center min-w-[88px]">
            <div className="text-[28px] font-black font-mono text-[var(--chord)] leading-none">{steps > 0 ? '+' : ''}{steps}</div>
            <div className="text-label-10 uppercase tracking-wider text-[var(--ds-gray-500)] mt-1">{Math.abs(steps) === 1 ? 'semitone' : 'semitones'}</div>
          </div>
          <IconButton variant="default" size="md" aria-label="Up a step" onClick={() => setSteps(s => Math.min(12, s + 1))}>+</IconButton>
        </div>
        <div className="flex flex-col gap-2">
          {showAddChords && (
            <Button variant="brand" size="md" disabled={steps === 0} onClick={() => onConfirm(steps, true)}>Insert + add chords</Button>
          )}
          <Button variant={showAddChords ? 'secondary' : 'brand'} size="md" disabled={steps === 0} onClick={() => onConfirm(steps, false)}>Insert key change</Button>
        </div>
      </div>
    </div>
  );
}
