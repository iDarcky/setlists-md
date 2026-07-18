import React, { useRef, useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import Highlight from './ui/Highlight';
import { StructureRibbon } from './StructureRibbon';
import { useCoverArt } from '../lib/useCoverArt';
import { mostPlayedKey, totalPlays } from '../keyHistory';

// Gradient used behind songs with no cover art — mirrors the Song Hub's
// placeholder so the two surfaces read as one system.
const ART_GRADIENT = 'radial-gradient(120% 120% at 20% 10%, #1f5f4f 0%, #0e2c30 55%, #150f1f 100%)';

function defaultArr(song) {
  if (!Array.isArray(song?.arrangements)) return song || {};
  return song.arrangements.find(a => a.id === song.defaultArrangementId) || song.arrangements[0] || song;
}

const EditGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const PlusGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

// A true media card for the Songs gallery (songsLibraryPlus): cover art, gold
// key chip, meta row, section-code song map, a played badge from keyHistory, a
// duplicate ribbon, hover lift + quick actions, and a selection checkbox.
function SongMediaCard({
  song, onOpen, onEdit, onAddToSetlist,
  selected = false, selectionActive = false, onToggleSelect,
  highlight, duplicate = false, settings = {},
}) {
  const rootRef = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = rootRef.current;
    if (!node || visible) return undefined;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: '200px 0px' });
    obs.observe(node);
    return () => obs.disconnect();
  }, [visible]);

  const arr = defaultArr(song);
  const songKey = arr?.key || song?.key || 'C';
  const tempo = arr?.tempo ?? song?.tempo;
  const time = arr?.time || song?.time;
  const structure = Array.isArray(arr?.structure) ? arr.structure : [];
  const plays = totalPlays(song?.keyHistory);
  const topKey = mostPlayedKey(song?.keyHistory);

  // Only fetch (network) Spotify art once the card is near the viewport.
  const { artUrl, markFailed } = useCoverArt(song, { enabled: visible });

  const stop = (e) => e.stopPropagation();

  return (
    <div
      ref={rootRef}
      onClick={() => (selectionActive ? onToggleSelect?.(song.id) : onOpen?.(song))}
      className={cn(
        'group relative modes-card-strong rounded-2xl p-3 cursor-pointer flex flex-col gap-2.5 transition-all duration-150',
        'hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--color-brand)_45%,var(--modes-border))] hover:shadow-lg',
        selected && 'ring-2 ring-[var(--color-brand)]',
      )}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Selection checkbox — always shown in select mode, else on hover. */}
      {onToggleSelect && (
        <label
          onClick={stop}
          className={cn('absolute top-2.5 right-2.5 z-10 transition-opacity',
            (selectionActive || selected) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(song.id)}
            aria-label={`Select ${song.title || 'song'}`}
            className="w-4 h-4 rounded accent-[var(--color-brand)] cursor-pointer"
          />
        </label>
      )}

      <div className="flex items-start gap-3 min-w-0">
        {/* Cover art / gradient placeholder with the key. */}
        <div
          className="shrink-0 w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center text-white relative"
          style={{ background: ART_GRADIENT }}
        >
          {artUrl
            ? <img src={artUrl} alt="" loading="lazy" onError={() => markFailed(artUrl)} className="w-full h-full object-cover" />
            : <span className="text-heading-18 font-bold opacity-90">{songKey}</span>}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-heading-16 font-bold text-[var(--modes-text)] m-0 truncate leading-tight">
              {highlight ? <Highlight text={song.title || 'Untitled'} query={highlight} /> : (song.title || 'Untitled')}
            </h3>
          </div>
          {song.artist && (
            <p className="m-0 mt-0.5 text-label-13 text-[var(--modes-text-muted)] truncate">
              {highlight ? <Highlight text={song.artist} query={highlight} /> : song.artist}
            </p>
          )}
          {/* Meta row — gold key chip · ♩BPM · Time. */}
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded-md bg-[var(--modes-surface-strong)] text-[var(--color-brand)] text-label-12 font-bold">{songKey}</span>
            {tempo ? <span className="text-label-12 text-[var(--modes-text-muted)] tabular-nums">♩{tempo}</span> : null}
            {time ? <span className="text-label-12 text-[var(--modes-text-dim)]">{time}</span> : null}
          </div>
        </div>
      </div>

      {/* Section-code song map. */}
      {structure.length > 0 && (
        <div className="overflow-x-auto no-scrollbar -mx-0.5 px-0.5">
          <StructureRibbon
            structure={structure}
            compact
            collapse
            style="codes"
            activeIndex={null}
            sectionColors={settings?.sectionColors}
            sectionLabels={settings?.sectionLabels}
            customSectionTypes={settings?.customSectionTypes}
          />
        </div>
      )}

      {/* Badges + quick actions. */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
          {duplicate && (
            <span className="text-label-11 font-semibold px-1.5 py-0.5 rounded bg-[var(--ds-amber-100)] text-[var(--ds-amber-1000)] border border-[var(--ds-amber-400)]">Duplicate title</span>
          )}
          {plays > 0 && (
            <span className="text-label-11 text-[var(--modes-text-dim)] whitespace-nowrap" title={`Played ${plays}×`}>
              Played {plays}×{topKey ? ` · mostly ${topKey}` : ''}
            </span>
          )}
        </div>
        {/* Quick actions — revealed on hover (not in select mode). */}
        {!selectionActive && (
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {onAddToSetlist && (
              <button onClick={(e) => { stop(e); onAddToSetlist(song); }} aria-label="Add to setlist" title="Add to setlist"
                className="w-7 h-7 rounded-md flex items-center justify-center border-none bg-[var(--modes-surface)] text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface-strong)] hover:text-[var(--modes-text)] cursor-pointer transition-colors">
                <PlusGlyph />
              </button>
            )}
            {onEdit && (
              <button onClick={(e) => { stop(e); onEdit(song); }} aria-label="Edit" title="Edit"
                className="w-7 h-7 rounded-md flex items-center justify-center border-none bg-[var(--modes-surface)] text-[var(--modes-text-muted)] hover:bg-[var(--modes-surface-strong)] hover:text-[var(--modes-text)] cursor-pointer transition-colors">
                <EditGlyph />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(SongMediaCard);
