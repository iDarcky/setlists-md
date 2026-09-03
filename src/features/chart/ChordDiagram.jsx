import { useEffect, useRef } from 'react';
import { CHORD_SHAPES } from '@/data/chordShapes';

// svguitar (with its svg.js dependency) is ~189 KB — larger than the entire
// chart reader. Diagrams are OFF by default and only reachable from the
// Performance layout sheet, so a static import made every reader, editor and
// practice session download a renderer almost nobody turns on. Loading it here
// means the cost is paid by the people who actually switch diagrams on.
//
// The module promise is memoised so a chart showing twelve chords fetches once,
// and cleared on failure so a offline first attempt can retry later.
let svguitarPromise = null;
function loadSvguitar() {
  if (!svguitarPromise) {
    svguitarPromise = import('svguitar').catch((err) => {
      svguitarPromise = null;
      throw err;
    });
  }
  return svguitarPromise;
}

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

    // The load is async, so the effect can be torn down (chord changed,
    // diagrams switched off) before it resolves — bail rather than draw into
    // a container that is no longer ours.
    let cancelled = false;

    loadSvguitar().then(({ SVGuitarChord }) => {
      if (cancelled || !containerRef.current) return;
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
    }).catch(() => {
      // Offline or blocked: leave the placeholder box empty rather than throw.
    });

    const container = containerRef.current;
    return () => {
      cancelled = true;
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
