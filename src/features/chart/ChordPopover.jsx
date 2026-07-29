import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CHORD_SHAPES } from '@/data/chordShapes';
import ChordDiagram from './ChordDiagram';

/**
 * Element 11 — tap a chord, see that chord.
 *
 * Not a strip. A strip of every chord in the song is a permanent tax paid for
 * the one chord you didn't know, and it is why nobody left diagrams on. This
 * costs nothing until you ask a question, and answers only the question asked.
 *
 * It shows the chord AS WRITTEN. Capo is deliberately not applied: if the
 * chart says G and you tap G, you get the G shape. Working out what a capo
 * does to it is the player's job, and second-guessing it here would mean
 * showing a shape whose name is nowhere on the screen.
 */
export default function ChordPopover({ chord, anchorRect, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  // Place it after the card has a real size — a 0×0 measurement puts a
  // right-edge chord's popover half off screen.
  useEffect(() => {
    if (!anchorRect || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(
      Math.max(margin, anchorRect.left + anchorRect.width / 2 - box.width / 2),
      window.innerWidth - box.width - margin,
    );
    // Above the chord by preference — a finger tapping a chord covers what is
    // directly below it.
    const above = anchorRect.top - box.height - 10;
    const top = above > margin ? above : Math.min(
      anchorRect.bottom + 10,
      window.innerHeight - box.height - margin,
    );
    setPos({ left, top });
  }, [anchorRect, chord]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!chord || !anchorRect) return null;
  const known = !!CHORD_SHAPES[chord];

  return createPortal(
    <>
      <div className="fixed inset-0 z-[200]" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-label={`${chord} chord shape`}
        className="fixed z-[201] rounded-xl border shadow-xl p-2.5 flex flex-col items-center gap-1"
        style={{
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
          // Invisible until placed, rather than flashing in the wrong corner.
          visibility: pos ? 'visible' : 'hidden',
          background: 'var(--ds-background-100)',
          borderColor: 'var(--ds-gray-400)',
          minWidth: 108,
        }}
      >
        <span className="text-label-13 font-mono font-bold" style={{ color: 'var(--chord)' }}>
          {chord}
        </span>
        {known ? (
          <ChordDiagram chord={chord} size={92} />
        ) : (
          <span className="px-1 py-3 text-label-11 text-center text-[var(--ds-gray-600)]">
            No shape for this one yet
          </span>
        )}
      </div>
    </>,
    document.body,
  );
}
