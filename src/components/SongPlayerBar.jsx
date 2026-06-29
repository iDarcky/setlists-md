import { useState } from 'react';
import { youtubeId, spotifyTrackId } from '../lib/coverArt';
import { headerFrostStyle } from '../lib/headerFrost';
import { cn } from '../lib/utils';

// ── Backing-track transport bar ────────────────────────────────────────────
// The bottom bar from docs/mockups/song-hub-v2.html. Plays the song's backing
// track from its Spotify and/or YouTube links via the platform's own embedded
// player (the iframe carries its own seek/volume controls). When both links
// exist a source toggle switches between them. The bar only renders when the
// song actually has a playable link.
//
// Future (noted with the user): tempo / pitch controls for practice. Those need
// a real audio engine we can scrub — embeds can't be re-pitched — so they're
// out of scope for this pass.

export default function SongPlayerBar({ spotifyUrl, youtubeUrl, title }) {
  const ytId = youtubeId(youtubeUrl);
  const spId = spotifyTrackId(spotifyUrl);
  const sources = [
    ytId && { id: 'youtube', label: 'YouTube' },
    spId && { id: 'spotify', label: 'Spotify' },
  ].filter(Boolean);

  const [source, setSource] = useState(sources[0]?.id);
  const [open, setOpen] = useState(false);

  if (sources.length === 0) return null;

  const active = sources.some(s => s.id === source) ? source : sources[0].id;
  const activeLabel = sources.find(s => s.id === active)?.label;
  const embedSrc = active === 'spotify'
    ? `https://open.spotify.com/embed/track/${spId}?utm_source=generator`
    : `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`;

  const pickSource = (id) => {
    setSource(id);
    setOpen(true); // switching a source implies you want to hear it
  };

  return (
    <div
      className="shrink-0 border-t border-[var(--border-1)]"
      style={{ ...headerFrostStyle, background: 'color-mix(in srgb, var(--ds-background-100) 88%, transparent)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {open && (
        <div className="px-3 sm:px-7 pt-3">
          <div className="mx-auto max-w-[1200px] overflow-hidden rounded-xl border border-[var(--border-1)] bg-[var(--ds-background-200)]">
            {active === 'spotify' ? (
              // Compact 80px strip — reads as part of the bar rather than a block.
              <iframe
                key={embedSrc}
                title="Spotify player"
                src={embedSrc}
                width="100%"
                height="80"
                loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                style={{ display: 'block', border: 0, borderRadius: 12 }}
              />
            ) : (
              <iframe
                key={embedSrc}
                title="YouTube player"
                src={embedSrc}
                className="w-full block"
                style={{ aspectRatio: '16 / 9', maxHeight: 240, border: 0 }}
                loading="lazy"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            )}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1200px] px-3 sm:px-7 py-2.5 sm:py-3 flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          aria-label={open ? 'Hide backing track' : 'Play backing track'}
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          className="shrink-0 w-11 h-11 rounded-full grid place-items-center cursor-pointer hover:opacity-90 transition-opacity"
          style={{ background: 'var(--color-brand)', color: '#ffffff', WebkitTapHighlightColor: 'transparent' }}
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>

        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[var(--text-1)] truncate">Backing track</div>
          <div className="text-[11px] text-[var(--text-2)] truncate">
            {activeLabel}{title ? ` · ${title}` : ''}
          </div>
        </div>

        {sources.length > 1 && (
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {sources.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => pickSource(s.id)}
                className={cn(
                  'h-8 px-3 rounded-lg border text-[12px] font-medium cursor-pointer transition-colors',
                  active === s.id
                    ? 'border-[var(--color-brand)] text-[var(--text-1)] bg-[var(--bg-2)]'
                    : 'border-[var(--border-2)] text-[var(--text-2)] bg-[var(--bg-1)] hover:text-[var(--text-1)]',
                )}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
