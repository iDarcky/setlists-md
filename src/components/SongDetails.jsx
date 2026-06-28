// Read-only song metadata. Extracted from ChartView's inline info panel so the
// Song Hub's Details tab and the chart's title-chevron disclosure share one
// renderer. Takes a *resolved* song view (see resolveSongView) — the flat shape
// with artist/ccli/tags/themes/links/notes/keyHistory/etc. `onEdit` (Hub only)
// renders an Edit affordance that jumps to the editor.
export default function SongDetails({ song, onEdit }) {
  if (!song) return null;

  const hasMetadata = !!song.artist || song.capo > 0 || !!song.ccli || (song.tags?.length > 0) || !!song.notes || !!song.spotify || !!song.youtube
    || !!song.originaltitle || !!song.language || !!song.translator || !!song.vocalrange || !!song.year
    || !!song.writers || !!song.publishers || !!song.album || !!song.label || !!song.copyright
    || !!song.themes || !!song.genres || !!song.scripture || !!song.moment || !!song.story;

  // keyHistory is a { key: playCount } map — surface the keys this song has been
  // played in, most-played first.
  const keyPlays = Object.entries(song.keyHistory || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-5">
      {onEdit && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-heading-16 font-semibold text-[var(--text-1)]">Details</h2>
          <button type="button" onClick={onEdit}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)] text-label-13 font-medium text-[var(--text-1)] hover:bg-[var(--bg-2)] cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            Edit
          </button>
        </div>
      )}

      {!hasMetadata && keyPlays.length === 0 ? (
        <p className="text-copy-14 text-[var(--text-2)] italic m-0">No additional song info yet. Use Edit to add artist, themes, links and more.</p>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-copy-13 m-0">
      {song.artist && <InfoRow label="Artist">{song.artist}</InfoRow>}
      {song.originaltitle && <InfoRow label="Original title">{song.originaltitle}</InfoRow>}
      {song.language && <InfoRow label="Language">{song.language}</InfoRow>}
      {song.translator && <InfoRow label="Translator">{song.translator}</InfoRow>}
      {song.tempo && <InfoRow label="Tempo">{song.tempo} bpm</InfoRow>}
      {song.time && <InfoRow label="Time">{song.time}</InfoRow>}
      {song.capo > 0 && <InfoRow label="Capo">{song.capo}</InfoRow>}
      {song.vocalrange && <InfoRow label="Vocal range">{song.vocalrange}</InfoRow>}
      {song.year && <InfoRow label="Release year">{song.year}</InfoRow>}
      {song.writers && <InfoRow label="Writers">{song.writers}</InfoRow>}
      {song.publishers && <InfoRow label="Publishers">{song.publishers}</InfoRow>}
      {song.album && <InfoRow label="Album">{song.album}</InfoRow>}
      {song.label && <InfoRow label="Label">{song.label}</InfoRow>}
      {song.ccli && <InfoRow label="CCLI">{song.ccli}</InfoRow>}
      {song.copyright && <InfoRow label="Copyright">{song.copyright}</InfoRow>}
      {song.themes && <InfoRow label="Themes">{song.themes}</InfoRow>}
      {song.genres && <InfoRow label="Genres">{song.genres}</InfoRow>}
      {song.scripture && <InfoRow label="Bible verses">{song.scripture}</InfoRow>}
      {song.moment && <InfoRow label="Liturgical moment">{song.moment}</InfoRow>}
      {song.tags?.length > 0 && <InfoRow label="Tags">{song.tags.join(', ')}</InfoRow>}
      {song.story && <InfoRow label="Story behind"><span className="whitespace-pre-wrap">{song.story}</span></InfoRow>}
      {song.notes && <InfoRow label="Notes"><span className="whitespace-pre-wrap">{song.notes}</span></InfoRow>}
      {song.spotify && <InfoRow label="Spotify"><a href={song.spotify} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand-text)] hover:underline">Open ↗</a></InfoRow>}
      {song.youtube && <InfoRow label="YouTube"><a href={song.youtube} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand-text)] hover:underline">Open ↗</a></InfoRow>}
        </dl>
      )}

      {keyPlays.length > 0 && (
        <div>
          <h3 className="m-0 mb-2 text-label-11 uppercase tracking-wider text-[var(--text-2)]">Key history</h3>
          <div className="flex flex-wrap gap-1.5">
            {keyPlays.map(([k, n]) => (
              <span key={k} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)] text-label-12">
                <span className="font-mono font-semibold text-[var(--text-1)]">{k}</span>
                <span className="text-[var(--text-2)]">{n}×</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex gap-2 min-w-0">
      <dt className="w-24 shrink-0 text-label-12 font-semibold text-[var(--text-2)] leading-tight pt-0.5">{label}</dt>
      <dd className="flex-1 min-w-0 m-0 text-[var(--text-1)] break-words">{children}</dd>
    </div>
  );
}
