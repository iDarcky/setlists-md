import { useEffect, useRef } from 'react';
import { SVGuitarChord } from 'svguitar';
import { CHORD_SHAPES } from '@/data/chordShapes';

export default function ChordDiagram({ chord, size = 80 }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const shape = CHORD_SHAPES[chord];
    if (!shape) return;

    // Clear previous render
    containerRef.current.innerHTML = '';

    // Resolve the brand accent (honours a Pro accent override) for the dots,
    // falling back to the app teal. svguitar needs a real colour, not a var().
    const brand = (getComputedStyle(document.documentElement)
      .getPropertyValue('--color-brand').trim()) || '#0ea5a4';

    try {
      const chart = new SVGuitarChord(containerRef.current);

      // Render as a printed chord box: light "paper" background, dark fretboard
      // lines/text, brand-coloured finger dots. Colours are configured natively
      // (not post-processed) so the fretboard fill and the lines never collapse
      // to the same colour — that was the "invisible diagram" bug.
      chart
        .configure({
          strings: 6,
          frets: 4,
          position: shape.position || 1,
          // No title — the strip labels each diagram above the card.
          backgroundColor: '#f7f5f1',
          color: '#3a342f',
          fingerColor: brand,
          fingerTextColor: '#ffffff',
          emptyStringIndicatorSize: 0.5,
          strokeWidth: 1.6,
          nutWidth: 5,
          fretLabelFontSize: 20,
          fingerSize: 0.65,
          fontFamily: 'var(--fm, monospace)',
        })
        .chord({
          fingers: shape.fingers,
          barres: shape.barres || [],
        })
        .draw();

      const svg = containerRef.current.querySelector('svg');
      if (svg) {
        // Square it (no title row).
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
      }
    } catch {
      // Silently fail for unsupported chords
    }

    const container = containerRef.current;
    return () => {
      if (container) container.innerHTML = '';
    };
  }, [chord, size]);

  const shape = CHORD_SHAPES[chord];
  if (!shape) return null;

  return (
    <div
      ref={containerRef}
      title={chord}
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    />
  );
}
