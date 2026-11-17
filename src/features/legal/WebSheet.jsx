import { useEffect, useState } from 'react';
import { Sheet } from '@/ui/shadcn/sheet';
import { Spinner } from '@/ui/shadcn/spinner';

// Help and the legal pages live on the website (owner, 2026-11-14) and open
// on top of the app, in the app's own sheet. `?app=1` tells the website to
// drop its menu and footer; the website lets only the app's addresses frame
// these pages (website/vercel.json).

export const SITE = 'https://setlists.md';

// eslint-disable-next-line react-refresh/only-export-components
export const WEB_PAGES = {
  help: { title: 'Help', path: '/help' },
  privacy: { title: 'Privacy policy', path: '/privacy' },
  terms: { title: 'Terms of service', path: '/terms' },
  copyright: { title: 'Copyright and takedowns', path: '/copyright' },
};

// eslint-disable-next-line react-refresh/only-export-components
export const webPageUrl = (page, { inApp = false } = {}) => {
  const p = WEB_PAGES[page];
  return p ? `${SITE}${p.path}${inApp ? '?app=1' : ''}` : SITE;
};

const ExternalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

/** @param {keyof WEB_PAGES | null} page  null = closed */
export default function WebSheet({ page, onClose }) {
  const [loadedPage, setLoadedPage] = useState(null);
  const loaded = loadedPage === page;
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  const meta = page ? WEB_PAGES[page] : null;
  return (
    <Sheet open={!!meta} onOpenChange={(o) => { if (!o) onClose?.(); }} title={meta?.title || ''}
      className="sm:h-[85dvh] sm:max-w-[760px]">
      {meta && (
        <div className="-mx-6 -mb-6 -mt-2 flex h-full min-h-[60dvh] flex-col">
          <div className="flex justify-end px-4 pb-2">
            <a href={webPageUrl(page)} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-0 items-center gap-1.5 rounded-control px-2 py-1 text-[14px] font-medium text-link no-underline outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-ring">
              Open in browser <ExternalIcon />
            </a>
          </div>
          {online ? (
            <div className="relative min-h-0 flex-1 border-t border-border">
              {!loaded && <div className="absolute inset-0 flex items-center justify-center"><Spinner /></div>}
              <iframe
                key={page}
                title={meta.title}
                src={webPageUrl(page, { inApp: true })}
                onLoad={() => setLoadedPage(page)}
                referrerPolicy="strict-origin-when-cross-origin"
                className="block size-full border-0 bg-background"
              />
            </div>
          ) : (
            <p className="m-0 px-6 py-8 text-center text-[15px] text-muted-foreground">
              You’re offline. This page is on setlists.md, so it opens once you’re back online.
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}

/**
 * /privacy, /terms and /copyright on the app's own address: the pages live
 * on the website now (2026-11-14), so send the visitor there.
 */
export function WebRedirect({ page }) {
  useEffect(() => { window.location.replace(webPageUrl(page)); }, [page]);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6 font-sans text-[15px] text-muted-foreground">
      <a href={webPageUrl(page)} className="text-link">Opening {WEB_PAGES[page]?.title || 'setlists.md'}…</a>
    </div>
  );
}
