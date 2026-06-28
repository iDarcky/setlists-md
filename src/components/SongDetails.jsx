import { useState } from 'react';

// Song metadata for the hub's Details tab. Read-only by default; when `onSave`
// is provided an inline **Edit** mode swaps the grid for a form and writes the
// changed song-level fields straight back (no jump to the full editor). Takes a
// *resolved* song view (see resolveSongView). Per-arrangement fields
// (key/tempo/time/capo) stay in the song editor.

// Editable song-level text fields.
const FIELDS = [
  { k: 'artist', label: 'Artist' },
  { k: 'originaltitle', label: 'Original title' },
  { k: 'language', label: 'Language' },
  { k: 'translator', label: 'Translator' },
  { k: 'vocalrange', label: 'Vocal range' },
  { k: 'year', label: 'Release year' },
  { k: 'writers', label: 'Writers' },
  { k: 'publishers', label: 'Publishers' },
  { k: 'album', label: 'Album' },
  { k: 'label', label: 'Label' },
  { k: 'ccli', label: 'CCLI' },
  { k: 'copyright', label: 'Copyright' },
  { k: 'themes', label: 'Themes' },
  { k: 'genres', label: 'Genres' },
  { k: 'scripture', label: 'Bible verses' },
  { k: 'moment', label: 'Liturgical moment' },
  { k: 'spotify', label: 'Spotify link' },
  { k: 'youtube', label: 'YouTube link' },
];
const LONG = [
  { k: 'story', label: 'Story behind' },
  { k: 'notes', label: 'Notes' },
];

export default function SongDetails({ song, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  if (!song) return null;

  const startEdit = () => {
    const seed = {};
    [...FIELDS, ...LONG].forEach(({ k }) => { seed[k] = song[k] || ''; });
    seed.tags = (song.tags || []).join(', ');
    setForm(seed);
    setEditing(true);
  };
  const save = () => {
    const patch = {};
    [...FIELDS, ...LONG].forEach(({ k }) => { patch[k] = (form[k] || '').trim(); });
    patch.tags = (form.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    onSave?.(patch);
    setEditing(false);
  };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (editing) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-heading-16 font-semibold text-[var(--text-1)]">Edit details</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEditing(false)}
              className="h-8 px-3 rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)] text-label-13 text-[var(--text-1)] hover:bg-[var(--bg-2)] cursor-pointer">Cancel</button>
            <button type="button" onClick={save}
              className="h-8 px-3 rounded-lg text-label-13 font-semibold cursor-pointer hover:opacity-90" style={{ background: 'var(--color-brand)', color: '#fff' }}>Save</button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {FIELDS.map(({ k, label }) => (
            <Field key={k} label={label}>
              <input value={form[k] ?? ''} onChange={e => set(k, e.target.value)} className={inputCls} />
            </Field>
          ))}
          <Field label="Tags" hint="comma-separated">
            <input value={form.tags ?? ''} onChange={e => set('tags', e.target.value)} className={inputCls} placeholder="worship, fast" />
          </Field>
        </div>
        <div className="flex flex-col gap-3">
          {LONG.map(({ k, label }) => (
            <Field key={k} label={label}>
              <textarea value={form[k] ?? ''} onChange={e => set(k, e.target.value)} rows={k === 'story' ? 4 : 3} className={textareaCls} />
            </Field>
          ))}
        </div>
      </div>
    );
  }

  const hasMetadata = !!song.artist || song.capo > 0 || !!song.ccli || (song.tags?.length > 0) || !!song.notes || !!song.spotify || !!song.youtube
    || !!song.originaltitle || !!song.language || !!song.translator || !!song.vocalrange || !!song.year
    || !!song.writers || !!song.publishers || !!song.album || !!song.label || !!song.copyright
    || !!song.themes || !!song.genres || !!song.scripture || !!song.moment || !!song.story;

  const keyPlays = Object.entries(song.keyHistory || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-5">
      {onSave && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-heading-16 font-semibold text-[var(--text-1)]">Details</h2>
          <button type="button" onClick={startEdit}
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

const inputCls = 'w-full h-9 px-3 rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)] text-copy-14 text-[var(--text-1)] outline-none focus:border-[var(--border-3)]';
const textareaCls = 'w-full px-3 py-2 rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)] text-copy-14 text-[var(--text-1)] outline-none focus:border-[var(--border-3)] resize-y';

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-label-12 font-semibold text-[var(--text-2)]">
        {label}{hint && <span className="ml-1.5 font-normal lowercase tracking-normal opacity-70">{hint}</span>}
      </span>
      {children}
    </label>
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
