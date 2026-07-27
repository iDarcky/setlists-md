import { useState } from 'react';
import { Button } from '@/ui/Button';

// Song metadata for the hub's Details tab. Read-only by default; when `onSave`
// is provided an inline **Edit** mode swaps the grid for a form and writes the
// changed song-level fields straight back (no jump to the full editor). Takes a
// *resolved* song view (see resolveSongView). Per-arrangement fields
// (key/tempo/time/capo) stay in the song editor.
//
// Owns its own scroll region and a card-bottom Save/Cancel bar (mirrors the
// song editor), so it fills the reader card it's mounted in.

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

  // Short scalar fields, grouped into labelled sections (read view).
  const groups = [
    { title: 'About', items: [
      ['Artist', song.artist],
      ['Original title', song.originaltitle],
      ['Album', song.album],
      ['Release year', song.year],
      ['Language', song.language],
      ['Translator', song.translator],
      ['Vocal range', song.vocalrange],
    ] },
    { title: 'Arrangement', items: [
      ['Tempo', song.tempo ? `${song.tempo} bpm` : ''],
      ['Time', song.time],
      ['Capo', song.capo > 0 ? String(song.capo) : ''],
    ] },
    { title: 'Credits & rights', items: [
      ['Writers', song.writers],
      ['Publishers', song.publishers],
      ['Label', song.label],
      ['CCLI', song.ccli],
      ['Copyright', song.copyright],
    ] },
    { title: 'Classification', items: [
      ['Themes', song.themes],
      ['Genres', song.genres],
      ['Bible verses', song.scripture],
      ['Liturgical moment', song.moment],
    ] },
  ].map(g => ({ ...g, items: g.items.filter(([, v]) => v) })).filter(g => g.items.length > 0);

  const tags = song.tags || [];
  const links = [
    song.spotify && { label: 'Spotify', url: song.spotify },
    song.youtube && { label: 'YouTube', url: song.youtube },
  ].filter(Boolean);
  const longFields = LONG.map(({ k, label }) => ({ label, value: song[k] })).filter(f => f.value);
  const keyPlays = Object.entries(song.keyHistory || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  const isEmpty = groups.length === 0 && tags.length === 0 && links.length === 0
    && longFields.length === 0 && keyPlays.length === 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-6">
        {editing ? (
          <div className="flex flex-col gap-6">
            <h2 className="m-0 text-heading-16 font-semibold text-[var(--text-1)]">Edit details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
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
        ) : (
          <div className="flex flex-col gap-8">
            <div className="flex items-baseline gap-3">
              <h2 className="m-0 text-heading-16 font-semibold text-[var(--text-1)]">Details</h2>
              {onSave && (
                <button type="button" onClick={startEdit}
                  className="bg-transparent border-none p-0 text-label-12 font-semibold uppercase tracking-wide text-[var(--color-brand-text)] hover:underline cursor-pointer">
                  Edit
                </button>
              )}
            </div>

            {isEmpty ? (
              <p className="text-copy-14 text-[var(--text-2)] italic m-0">No additional song info yet. Use Edit to add artist, themes, links and more.</p>
            ) : (
              <>
                {groups.map(g => (
                  <section key={g.title} className="flex flex-col gap-3">
                    <SectionTitle>{g.title}</SectionTitle>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
                      {g.items.map(([label, value]) => <Item key={label} label={label} value={value} />)}
                    </div>
                  </section>
                ))}

                {tags.length > 0 && (
                  <section className="flex flex-col gap-3">
                    <SectionTitle>Tags</SectionTitle>
                    <div className="flex flex-wrap gap-2">
                      {tags.map(t => (
                        <span key={t} className="inline-flex items-center h-7 px-3 rounded-full border border-[var(--border-1)] bg-[var(--bg-1)] text-label-12 font-medium text-[var(--text-1)]">{t}</span>
                      ))}
                    </div>
                  </section>
                )}

                {longFields.map(f => (
                  <section key={f.label} className="flex flex-col gap-2">
                    <SectionTitle>{f.label}</SectionTitle>
                    <p className="m-0 text-copy-14 leading-relaxed text-[var(--text-1)] whitespace-pre-wrap">{f.value}</p>
                  </section>
                ))}

                {links.length > 0 && (
                  <section className="flex flex-col gap-3">
                    <SectionTitle>Listen</SectionTitle>
                    <div className="flex flex-wrap gap-2">
                      {links.map(l => (
                        <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)] text-label-13 font-medium text-[var(--text-1)] hover:bg-[var(--bg-2)]">
                          {l.label} <span aria-hidden="true" className="text-[var(--text-2)]">↗</span>
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                {keyPlays.length > 0 && (
                  <section className="flex flex-col gap-3">
                    <SectionTitle>Key history</SectionTitle>
                    <div className="flex flex-wrap gap-1.5">
                      {keyPlays.map(([k, n]) => (
                        <span key={k} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-[var(--border-1)] bg-[var(--bg-1)] text-label-12">
                          <span className="font-mono font-semibold text-[var(--text-1)]">{k}</span>
                          <span className="text-[var(--text-2)]">{n}×</span>
                        </span>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Card-bottom action bar — mirrors the song editor's sticky Save/Cancel. */}
      {editing && (
        <div
          className="shrink-0 border-t border-[var(--border-1)] w-full"
          style={{ background: 'var(--header-bg-blur)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        >
          <div className="px-5 py-3 flex items-center justify-end gap-3">
            <Button variant="ghost" size="md" onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="brand" size="md" onClick={save}>Save</Button>
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

function SectionTitle({ children }) {
  return <h3 className="m-0 text-label-11 uppercase tracking-wider font-semibold text-[var(--text-2)]">{children}</h3>;
}

function Item({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-label-11 uppercase tracking-wide text-[var(--text-2)]">{label}</span>
      <span className="text-copy-14 text-[var(--text-1)] break-words">{value}</span>
    </div>
  );
}
