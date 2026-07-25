import React from 'react';
import { Card } from './ui/Card';
import { cn, selectPad } from '../lib/utils';
import Highlight from './ui/Highlight';
import { StructureRibbon } from './StructureRibbon';
import { SelectCircle } from './ui/SelectCircle';
import { useLongPress } from '../lib/useLongPress';
import { useCoverArt } from '../lib/useCoverArt';

// Leading cover-art thumbnail (matches the setlist date badge — same brand
// gradient). Resolves Spotify album art → YouTube thumbnail → a music-note tile.
function SongArt({ song, size = 'md' }) {
  const { artUrl, markFailed } = useCoverArt(song);
  const box = size === 'sm' ? 'w-10 h-10 rounded-lg' : 'w-14 h-14 rounded-xl';
  const glyph = size === 'sm' ? 16 : 22;
  return (
    <span className={cn(
      'shrink-0 overflow-hidden flex items-center justify-center text-white/80 bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-vetiver)]',
      box,
    )}>
      {artUrl
        ? <img src={artUrl} alt="" loading="lazy" className="w-full h-full object-cover" onError={() => markFailed(artUrl)} />
        : <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>}
    </span>
  );
}

const EditGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const SpotifyGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="#1DB954" aria-label="Spotify"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.586 14.424a.622.622 0 0 1-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 1 1-.277-1.215c3.809-.87 7.077-.496 9.712 1.115a.623.623 0 0 1 .207.857Zm1.223-2.722a.78.78 0 0 1-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 1 1-.452-1.492c3.632-1.102 8.147-.568 11.232 1.329a.78.78 0 0 1 .257 1.072Zm.105-2.835c-3.223-1.914-8.54-2.09-11.616-1.156a.935.935 0 1 1-.542-1.79c3.532-1.072 9.404-.865 13.115 1.338a.936.936 0 0 1-.957 1.608Z" /></svg>
);
const YouTubeGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="#FF0000" aria-label="YouTube"><path d="M23.5 6.2a3 3 0 0 0-2.11-2.13C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.39.52A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.11 2.13c1.89.52 9.39.52 9.39.52s7.5 0 9.39-.52a3 3 0 0 0 2.11-2.13A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" /></svg>
);
function MediaIcons({ song }) {
  const hasS = !!song?.spotify;
  const hasY = !!song?.youtube;
  if (!hasS && !hasY) return null;
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0 align-middle">
      {hasS && <SpotifyGlyph />}
      {hasY && <YouTubeGlyph />}
    </span>
  );
}

function defaultArr(song) {
  if (!Array.isArray(song?.arrangements)) return song;
  return song.arrangements.find(a => a.id === song.defaultArrangementId) || song.arrangements[0] || song;
}

