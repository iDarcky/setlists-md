// Read-only song metadata grid. Extracted from ChartView's inline info panel so
// the Song Hub's Details tab and the chart's title-chevron disclosure share one
// renderer. Takes a *resolved* song view (see resolveSongView) — the flat shape
// with artist/ccli/tags/themes/links/notes/etc.
export default function SongDetails({ song }) {
  if (!song) return null;

  const hasMetadata = !!song.artist || song.capo > 0 || !!song.ccli || (song.tags?.length > 0) || !!song.notes || !!song.spotify || !!song.youtube
    || !!song.originaltitle || !!song.language || !!song.translator || !!song.vocalrange || !!song.year
    || !!song.writers || !!song.publishers || !!song.album || !!song.label || !!song.copyright
    || !!song.themes || !!song.genres || !!song.scripture || !!song.moment || !!song.story;

  if (!hasMetadata) {
    return <p className="text-copy-14 text-[var(--text-2)] italic m-0">No additional song info yet. Use Edit to add artist, themes, links and more.</p>;
  }

  return (
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
