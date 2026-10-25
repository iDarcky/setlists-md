import React, { useEffect, useMemo } from 'react';
import { Button } from '@/ui/Button';
import PageHeader from '@/ui/PageHeader';
import { SOURCES, TITLES, renderMarkdown } from './legalDocs';

export default function LegalPage({ doc, onBack }) {
  const body = useMemo(() => renderMarkdown(SOURCES[doc] || ''), [doc]);
  const title = TITLES[doc] || 'Legal';

  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Setlists.md`;
    return () => { document.title = previous; };
  }, [title]);

  // Inside app shell: use ScreenHeader + scrollable content (no standalone chrome).
  if (onBack) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title={title} onClose={onBack} />
        <div className="flex-1 overflow-y-auto">
          <main className="max-w-3xl mx-auto px-6 py-10">
            <article>{body}</article>
            <footer className="mt-16 pt-8 border-t border-[var(--ds-gray-400)] text-copy-13 text-[var(--ds-gray-700)] flex flex-wrap gap-4">
              <a href="/privacy" className="hover:underline">{TITLES.privacy}</a>
              <a href="/terms" className="hover:underline">{TITLES.terms}</a>
              <a href="/copyright" className="hover:underline">{TITLES.copyright}</a>
              <span className="ml-auto">© {new Date().getFullYear()} Setlists.md</span>
            </footer>
          </main>
        </div>
      </div>
    );
  }

  // Standalone (direct URL access): full-page with its own brand header.
  return (
    <div className="min-h-screen bg-[var(--ds-background-100)]">
      <header className="sticky top-0 z-10 bg-[var(--ds-background-100)]/95 backdrop-blur border-b border-[var(--ds-gray-400)]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-copy-14 text-[var(--ds-gray-1000)] no-underline">
            <img src="/setlists-md-mark.svg" alt="" width="24" height="24" className="rounded" />
            <span className="font-semibold">Setlists.md</span>
          </a>
          <a href="/" className="text-copy-14 text-[var(--color-brand)] no-underline hover:underline">Open the app</a>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <article>{body}</article>
        <footer className="mt-16 pt-8 border-t border-[var(--ds-gray-400)] text-copy-13 text-[var(--ds-gray-700)] flex flex-wrap gap-4">
          <a href="/privacy" className="hover:underline">{TITLES.privacy}</a>
          <a href="/terms" className="hover:underline">{TITLES.terms}</a>
          <a href="/copyright" className="hover:underline">{TITLES.copyright}</a>
          <span className="ml-auto">© {new Date().getFullYear()} Setlists.md</span>
        </footer>
      </main>
    </div>
  );
}
