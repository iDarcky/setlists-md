import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import ImportTab from './newSong/ImportTab';
import PasteTab from './newSong/PasteTab';
import BrowseTab from './newSong/BrowseTab';

const MOBILE_QUERY = '(max-width: 639px)';

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

const OPTIONS = [
  {
    id: 'blank', title: 'Blank song', desc: 'Start from an empty chart.',
    icon: (<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>),
  },
  {
    id: 'import', title: 'Import file', desc: 'Add .md / .zip files or a setlist.',
    icon: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>),
  },
  {
    id: 'paste', title: 'Paste chords', desc: 'From Ultimate-Guitar or ChordPro.',
    icon: (<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></>),
  },
  {
    id: 'browse', title: 'Browse', desc: 'Start from a public-domain song.',
    icon: (<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>),
  },
];

const TITLES = { import: 'Import a file', paste: 'Paste a chord sheet', browse: 'Browse songs' };

export default function NewSongModal({
  onClose,
  onStartBlank,
  onImportSongs,
  onImportSetlistFile,
  onSmartImport,
  initialTab = 'home',
}) {
  const [view, setView] = useState(['import', 'paste', 'browse'].includes(initialTab) ? initialTab : 'home');
  const isMobile = useIsMobile();

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

  const pick = (id) => { if (id === 'blank') onStartBlank(); else setView(id); };

  const sheetClass = isMobile
    ? 'w-full rounded-t-2xl rounded-b-none max-h-[92vh] mt-auto'
    : 'w-full max-w-[760px] rounded-2xl max-h-[90vh]';
  const overlayAlign = isMobile ? 'items-end' : 'items-center justify-center';
  const atHome = view === 'home';

  return (
    <div
      className={`fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex ${overlayAlign} ${isMobile ? '' : 'p-4'}`}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] flex flex-col ${sheetClass}`}
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        {isMobile && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="h-1 w-10 rounded-full bg-[var(--ds-gray-400)]" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--ds-gray-300)]">
          {!atHome && (
            <IconButton variant="ghost" size="sm" onClick={() => setView('home')} aria-label="Back" title="Back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </IconButton>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-heading-18 font-semibold text-[var(--ds-gray-1000)]">
              {atHome ? 'New song' : TITLES[view]}
            </div>
            {atHome && (
              <div className="text-copy-13 text-[var(--ds-gray-600)] mt-0.5">
                Choose how you'd like to start.
              </div>
            )}
          </div>
          <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</IconButton>
        </div>

        {/* License notice — shown from the start (not on the public-domain browse). */}
        {view !== 'browse' && (
          <div className="px-5 py-2 border-b border-[var(--ds-gray-300)] text-label-11 text-[var(--ds-gray-700)] shrink-0" style={{ background: 'var(--ds-gray-100)' }}>
            You're responsible for ensuring you have a license to copy the content you import
            (e.g. CCLI, SongSelect, PraiseCharts, or original material).
          </div>
        )}

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {atHome ? (
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OPTIONS.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => pick(o.id)}
                  className="group text-left rounded-2xl border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] p-4 cursor-pointer transition-all hover:border-[var(--color-brand-border)] hover:bg-[var(--ds-gray-100)] hover:-translate-y-0.5"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] transition-colors group-hover:bg-[var(--color-brand)] group-hover:text-white">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{o.icon}</svg>
                  </div>
                  <div className="text-heading-15 font-semibold text-[var(--ds-gray-1000)]">{o.title}</div>
                  <div className="text-copy-13 text-[var(--ds-gray-600)] mt-0.5">{o.desc}</div>
                </button>
              ))}
            </div>
          ) : view === 'import' ? (
            <ImportTab isMobile={isMobile} onImportSongs={onImportSongs} onImportSetlistFile={onImportSetlistFile} />
          ) : view === 'paste' ? (
            <PasteTab onSubmit={onSmartImport} isMobile={isMobile} />
          ) : (
            <BrowseTab onSelect={onSmartImport} />
          )}
        </div>
      </div>
    </div>
  );
}
