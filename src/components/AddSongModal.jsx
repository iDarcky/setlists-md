import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import Highlight from '@/ui/Highlight';
import { searchSongs } from '@/lib/search';
import { searchCatalog, fetchFeatured, fetchCatalogSong, CATALOG_IS_REMOTE } from '@/lib/catalog';
import { parseImportFiles, IMPORT_ACCEPT } from '@/lib/importFiles';
import MobileSheet, { SheetGroup, SheetGroupLabel, SheetRow, SheetChevron } from '@/ui/MobileSheet';

// Add a song. One surface: a search field over the public-domain catalog, with
// Import and Blank as doors underneath. Typing replaces the doors with results;
// clearing the field brings them back.
//
// Deliberate choices, in case they look like omissions:
//   · No tabs. The old modal hid Browse behind one and exiled Blank to a footer.
//   · No second modal for import — the whole sheet is a drop target on desktop,
//     and on mobile the Import door opens the OS document picker directly
//     (there is no drag and drop on a phone to justify a drop zone).
//   · The catalog is never cached. It is a network resource by design, so the
//     browse section degrades on its own while Import and Blank stay usable.

const MOBILE_QUERY = '(max-width: 639px)';
const SEARCH_DEBOUNCE_MS = 250;

function subscribeMobile(cb) {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}
function useIsMobile() {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

function subscribeOnline(cb) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}
function useIsOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function ImportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function BlankIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function NoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  );
}

