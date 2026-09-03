import { useCallback, useEffect, useRef, useState } from 'react';
import { beatsPerBar, clampTempo, createMetronome } from '@/lib/metronome';

/**
 * Element 12 — the click, as React state.
 *
 * The engine lives in a ref, not in state: it owns an AudioContext and a timer,
 * neither of which may be re-created on a render. Only `running` is state,
 * because only `running` changes what is drawn.
 */
export function useMetronome() {
  const engineRef = useRef(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const engine = createMetronome();
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const start = useCallback((bpm, time) => {
    // Returns false when there is no Web Audio at all, so the caller can leave
    // the toggle off rather than showing a running click that makes no sound.
    const ok = engineRef.current?.start(clampTempo(bpm), beatsPerBar(time));
    setRunning(!!ok);
    return !!ok;
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    setRunning(false);
  }, []);

  const setTempo = useCallback((bpm) => {
    engineRef.current?.setTempo(clampTempo(bpm));
  }, []);

  return { running, start, stop, setTempo };
}

export default useMetronome;
