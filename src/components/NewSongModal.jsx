import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Tabs } from './ui/Tabs';
import ImportTab from './newSong/ImportTab';
import BrowseTab from './newSong/BrowseTab';

// Pasting a chord sheet now happens inside the editor's New-song mode (a big
// paste area), so the modal leads with Import + Browse and offers a blank song
// from a corner button.
const TABS = [
  { id: 'import', label: 'Import' },
  { id: 'browse', label: 'Browse' },
];

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

export default function NewSongModal({
  onClose,
  onStartBlank,
  onImportSongs,
  onImportSetlistFile,
  onSmartImport,
  initialTab = 'import',
}) {
  const [tab, setTab] = useState(TABS.some(t => t.id === initialTab) ? initialTab : 'import');
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

  const sheetClass = isMobile
    ? 'w-full rounded-t-2xl rounded-b-none max-h-[92vh] mt-auto'
    : 'w-full max-w-[760px] rounded-2xl max-h-[90vh]';
  const overlayAlign = isMobile ? 'items-end' : 'items-center justify-center';

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

        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--ds-gray-300)]">
          <div className="flex-1">
            <div className="text-heading-16 text-[var(--ds-gray-1000)]">New song</div>
            <div className="text-copy-12 text-[var(--ds-gray-600)] mt-0.5">
              Import a file or browse songs — or start blank and paste inside the editor.
            </div>
          </div>
          <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</IconButton>
        </div>

        <div className="px-3 border-b border-[var(--ds-gray-300)]">
          <Tabs tabs={TABS} activeTab={tab} onTabChange={setTab} />
        </div>

        {/* License notice (not on the public-domain Browse tab). */}
        {tab === 'import' && (
          <div className="px-5 py-2 border-b border-[var(--ds-gray-300)] text-label-11 text-[var(--ds-gray-700)] shrink-0" style={{ background: 'var(--ds-gray-100)' }}>
            You're responsible for ensuring you have a license to copy the content you import
            (e.g. CCLI, SongSelect, PraiseCharts, or original material).
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {tab === 'import' && (
            <ImportTab isMobile={isMobile} onImportSongs={onImportSongs} onImportSetlistFile={onImportSetlistFile} />
          )}
          {tab === 'browse' && <BrowseTab onSelect={onSmartImport} />}
        </div>

        {/* Blank song lives in the corner — it opens the editor's paste/blank mode. */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--ds-gray-300)] shrink-0">
          <span className="text-label-11 text-[var(--ds-gray-500)] mr-auto">Prefer a clean slate?</span>
          <Button variant="secondary" size="sm" onClick={onStartBlank}>Start blank</Button>
        </div>
      </div>
    </div>
  );
}