// A "door" — one of the two non-search ways in.
function Door({ icon, title, desc, onClick, compact }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex-1 text-left rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] cursor-pointer transition-all hover:border-[var(--color-brand-border)] hover:bg-[var(--ds-gray-100)] ${compact ? 'p-3' : 'p-4'}`}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 bg-[var(--ds-gray-200)] text-[var(--ds-gray-700)] group-hover:text-[var(--color-brand-text)]">
        {icon}
      </div>
      <div className="text-copy-14 font-semibold text-[var(--ds-gray-1000)]">{title}</div>
      <div className="text-copy-12 text-[var(--ds-gray-600)] mt-0.5 leading-snug">{desc}</div>
    </button>
  );
}

// One result row. `kind` drives the trailing action label only — the rows are
// otherwise identical so the eye can scan one column of titles.
function ResultRow({ title, subtitle, songKey, query, action, onClick, disabled, busy }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="group w-full flex items-center gap-3 text-left rounded-xl border border-transparent p-2.5 cursor-pointer transition-all hover:border-[var(--color-brand-border)] hover:bg-[var(--ds-gray-100)] disabled:opacity-50 disabled:cursor-default"
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[var(--ds-gray-200)] text-[var(--ds-gray-600)]">
        <NoteIcon />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-copy-14 font-semibold text-[var(--ds-gray-1000)] truncate">
          <Highlight text={title} query={query} />
        </div>
        {subtitle && <div className="text-copy-12 text-[var(--ds-gray-600)] truncate">{subtitle}</div>}
      </div>
      {songKey && (
        <span className="shrink-0 text-label-11 font-mono px-1.5 py-0.5 rounded border border-[var(--ds-gray-400)] text-[var(--chord)]">
          {songKey}
        </span>
      )}
      <span className="shrink-0 text-label-11 font-semibold text-[var(--ds-gray-500)] group-hover:text-[var(--color-brand-text)]">
        {busy ? 'Adding…' : action}
      </span>
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="text-label-11 uppercase tracking-wider text-[var(--ds-gray-500)] px-2.5 pt-1 pb-1.5">
      {children}
    </div>
  );
}

// Mobile result row. Same information as ResultRow, but drawn in the sheet's
// palette and shaped as a grouped-list row so it matches the account panel.
function SheetResultRow({ title, subtitle, songKey, query, action, onClick, disabled, busy, first }) {
  return (
    <SheetRow first={first} onClick={onClick} disabled={disabled || busy}>
      <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[var(--drawer-surface-hover)] text-[var(--drawer-text-muted)]">
        <NoteIcon />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-copy-15 font-semibold text-[var(--drawer-text)] truncate">
          <Highlight text={title} query={query} />
        </span>
        {subtitle && <span className="block text-label-12 text-[var(--drawer-text-muted)] truncate">{subtitle}</span>}
      </span>
      {songKey && (
        <span className="shrink-0 text-label-11 font-mono px-1.5 py-0.5 rounded border border-[var(--drawer-border)] text-[var(--chord)]">
          {songKey}
        </span>
      )}
      <span className="shrink-0 text-label-11 font-semibold text-[var(--drawer-text-dim)]">
        {busy ? 'Adding…' : action}
      </span>
    </SheetRow>
  );
}

// A one-line status inside a sheet group (searching / offline / no matches).
function SheetNote({ children, tone }) {
  return (
    <div
      className="px-3.5 py-3.5 text-copy-13"
      style={{ color: tone === 'error' ? 'var(--ds-red-1000)' : 'var(--drawer-text-muted)' }}
    >
      {children}
    </div>
  );
}

export default function AddSongModal({
  onClose,
  onStartBlank,
  onImportSongs,
  onImportSetlistFile,
  onAddCatalogSong,
  onOpenSong,
  songs = [],
  autoOpenPicker = false,
}) {
  const isMobile = useIsMobile();
  const isOnline = useIsOnline();
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const dragDepth = useRef(0);
  const pickerOpened = useRef(false);

  const [query, setQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [addingSlug, setAddingSlug] = useState(null);

  const [featured, setFeatured] = useState([]);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  // The catalog only needs a connection once it actually lives on a server.
  const catalogOffline = CATALOG_IS_REMOTE && !isOnline;

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Desktop autofocuses the field; on mobile that would throw the keyboard up
  // over the doors before the user has decided what they want.
  useEffect(() => {
    if (!isMobile) inputRef.current?.focus();
  }, [isMobile]);

  const openPicker = useCallback(() => {
    setImportError('');
    fileRef.current?.click();
  }, []);

  // Only an entry point that asked for import BY NAME (the editor's empty-state
  // Import button) goes straight to the picker. Opening the modal from a +
  // button must never pop a file dialog the user didn't ask for.
  useEffect(() => {
    if (autoOpenPicker && !pickerOpened.current) {
      pickerOpened.current = true;
      openPicker();
    }
  }, [autoOpenPicker, openPicker]);

  // Idle list. Curated, not measured — see the catalog plan.
  useEffect(() => {
    if (catalogOffline) return undefined;
    const ac = new AbortController();
    fetchFeatured({ signal: ac.signal })
      .then(rows => { if (!ac.signal.aborted) setFeatured(rows); })
      .catch(() => { /* the idle list is optional; stay quiet */ });
    return () => ac.abort();
  }, [catalogOffline]);

  // Debounced, cancellable catalog search. Local search was instant and free;
  // once this is a network round-trip every keystroke must abort the last one.
  useEffect(() => {
    if (!hasQuery || catalogOffline) {
      setResults([]);
      setSearching(false);
      setSearchFailed(false);
      return undefined;
    }
    const ac = new AbortController();
    setSearching(true);
    setSearchFailed(false);
    const t = setTimeout(() => {
      searchCatalog(trimmed, { signal: ac.signal })
        .then(rows => {
          if (ac.signal.aborted) return;
          setResults(rows);
          setSearching(false);
        })
        .catch(err => {
          if (ac.signal.aborted || err?.name === 'AbortError') return;
          setSearchFailed(true);
          setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => { clearTimeout(t); ac.abort(); };
  }, [trimmed, hasQuery, catalogOffline]);

  // Your own songs rank above the catalog, so "do I already have this?" is
  // answered in the same list as "can I get it?".
  const libraryHits = useMemo(
    () => (hasQuery ? searchSongs(songs, trimmed, { limit: 3 }) : []),
    [songs, trimmed, hasQuery],
  );

  const handleFiles = useCallback(async (fileList) => {
    setImportError('');
    setImporting(true);
    try {
      const { songs: parsed, setlistFile, error } = await parseImportFiles(fileList);
      if (setlistFile) { onImportSetlistFile(setlistFile); return; }
      if (error && parsed.length === 0) { setImportError(error); return; }
      if (error) setImportError(error);
      if (parsed.length > 0) onImportSongs(parsed);
    } catch {
      setImportError('Could not read one or more files.');
    } finally {
      setImporting(false);
    }
  }, [onImportSongs, onImportSetlistFile]);

  const handleAdd = useCallback(async (entry) => {
    setAddingSlug(entry.slug);
    try {
      const md = await fetchCatalogSong(entry);
      onAddCatalogSong(md, entry);
    } catch {
      setImportError(`Could not download "${entry.title}". Check your connection and try again.`);
      setAddingSlug(null);
    }
  }, [onAddCatalogSong]);

  // Drag state is depth-counted: dragleave fires for every child element the
  // pointer crosses, so a naive boolean flickers the overlay.
  const onDragEnter = (e) => {
    if (isMobile) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  };
  const onDragLeave = (e) => {
    if (isMobile) return;
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  };
  const onDrop = (e) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const sheetClass = 'w-full max-w-[680px] rounded-2xl max-h-[86vh]';

  const showEmptyResults = hasQuery && !searching && !searchFailed
    && results.length === 0 && libraryHits.length === 0;

  const fileInputEl = (
    <input
      ref={fileRef}
      type="file"
      accept={IMPORT_ACCEPT}
      multiple
      onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      className="hidden"
    />
  );

  // ── Mobile: the app's standard bottom sheet, same shell as the account panel.
  if (isMobile) {
    return (
      <MobileSheet
        open
        onClose={onClose}
        title="Add a song"
        headerExtra={(
          <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-[var(--drawer-surface)] border border-[var(--drawer-border)] px-3.5 py-2.5 focus-within:border-[var(--drawer-text-dim)] transition-colors">
            <span className="text-[var(--drawer-text-dim)] shrink-0"><SearchIcon /></span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search public-domain songs…"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-copy-15 text-[var(--drawer-text)] placeholder:text-[var(--drawer-text-dim)]"
              aria-label="Search songs to add"
            />
            {hasQuery && (
              <button
                type="button"
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                aria-label="Clear search"
                className="shrink-0 w-6 h-6 min-h-0 rounded-full flex items-center justify-center bg-[var(--drawer-surface-hover)] text-[var(--drawer-text-muted)] border-none cursor-pointer"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                ✕
              </button>
            )}
          </div>
        )}
      >
        <div className="flex flex-col gap-5 pt-1 pb-2">
          {hasQuery ? (
            <>
              {libraryHits.length > 0 && (
                <div>
                  <SheetGroupLabel>In your library</SheetGroupLabel>
                  <SheetGroup>
                    {libraryHits.map((s, i) => (
                      <SheetResultRow
                        key={s.id}
                        first={i === 0}
                        title={s.title}
                        subtitle={s.artist || 'Your library'}
                        query={trimmed}
                        action="Open"
                        onClick={() => onOpenSong?.(s)}
                      />
                    ))}
                  </SheetGroup>
                </div>
              )}

              <div>
                <SheetGroupLabel>Public domain</SheetGroupLabel>
                <SheetGroup>
                  {catalogOffline && (
                    <SheetNote>Searching the catalog needs a connection. Import and blank songs still work offline.</SheetNote>
                  )}
                  {!catalogOffline && searching && <SheetNote>Searching…</SheetNote>}
                  {!catalogOffline && searchFailed && (
                    <SheetNote tone="error">Couldn't reach the catalog. Check your connection and try again.</SheetNote>
                  )}
                  {!catalogOffline && !searching && !searchFailed && results.map((entry, i) => (
                    <SheetResultRow
                      key={entry.id}
                      first={i === 0}
                      title={entry.title}
                      subtitle={[entry.author, entry.year, entry.language === 'ro' ? 'Română' : null]
                        .filter(Boolean).join(' · ')}
                      songKey={entry.key}
                      query={trimmed}
                      action="Add"
                      busy={addingSlug === entry.slug}
                      disabled={addingSlug != null}
                      onClick={() => handleAdd(entry)}
                    />
                  ))}
                  {!catalogOffline && !searching && !searchFailed && results.length === 0 && (
                    <SheetNote>Nothing in the catalog matches “{trimmed}”.</SheetNote>
                  )}
                </SheetGroup>
              </div>

              {showEmptyResults && (
                <SheetGroup>
                  <SheetRow first onClick={openPicker}>
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[var(--drawer-surface-hover)] text-[var(--drawer-text-muted)]"><ImportIcon /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-copy-15 font-semibold text-[var(--drawer-text)]">Import a file</span>
                      <span className="block text-label-12 text-[var(--drawer-text-muted)] truncate">ChordPro, OpenSong, PDF, .md or .zip</span>
                    </span>
                    <SheetChevron />
                  </SheetRow>
                  <SheetRow onClick={() => onStartBlank(trimmed)}>
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[var(--drawer-surface-hover)] text-[var(--drawer-text-muted)]"><BlankIcon /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-copy-15 font-semibold text-[var(--drawer-text)] truncate">Write “{trimmed}”</span>
                      <span className="block text-label-12 text-[var(--drawer-text-muted)]">Start this song from scratch</span>
                    </span>
                    <SheetChevron />
                  </SheetRow>
                </SheetGroup>
              )}
            </>
          ) : (
            <>
              <SheetGroup>
                <SheetRow first onClick={openPicker}>
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[var(--drawer-surface-hover)] text-[var(--drawer-text-muted)]"><ImportIcon /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-copy-15 font-semibold text-[var(--drawer-text)]">Import a file</span>
                    <span className="block text-label-12 text-[var(--drawer-text-muted)] truncate">ChordPro, OpenSong, PDF, .md or .zip</span>
                  </span>
                  <SheetChevron />
                </SheetRow>
                <SheetRow onClick={() => onStartBlank('')}>
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[var(--drawer-surface-hover)] text-[var(--drawer-text-muted)]"><BlankIcon /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-copy-15 font-semibold text-[var(--drawer-text)]">Blank song</span>
                    <span className="block text-label-12 text-[var(--drawer-text-muted)]">Write it, or paste a chord sheet</span>
                  </span>
                  <SheetChevron />
                </SheetRow>
              </SheetGroup>

              {featured.length > 0 && !catalogOffline && (
                <div>
                  <SheetGroupLabel>Start here</SheetGroupLabel>
                  <SheetGroup>
                    {featured.map((entry, i) => (
                      <SheetResultRow
                        key={entry.id}
                        first={i === 0}
                        title={entry.title}
                        subtitle={[entry.author, entry.year].filter(Boolean).join(' · ') || 'Public domain'}
                        songKey={entry.key}
                        action="Add"
                        busy={addingSlug === entry.slug}
                        disabled={addingSlug != null}
                        onClick={() => handleAdd(entry)}
                      />
                    ))}
                  </SheetGroup>
                </div>
              )}

              <p className="text-label-11 text-[var(--drawer-text-dim)] m-0 leading-relaxed px-1">
                Importing? You're responsible for having a licence to copy the content
                (CCLI, SongSelect, PraiseCharts, or your own material).
              </p>
            </>
          )}

          {importError && <p className="text-copy-13 m-0 px-1" style={{ color: 'var(--ds-red-1000)' }}>{importError}</p>}
          {importing && <p className="text-copy-13 m-0 px-1 text-[var(--drawer-text-muted)]">Reading files…</p>}
        </div>
        {fileInputEl}
      </MobileSheet>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`relative bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] flex flex-col ${sheetClass}`}
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        <div className="flex items-start gap-2 px-5 pt-4 pb-3">
          <div className="flex-1">
            <div className="text-heading-16 text-[var(--ds-gray-1000)]">Add a song</div>
            <div className="text-copy-12 text-[var(--ds-gray-600)] mt-0.5">
              Search the public-domain catalog, or bring your own.
            </div>
          </div>
          <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</IconButton>
        </div>

        {/* Search — always visible, never behind a tab. */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-3.5 py-3 focus-within:border-[var(--color-brand)] transition-colors">
            <span className="text-[var(--ds-gray-600)] shrink-0"><SearchIcon /></span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search hymns and public-domain songs…"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-copy-14 text-[var(--ds-gray-1000)] placeholder:text-[var(--ds-gray-500)]"
              aria-label="Search songs to add"
            />
            {hasQuery && (
              <button
                type="button"
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                className="shrink-0 text-label-11 text-[var(--ds-gray-500)] hover:text-[var(--ds-gray-1000)] cursor-pointer bg-transparent border-0"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 flex flex-col gap-4">
          {hasQuery ? (
            <>
              {libraryHits.length > 0 && (
                <div>
                  <SectionLabel>In your library</SectionLabel>
                  {libraryHits.map(s => (
                    <ResultRow
                      key={s.id}
                      title={s.title}
                      subtitle={s.artist || 'Your library'}
                      query={trimmed}
                      action="Open"
                      onClick={() => onOpenSong?.(s)}
                    />
                  ))}
                </div>
              )}

              <div>
                <SectionLabel>Public domain</SectionLabel>
                {catalogOffline && (
                  <p className="text-copy-13 text-[var(--ds-gray-600)] m-0 px-2.5 py-4">
                    Searching the catalog needs a connection. Import and blank songs still work offline.
                  </p>
                )}
                {!catalogOffline && searching && (
                  <p className="text-copy-13 text-[var(--ds-gray-600)] m-0 px-2.5 py-4">Searching…</p>
                )}
                {!catalogOffline && searchFailed && (
                  <p className="text-copy-13 m-0 px-2.5 py-4" style={{ color: 'var(--ds-red-1000)' }}>
                    Couldn't reach the catalog. Check your connection and try again.
                  </p>
                )}
                {!catalogOffline && !searching && !searchFailed && results.map(entry => (
                  <ResultRow
                    key={entry.id}
                    title={entry.title}
                    subtitle={[entry.author, entry.year, entry.language === 'ro' ? 'Română' : null]
                      .filter(Boolean).join(' · ')}
                    songKey={entry.key}
                    query={trimmed}
                    action="Add"
                    busy={addingSlug === entry.slug}
                    disabled={addingSlug != null}
                    onClick={() => handleAdd(entry)}
                  />
                ))}
                {!catalogOffline && !searching && !searchFailed && results.length === 0 && (
                  <p className="text-copy-13 text-[var(--ds-gray-600)] italic m-0 px-2.5 py-4">
                    Nothing in the catalog matches “{trimmed}”.
                  </p>
                )}
              </div>

              {showEmptyResults && (
                <div className="flex gap-2.5">
                  <Door compact icon={<ImportIcon />} title="Import a file" desc="ChordPro · OpenSong · .md · .zip" onClick={openPicker} />
                  <Door compact icon={<BlankIcon />} title={`Write “${trimmed}”`} desc="Start this song from scratch" onClick={() => onStartBlank(trimmed)} />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex gap-2.5">
                <Door
                  icon={<ImportIcon />}
                  title="Import a file"
                  desc="Drop one anywhere, or choose a file"
                  onClick={openPicker}
                />
                <Door
                  icon={<BlankIcon />}
                  title="Blank song"
                  desc="Write it, or paste a chord sheet"
                  onClick={() => onStartBlank('')}
                />
              </div>

              <p className="text-label-11 text-[var(--ds-gray-600)] m-0 leading-relaxed">
                Importing? You're responsible for having a licence to copy the content
                (CCLI, SongSelect, PraiseCharts, or your own material).
              </p>

              {featured.length > 0 && !catalogOffline && (
                <div>
                  <SectionLabel>Start here</SectionLabel>
                  {featured.map(entry => (
                    <ResultRow
                      key={entry.id}
                      title={entry.title}
                      subtitle={[entry.author, entry.year].filter(Boolean).join(' · ') || 'Public domain'}
                      songKey={entry.key}
                      action="Add"
                      busy={addingSlug === entry.slug}
                      disabled={addingSlug != null}
                      onClick={() => handleAdd(entry)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {importError && (
            <div className="text-copy-13" style={{ color: 'var(--ds-red-1000)' }}>{importError}</div>
          )}
          {importing && (
            <div className="text-copy-13 text-[var(--ds-gray-600)]">Reading files…</div>
          )}
        </div>

        {/* Desktop drag target covers the whole sheet — people aim badly, and a
            200px dashed rectangle punishes them for it. */}
        {dragOver && (
          <div
            className="absolute inset-0 z-10 rounded-2xl flex flex-col items-center justify-center pointer-events-none"
            style={{ background: 'var(--color-brand-soft)', border: '2px dashed var(--color-brand)' }}
          >
            <div className="text-heading-16 text-[var(--ds-gray-1000)]">Drop to import</div>
            <div className="text-copy-13 text-[var(--ds-gray-700)] mt-1">
              ChordPro, OpenSong .xml, PDF, .md, or a .zip bundle
            </div>
          </div>
        )}

        {fileInputEl}
      </div>
    </div>
  );
}
