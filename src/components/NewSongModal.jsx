import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Tabs } from './ui/Tabs';
import ImportTab from './newSong/ImportTab';
import PasteTab from './newSong/PasteTab';
import BrowseTab from './newSong/BrowseTab';

const TABS = [
  { id: 'import', label: 'Import' },
  { id: 'paste', label: 'Paste' },
  { id: 'browse', label: 'Browse Public Domain Songs' },
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
  const [tab, setTab] = useState(initialTab);
  const isMobile = useIsMobile();

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock background scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const sheetClass = isMobile
    ? 'w-full rounded-t-2xl rounded-b-none max-h-[92vh] mt-auto'
    : 'w-full max-w-[1100px] rounded-2xl max-h-[90vh]';

  const overlayAlign = isMobile ? 'items-end' : 'items-center justify-center';

  return (
    <div
      className={`fixed inset-0 z-[200] bg-black/70 flex ${overlayAlign} ${isMobile ? '' : 'p-4'}`}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] flex flex-col ${sheetClass}`}
        style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
      >
        {isMobile && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="h-1 w-10 rounded-full bg-[var(--ds-gray-400)]" />
          </div>
        )}

        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--ds-gray-300)]">
          <div className="flex-1">
            <div className="text-heading-16 text-[var(--ds-gray-1000)]">
              New song
            </div>
            <div className="text-copy-12 text-[var(--ds-gray-600)] mt-0.5">
              Import a file, paste a chord sheet, or browse public-domain songs.
            </div>
          </div>
          <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</IconButton>
        </div>

        <div className="px-3 border-b border-[var(--ds-gray-300)]">
          <Tabs tabs={TABS} activeTab={tab} onTabChange={setTab} />
        </div>

        {(tab === 'import' || tab === 'paste') && (
          <div
            className="px-5 py-2 border-b border-[var(--ds-gray-300)] text-label-11 text-[var(--ds-gray-700)]"
            style={{ background: 'var(--ds-gray-100)' }}
          >
            You're responsible for ensuring you have a license to copy the
            content you import (e.g. CCLI, SongSelect, PraiseCharts, or original
            material).
          </div>
        )}

        {tab === 'import' && (
          <ImportTab
            isMobile={isMobile}
            onImportSongs={onImportSongs}
            onImportSetlistFile={onImportSetlistFile}
          />
        )}
        {tab === 'paste' && (
          <PasteTab onSubmit={onSmartImport} />
        )}
        {tab === 'browse' && <BrowseTab />}

        <div className="flex items-center gap-2 px-5 py-3 border-t border-[var(--ds-gray-300)]">
          <span className="text-label-11 text-[var(--ds-gray-500)] font-mono flex-1 hidden sm:inline">
            Esc to cancel
          </span>
          <Button variant="ghost" size="sm" onClick={onStartBlank}>
            Start blank
          </Button>
        </div>
      </div>
    </div>
  );
}
