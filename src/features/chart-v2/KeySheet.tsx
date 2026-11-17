import { useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { keysInQualityOf as keysJs, semitonesBetween as semisJs, transposeKey as transposeKeyJs } from '@/music';
import { MAX_CAPO, shapeKeyFor as shapeKeyJs } from '@/lib/capo';
import { Panel } from './Panel';
import { Segmented } from './ui';

const keysInQualityOf = keysJs as (key: string, accidentals?: string) => string[];
const semitonesBetween = semisJs as (from: string, to: string) => number;
const transposeKey = transposeKeyJs as (key: string, semis: number) => string;
const shapeKeyFor = shapeKeyJs as (key: string, capo: number) => string | null;

export type KeyScope = 'me' | 'band';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** The key the song is written in. */
  songKey: string;
  /** Semitones from the written key, as the chart shows it now. */
  transpose: number;
  capo: number;
  tempo?: number;
  time?: string;
  /** Practice + allowed to save: "For the band" writes to the setlist. */
  canSaveForBand: boolean;
  accidentals: string;
  onKey: (semis: number, scope: KeyScope) => void;
  onCapo: (capo: number) => void;
  onTempo: (bpm: number | null) => void;
  onTime: (time: string) => void;
}

const TIMES = ['2/4', '3/4', '4/4', '6/8'];

function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string }) {
  const btn = 'flex size-10 min-h-0 items-center justify-center rounded-control text-foreground hover:bg-card disabled:opacity-40';
  return (
    <div className="inline-flex h-11 items-center gap-1 rounded-control bg-raised p-0.5">
      <button type="button" aria-label={`Less ${label}`} className={btn} disabled={value <= min} onClick={() => onChange(value - 1)}><Minus size={18} strokeWidth={1.8} /></button>
      <span className="min-w-10 text-center text-body font-semibold tabular-nums">{value}</span>
      <button type="button" aria-label={`More ${label}`} className={btn} disabled={value >= max} onClick={() => onChange(value + 1)}><Plus size={18} strokeWidth={1.8} /></button>
    </div>
  );
}

function Label({ children, right }: { children: string; right?: string }) {
  return (
    <div className="mt-5 mb-2 flex items-center justify-between text-small text-muted-foreground first:mt-0">
      <span>{children}</span>
      {right && <span className="text-foreground">{right}</span>}
    </div>
  );
}

/**
 * Key, capo, tempo and time in one sheet, opened from the header pills
 * (canvas board "Key, tempo, time"). The key can be just for me (this
 * screen, this session) or for the band (written to the setlist, practice
 * only, as today). Capo is always yours: it follows you, not the setlist.
 * Tempo and time are the setlist's, so they change only for the band.
 */
export function KeySheet(p: Props) {
  const [scope, setScope] = useState<KeyScope>(p.canSaveForBand ? 'band' : 'me');
  const taps = useRef<number[]>([]);
  const prefer = p.accidentals === 'sharps' ? 'sharps' : 'flats';
  const keys = keysInQualityOf(p.songKey, prefer);
  const shown = p.transpose ? transposeKey(p.songKey, p.transpose) : p.songKey;
  const shownIdx = keys.findIndex(k => semitonesBetween(k, shown) === 0);
  const diff = ((p.transpose % 12) + 12) % 12;
  const signed = diff > 6 ? diff - 12 : diff;
  const shape = p.capo ? shapeKeyFor(shown, p.capo) : null;

  const tap = () => {
    const now = performance.now();
    const t = [...taps.current.filter(x => now - x < 3000), now].slice(-5);
    taps.current = t;
    if (t.length < 3) return;
    const gaps = t.slice(1).map((x, i) => x - t[i]);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    p.onTempo(Math.round(60000 / avg));
  };

  return (
    <Panel open={p.open} onOpenChange={p.onOpenChange} title="Key, tempo and time">
      <Label right={signed ? `${p.songKey} → ${shown} · ${signed > 0 ? 'up' : 'down'} ${Math.abs(signed)}` : `${p.songKey} · as written`}>Key</Label>
      <div role="radiogroup" aria-label="Key" className="grid grid-cols-6 gap-1.5">
        {keys.map((k, i) => {
          const on = i === shownIdx;
          const written = semitonesBetween(p.songKey, k) === 0;
          return (
            <button
              key={k} type="button" role="radio" aria-checked={on}
              onClick={() => p.onKey(semitonesBetween(p.songKey, k), scope)}
              className={`relative h-11 min-h-0 rounded-[9px] border text-[15px] font-semibold ${on ? 'border-link bg-selected' : 'border-border'} ${written ? 'text-warning-text' : 'text-foreground'}`}
            >
              {k.replace('#', '♯').replace(/b(m?)$/, '♭$1')}
              {written && <span className="absolute inset-x-0 bottom-0.5 text-[9px] font-medium text-muted-foreground">song</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5">
        <Segmented
          label="Who the key is for" fill value={scope}
          options={[{ value: 'me', label: 'Just for me' }, { value: 'band', label: 'For the band', disabled: !p.canSaveForBand }]}
          onChange={v => setScope(v as KeyScope)}
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-body">Capo{shape ? <span className="ml-2 text-small text-muted-foreground">play {shape} shapes</span> : null}</span>
        <Stepper label="capo" value={p.capo} min={0} max={MAX_CAPO} onChange={p.onCapo} />
      </div>

      <Label>Tempo</Label>
      <div className="flex items-center gap-2.5">
        <Stepper label="tempo" value={p.tempo || 0} min={0} max={300} onChange={n => p.canSaveForBand && p.onTempo(n > 0 ? n : null)} />
        <span className="text-small text-muted-foreground">BPM</span>
        <button type="button" onClick={tap} disabled={!p.canSaveForBand} className="ml-auto h-10 min-h-0 rounded-control border border-border px-4 text-small disabled:opacity-40">Tap tempo</button>
      </div>

      <Label>Time</Label>
      <Segmented
        label="Time signature" fill value={p.time || ''}
        options={TIMES.map(t => ({ value: t, label: t, disabled: !p.canSaveForBand }))}
        onChange={v => p.canSaveForBand && p.onTime(v)}
      />
      <p className="mt-4 text-caption text-muted-foreground">
        {p.canSaveForBand
          ? '“For the band” saves to this setlist. Capo is only yours.'
          : 'On stage a key change is just for you. Tempo and time change in practice.'}
      </p>
    </Panel>
  );
}