function formatRelativeTime(ts) {
  if (!ts) return null;
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function SongCard({
  song, onClick, variant = 'card', showTags = false, selected = false, highlight,
  // Card/Compact display + selection (songsLibraryPlus). All optional so the
  // other call sites (mobile search, etc.) are unaffected.
  fields = null,            // Set of visible field ids; null = show the defaults
  songMapSettings = null, onEdit = null,
  selectable = false, selectActive = false, isSelected = false, onToggleSelect = null, onLongPress = null,
}) {
  const arr = defaultArr(song);
  const songKey = arr?.key || song?.key || 'C';
  const songTempo = arr?.tempo ?? song?.tempo;
  const arrCount = Array.isArray(song?.arrangements) ? song.arrangements.length : 1;
  const structure = Array.isArray(arr?.structure) ? arr.structure : [];

  // Field visibility — when no explicit set is passed, fall back to the legacy
  // behaviour (artist + key + tempo always; tags via showTags).
  const has = (id) => (fields ? fields.has(id) : (id === 'artist' || id === 'key' || id === 'tempo' || (id === 'tags' && showTags)));

  const lp = useLongPress(onLongPress);
  const handleClick = (e) => {
    if (lp.consumeClick()) return;             // a long-press already selected
    if (selectActive) { onToggleSelect?.(); return; }
    onClick?.(e);
  };

  if (variant === 'compact') {
    return (
      <div
        onClick={handleClick}
        {...(onLongPress ? lp.bind : {})}
        className={cn(
          'group relative flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer transition-[background-color,padding] duration-150 hover:bg-[var(--bg-2)] active:bg-[var(--bg-2)]',
          (selected || isSelected) && 'bg-[var(--ds-teal-100)] hover:bg-[var(--ds-teal-100)]',
          selectPad(selectable, selectActive),
        )}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {selectable && <SelectCircle active={selectActive} selected={isSelected} onToggle={onToggleSelect} label={`Select ${song.title || 'song'}`} />}
        {has('art') && <SongArt song={song} size="sm" />}
        <div className="min-w-0 flex-1">
          <span className="block text-copy-15 font-medium text-[var(--text-1)] truncate">
            {highlight ? <Highlight text={song.title} query={highlight} /> : (song.title || 'Untitled')}
          </span>
          {has('artist') && song.artist && (
            <span className="block text-label-12 text-[var(--text-2)] truncate">
              {highlight ? <Highlight text={song.artist} query={highlight} /> : song.artist}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {has('media') && <MediaIcons song={song} />}
          {arrCount > 1 && (
            <span className="text-label-11 text-[var(--text-2)] px-1.5 py-0.5 rounded border border-[var(--border-1)]">{arrCount}</span>
          )}
          {has('key') && <span className="text-label-12-mono text-[var(--chord)] font-semibold">{songKey}</span>}
          {has('tempo') && songTempo && <span className="text-label-12-mono text-[var(--text-2)]">{songTempo}</span>}
        </div>
      </div>
    );
  }

  if (variant === 'row') {
    const hasMap = has('songMap') && structure.length > 0;
    return (
      <div
        onClick={handleClick}
        {...(onLongPress ? lp.bind : {})}
        className={cn(
          "group relative flex items-center gap-3 px-5 py-4 cursor-pointer transition-[background-color,padding] duration-150 hover:bg-[var(--bg-2)]",
          (selected || isSelected) && "bg-[var(--ds-teal-100)] hover:bg-[var(--ds-teal-100)]",
          selectPad(selectable, selectActive),
        )}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {selectable && <SelectCircle active={selectActive} selected={isSelected} onToggle={onToggleSelect} label={`Select ${song.title || 'song'}`} />}
        {has('art') && <SongArt song={song} />}
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          {/* Title — spans the full width of the card. */}
          <span className="text-heading-16 text-[var(--text-1)] truncate">
            {highlight ? <Highlight text={song.title} query={highlight} /> : song.title}
          </span>
          {(has('artist') && song.artist) || arrCount > 1 || (has('tags') && song.tags?.length > 0) || has('media') ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {has('artist') && song.artist && (
                <span className="text-copy-14 text-[var(--color-brand)] truncate">
                  {highlight ? <Highlight text={song.artist} query={highlight} /> : song.artist}
                </span>
              )}
              {arrCount > 1 && (
                <span className="text-label-11 text-[var(--text-2)] px-2 py-0.5 rounded-md border border-[var(--border-1)] bg-[var(--bg-1)]">
                  {arrCount} arrangements
                </span>
              )}
              {has('tags') && song.tags?.length > 0 && song.tags.map(tag => (
                <span key={tag} className="text-label-11 text-[var(--text-2)] px-2 py-0.5 rounded-md border border-[var(--border-1)] bg-[var(--bg-1)]">{tag}</span>
              ))}
              {has('media') && <MediaIcons song={song} />}
            </div>
          ) : null}
          {/* Stats row — key · tempo · last edited on their own line. */}
          {(has('key') || has('tempo') || has('updated')) && (
            <div className="flex items-center gap-1.5 text-label-12-mono text-[var(--text-2)]">
              {has('key') && <span className="text-[var(--chord)] font-semibold">{songKey}</span>}
              {has('tempo') && (
                <>
                  {has('key') && <span className="text-[12px] opacity-50">•</span>}
                  <span>{songTempo ? `${songTempo} BPM` : 'No Tempo'}</span>
                </>
              )}
              {has('updated') && song.updatedAt && (
                <>
                  {(has('key') || has('tempo')) && <span className="text-[12px] opacity-50">•</span>}
                  <span className="text-label-12">{formatRelativeTime(song.updatedAt)}</span>
                </>
              )}
            </div>
          )}
          {hasMap && (
            <div className="mt-1 max-w-full">
              <StructureRibbon
                structure={structure}
                compact
                collapse
                style="codes"
                activeIndex={null}
                sectionColors={songMapSettings?.sectionColors}
                sectionLabels={songMapSettings?.sectionLabels}
                customSectionTypes={songMapSettings?.customSectionTypes}
              />
            </div>
          )}
        </div>
        {/* Quick edit — pointer devices only. On touch it sat under the right
            edge of the row and turned an ordinary tap into an accidental edit;
            phones/tablets edit from the song hub instead. Hover-reveal is gone:
            the button is always visible on a mouse, just quiet until hovered. */}
        {onEdit && !selectActive && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            aria-label="Edit song" title="Edit"
            className="hidden [@media(hover:hover)_and_(pointer:fine)]:flex absolute top-1/2 -translate-y-1/2 right-3 w-8 h-8 min-h-0 rounded-lg items-center justify-center border-none bg-[var(--bg-2)] text-[var(--text-2)] opacity-60 hover:opacity-100 hover:bg-[var(--modes-surface-strong)] hover:text-[var(--text-1)] transition-all cursor-pointer"
          >
            <EditGlyph />
          </button>
        )}
      </div>
    );
  }

  return (
    <Card onClick={onClick} className="cursor-pointer flex flex-col gap-2">
      <h3 className="text-heading-18 text-[var(--text-1)] m-0 leading-tight truncate">{song.title}</h3>
      <div className="flex items-center gap-2">
        <span className="text-label-12 text-[var(--text-2)] uppercase font-semibold">{song.key || 'C'}</span>
        <span className="text-[var(--text-2)] text-[12px] opacity-60">•</span>
        <span className="text-label-12 text-[var(--text-2)]">{song.tempo ? `${song.tempo} BPM` : 'No Tempo'}</span>
      </div>
      {song.artist && <p className="text-copy-14 text-[var(--text-2)] mt-1 line-clamp-1">{song.artist}</p>}
    </Card>
  );
}

// Memoized: the Library re-renders on every keystroke (search) and selection
// change, but a card's props only change when its own song/selection does.
export default React.memo(SongCard);
