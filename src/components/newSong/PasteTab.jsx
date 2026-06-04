import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { smartImport, detectFormat } from '../../importer';
import { ALL_KEYS } from '../../music';

const FORMAT_OPTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'chordpro', label: 'ChordPro' },
  { value: 'opensong', label: 'OpenSong' },
  { value: 'ultimate-guitar', label: 'Chord-over-lyric' },
  { value: 'plain', label: 'Plain lyrics' },
];

const FORMAT_LABEL = {
  chordpro: 'ChordPro',
  opensong: 'OpenSong',
  'ultimate-guitar': 'Chord-over-lyric',
  plain: 'Plain lyrics',
};

const EXAMPLE = `[Verse 1]
G       D          Em        C
Amazing grace, how sweet the sound
G       D         G
That saved a wretch like me`;

export default function PasteTab({ onSubmit }) {
  const [title, setTitle] = useState('');
  const [songKey, setSongKey] = useState('');
  const [tempo, setTempo] = useState('');
  const [text, setText] = useState('');
  const [formatChoice, setFormatChoice] = useState('auto');
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const detected = useMemo(() => (text.trim() ? detectFormat(text) : null), [text]);
  const effectiveFormat = formatChoice === 'auto' ? detected : formatChoice;

  const overrides = useMemo(() => ({
    title: title.trim(),
    key: songKey.trim(),
    tempo: tempo.trim(),
  }), [title, songKey, tempo]);

  const preview = useMemo(() => {
    if (!text.trim()) return '';
    const override = formatChoice === 'auto' ? null : formatChoice;
    try {
      const { md } = smartImport(text, override, overrides);
      return md;
    } catch (err) {
      return `// Conversion failed: ${err.message}`;
    }
  }, [text, formatChoice, overrides]);

  const handleCreate = () => {
    if (!text.trim() || !title.trim()) return;
    const override = formatChoice === 'auto' ? null : formatChoice;
    const { md } = smartImport(text, override, overrides);
    onSubmit(md);
  };

  const canSubmit = text.trim() && title.trim();

  return (
    // A min height keeps the editor usable on short viewports: rather than
    // shrinking and clipping its own labels/textareas, it holds its size and
    // lets the modal body (overflow-y-auto) scroll.
    <div className="flex flex-col flex-1 min-h-[440px]">
      <div className="px-5 py-3 border-b border-[var(--ds-gray-300)] grid grid-cols-1 sm:grid-cols-[1fr_120px_120px] gap-3">
        <div>
          <label className="text-label-12 text-[var(--ds-gray-600)] font-mono mb-1 block">
            Title <span className="text-[var(--color-brand-text)]">*</span>
          </label>
          <Input
            ref={titleRef}
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Song title"
          />
        </div>
        <div>
          <label className="text-label-12 text-[var(--ds-gray-600)] font-mono mb-1 block">
            Key
          </label>
          <select
            value={songKey}
            onChange={e => setSongKey(e.target.value)}
            className="w-full h-9 bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-md px-2 text-copy-13 text-[var(--ds-gray-1000)] outline-none"
          >
            <option value="">—</option>
            {ALL_KEYS.map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-label-12 text-[var(--ds-gray-600)] font-mono mb-1 block">
            Tempo
          </label>
          <Input
            type="number"
            inputMode="numeric"
            min="20"
            max="300"
            value={tempo}
            onChange={e => setTempo(e.target.value)}
            placeholder="bpm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--ds-gray-300)]">
        <span className="text-label-12 text-[var(--ds-gray-600)] font-mono">Format:</span>
        <select
          value={formatChoice}
          onChange={e => setFormatChoice(e.target.value)}
          className="bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-md px-2 py-1 text-copy-13 text-[var(--ds-gray-1000)] outline-none"
        >
          {FORMAT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {effectiveFormat && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-label-11 font-semibold border"
            style={{
              color: 'var(--color-brand-text)',
              borderColor: 'var(--color-brand-border)',
              background: 'var(--color-brand-soft)',
            }}
          >
            {formatChoice === 'auto' ? 'Detected: ' : ''}{FORMAT_LABEL[effectiveFormat]}
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-[var(--ds-gray-300)] overflow-hidden">
        <div className="flex flex-col min-h-0 p-4">
          <label className="text-label-12 text-[var(--ds-gray-600)] font-mono mb-1.5">Paste</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={EXAMPLE}
            spellCheck={false}
            className="flex-1 min-h-[180px] w-full bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-lg p-3 text-copy-12 leading-relaxed text-[var(--ds-gray-1000)] resize-none outline-none font-mono whitespace-pre"
          />
          <div className="text-label-10 text-[var(--ds-gray-500)] mt-1.5 font-mono">
            {text.trim() ? `${text.split('\n').length} lines · ${text.length} chars` : 'Empty'}
          </div>
        </div>

        <div className="flex flex-col min-h-0 p-4 hidden md:flex">
          <label className="text-label-12 text-[var(--ds-gray-600)] font-mono mb-1.5">Preview (.md)</label>
          <textarea
            readOnly
            value={preview}
            placeholder="Converted .md will appear here…"
            className="flex-1 min-h-[180px] w-full bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-lg p-3 text-copy-12 leading-relaxed text-[var(--ds-gray-1000)] resize-none outline-none font-mono whitespace-pre"
          />
          <div className="text-label-10 text-[var(--ds-gray-500)] mt-1.5 font-mono">
            Review before creating. You can always edit after.
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--ds-gray-300)]">
        <Button
          variant="brand"
          size="sm"
          onClick={handleCreate}
          disabled={!canSubmit}
        >
          Create song
        </Button>
      </div>
    </div>
  );
}
