import { useState, useRef } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { toast } from '../ui/use-toast';
import { IconButton } from '../ui/IconButton';
import { detectChords } from '../../utils/aiChordEngine';

export default function AiImportTab({ onImportSongs }) {
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      if (!f.type.startsWith('audio/')) {
        toast({ title: 'Invalid file', description: 'Please select an audio file (MP3, WAV, etc.)', variant: 'error' });
        return;
      }
      setFile(f);
    }
  };

  const handleStartAnalysis = async () => {
    if (!file) return;
    setAnalyzing(true);
    setProgress(0);

    try {
      const song = await detectChords(file, (p) => setProgress(p));

      onImportSongs([{
        ...song,
        id: 'ai-' + Date.now(),
      }]);

      toast({
        title: 'Analysis complete',
        description: `Detected ${song.key} major at ~${song.tempo} BPM.`
      });
    } catch (err) {
      console.error(err);
      toast({ title: 'Analysis failed', description: err.message, variant: 'error' });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 max-w-2xl mx-auto w-full">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand-text)] text-label-12 font-medium border border-[var(--color-brand)]/20">
          ✨ AI Beta
        </div>
        <h2 className="text-heading-24 font-semibold">Chordify your library</h2>
        <p className="text-[var(--ds-gray-600)] text-copy-14">
          Upload a recording or a backing track. Our AI will detect the key, tempo, and chord progression automatically.
        </p>
      </div>

      <Card className="p-8 border-dashed border-2 flex flex-col items-center justify-center gap-4 bg-[var(--ds-background-100)]">
        {!file ? (
          <>
            <div className="w-12 h-12 rounded-full bg-[var(--ds-gray-200)] flex items-center justify-center text-[var(--ds-gray-600)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <div className="text-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[var(--color-brand-text)] font-medium hover:underline"
              >
                Choose an audio file
              </button>
              <p className="text-copy-12 text-[var(--ds-gray-500)] mt-1">MP3, WAV, or M4A up to 20MB</p>
            </div>
          </>
        ) : (
          <div className="w-full space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--ds-background-200)] border border-[var(--ds-gray-300)]">
              <div className="w-10 h-10 rounded bg-[var(--ds-gray-300)] flex items-center justify-center text-[var(--ds-gray-600)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-copy-14 font-medium truncate">{file.name}</div>
                <div className="text-copy-12 text-[var(--ds-gray-500)]">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
              </div>
              <IconButton variant="ghost" size="sm" onClick={() => setFile(null)}>✕</IconButton>
            </div>

            <div className="w-full space-y-2">
              <Button
                className="w-full py-6 text-copy-16"
                disabled={analyzing}
                onClick={handleStartAnalysis}
              >
                {analyzing ? (
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" />
                    <span>Analyzing Chords ({progress}%)</span>
                  </div>
                ) : (
                  "Start AI Analysis"
                )}
              </Button>
              {analyzing && (
                <div className="w-full h-1.5 bg-[var(--ds-gray-300)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-brand)] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="audio/*"
        />
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)]">
          <div className="text-copy-14 font-semibold flex items-center gap-2 mb-1">
            <span className="text-amber-500">🔒</span> PRO Feature
          </div>
          <p className="text-copy-12 text-[var(--ds-gray-600)]">
            AI chord extraction requires a Pro subscription. You have 0 free credits remaining.
          </p>
          <button className="text-copy-12 text-[var(--color-brand-text)] font-bold mt-2 hover:underline">
            Upgrade to Pro →
          </button>
        </div>
        <div className="p-4 rounded-xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)]">
          <div className="text-copy-14 font-semibold flex items-center gap-2 mb-1">
            ⚖️ Legal Note
          </div>
          <p className="text-copy-12 text-[var(--ds-gray-600)]">
            Analysis happens 100% on your device. We don't store your audio files. Use only for content you own or have a license for.
          </p>
        </div>
      </div>
    </div>
  );
}
