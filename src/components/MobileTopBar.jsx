import React, { useEffect, useMemo, useRef, useState } from 'react';
import SongCard from './SongCard';
import { workspaceStatusLabel } from '../billing/checkout';

const HamburgerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="17" x2="21" y2="17" />
  </svg>
);
const ChevronIcon = ({ open }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const TeamGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function WorkspaceBadge({ workspace, size = 22 }) {
  const isPersonal = workspace?.id === 'personal';
  return (
    <span
      className="rounded-full bg-[var(--ds-gray-300)] flex items-center justify-center shrink-0 overflow-hidden text-[var(--ds-gray-700)]"
      style={{ width: size, height: size }}
    >
      {workspace?.avatarUrl
        ? <img src={workspace.avatarUrl} alt="" className="w-full h-full object-cover" />
        : isPersonal
          ? <span className="text-label-12 font-bold">{(workspace?.name || 'P').charAt(0).toUpperCase()}</span>
          : <TeamGlyph />}
    </span>
  );
}

export default function MobileTopBar({
  view,
  songs,
  setlists,
  onOpenDrawer,
  onSelectSong,
  onSelectSetlist,
  activeLibrary = 'personal',
  workspaces = [],
  setActiveLibrary,
  onNewWorkspace,
  newWorkspaceLocked = false,
  supportContact,
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);
  const inputRef = useRef(null);
  const avatarBtnRef = useRef(null);
  const menuRef = useRef(null);
  const containerRef = useRef(null);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return { songs: [], setlists: [] };
    const matchedSongs = songs
      .filter(s =>
        s.title?.toLowerCase().includes(q) ||
        s.artist?.toLowerCase().includes(q) ||
        (s.tags || []).some(t => t.toLowerCase().includes(q))
      )
      .slice(0, 6);
    const matchedSetlists = setlists
      .filter(sl =>
        (sl.name || '').toLowerCase().includes(q) ||
        (sl.service || '').toLowerCase().includes(q) ||
        (sl.tags || []).some(t => t.toLowerCase().includes(q))
      )
      .slice(0, 4);
    return { songs: matchedSongs, setlists: matchedSetlists };
  }, [q, songs, setlists]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setFocused(false);
      const inAvatar = avatarBtnRef.current && avatarBtnRef.current.contains(e.target);
      const inMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!inAvatar && !inMenu) setWsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { setFocused(false); setWsOpen(false); inputRef.current?.blur(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const placeholder =
    view === 'setlists' ? 'Search setlists & songs…'
    : view === 'library' ? 'Search songs & setlists…'
    : 'Search my library…';

  const closeSearch = () => { setQuery(''); setFocused(false); inputRef.current?.blur(); };

  const showResults = focused && q.length > 0;
  const hasAnyResults = results.songs.length > 0 || results.setlists.length > 0;

  const activeWorkspace = workspaces.find(w => w.id === activeLibrary) || workspaces[0] || { id: 'personal', name: 'Personal' };
  const selectWorkspace = (id) => { setWsOpen(false); setActiveLibrary?.(id); };

  return (
    <div
      ref={containerRef}
      className="sm:hidden"
      style={{ position: 'sticky', top: 0, zIndex: 40, paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Search card — hamburger left, workspace avatar right (opens switcher).
          Creating items is the job of the morphing FAB in the glass bottom bar. */}
      <div className="px-3 pt-3 pb-3 relative">
        <div className="flex items-stretch h-14 rounded-xl bg-[var(--ds-gray-100)] overflow-hidden">
          <button
            onClick={onOpenDrawer}
            aria-label="Open menu"
            className="shrink-0 w-12 flex items-center justify-center bg-transparent text-[var(--text-1)] cursor-pointer active:bg-[var(--ds-gray-200)] transition-colors border-none"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <HamburgerIcon />
          </button>
          <div className="relative flex-1 min-w-0 flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              placeholder={placeholder}
              className="w-full h-full px-4 bg-transparent border-none text-copy-15 text-[var(--text-1)] placeholder:text-[var(--text-2)] outline-none"
            />
          </div>
          {/* Workspace avatar — inside the field, on the right */}
          <div className="shrink-0 flex items-center pr-2.5 pl-0.5">
            <span className="w-px h-7 bg-[var(--ds-gray-300)] mr-2" aria-hidden="true" />
            <button
              ref={avatarBtnRef}
              onClick={() => setWsOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={wsOpen}
              aria-label="Switch Space"
              className="flex items-center gap-0.5 cursor-pointer bg-transparent border-none p-0 active:opacity-80"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <WorkspaceBadge workspace={activeWorkspace} size={32} />
              <ChevronIcon open={wsOpen} />
            </button>
          </div>
        </div>

        {/* Switcher menu — sibling of the card so the card's overflow-hidden
            doesn't clip it. */}
        {wsOpen && (
          <div ref={menuRef} role="menu" className="absolute right-3 top-full mt-1 w-[260px] max-w-[80vw] rounded-2xl border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] shadow-xl z-50 overflow-hidden py-1">
            {workspaces.map(w => {
              const active = w.id === activeWorkspace?.id;
              return (
                <button
                  key={w.id}
                  role="menuitem"
                  onClick={() => selectWorkspace(w.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 bg-transparent border-none text-left cursor-pointer active:bg-[var(--bg-2)]"
                >
                  <WorkspaceBadge workspace={w} size={28} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="block text-copy-15 text-[var(--text-1)] truncate">{w.name}</span>
                      {workspaceStatusLabel(w.status) && (
                        <span className="shrink-0 text-label-10 font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: 'var(--ds-red-100)', color: 'var(--ds-red-900)' }}>
                          {workspaceStatusLabel(w.status)}
                        </span>
                      )}
                    </span>
                    {w.id !== 'personal' && <span className="block text-label-12 text-[var(--text-2)]">Shared Space</span>}
                  </span>
                  {active && <span className="text-[var(--color-brand)] shrink-0"><CheckIcon /></span>}
                </button>
              );
            })}
            {onNewWorkspace && (
              <>
                <div className="my-1 border-t border-[var(--ds-gray-200)]" />
                <button
                  role="menuitem"
                  onClick={() => { setWsOpen(false); onNewWorkspace(); }}
                  className="w-full flex items-center gap-3 px-3 py-3 bg-transparent border-none text-left cursor-pointer active:bg-[var(--bg-2)]"
                >
                  <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[var(--color-brand)]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </span>
                  <span className="text-copy-15 text-[var(--text-1)]">New Space</span>
                </button>
              </>
            )}
            {!onNewWorkspace && newWorkspaceLocked && (
              <>
                <div className="my-1 border-t border-[var(--ds-gray-200)]" />
                <a
                  role="menuitem"
                  href={supportContact ? `mailto:${supportContact}?subject=Additional%20Space` : undefined}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left text-[var(--text-2)] active:bg-[var(--bg-2)] no-underline"
                >
                  <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </span>
                  <span className="text-copy-14">Contact support for more Spaces</span>
                </a>
              </>
            )}
          </div>
        )}
      </div>

      {/* Search results dropdown */}
      {showResults && (
        <div className="absolute left-0 right-0 top-full bg-[var(--ds-background-100)] border-b border-[var(--ds-gray-200)] shadow-lg max-h-[70vh] overflow-y-auto">
          {hasAnyResults ? (
            <div className="divide-y divide-[var(--border-1)]">
              {results.songs.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1 text-label-12 uppercase tracking-wider text-[var(--text-2)]">Songs</div>
                  <div className="divide-y divide-[var(--border-1)]">
                    {results.songs.map(song => (
                      <div key={song.id} className="active:bg-[var(--bg-2)]">
                        <SongCard
                          song={song}
                          variant="row"
                          onClick={() => { closeSearch(); onSelectSong?.(song); }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {results.setlists.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1 text-label-12 uppercase tracking-wider text-[var(--text-2)]">Setlists</div>
                  <div className="divide-y divide-[var(--border-1)]">
                    {results.setlists.map(sl => (
                      <button
                        key={sl.id}
                        onClick={() => { closeSearch(); onSelectSetlist?.(sl); }}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-transparent border-none cursor-pointer active:bg-[var(--bg-2)] text-left"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-copy-14 text-[var(--text-1)] truncate">{sl.name || 'Untitled setlist'}</span>
                          <span className="text-label-12 text-[var(--text-2)] truncate">
                            {(sl.items?.length || 0)} songs{sl.date ? ` • ${formatDateShort(sl.date)}` : ''}
                          </span>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-2)] shrink-0">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="px-6 py-10 text-center text-copy-14 text-[var(--text-2)]">
              No matches for "<span className="text-[var(--text-1)]">{query}</span>".
            </div>
          )}
        </div>
      )}
    </div>
  );
}
