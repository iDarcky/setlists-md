import React, { useMemo } from 'react';
import privacyRaw from '../data/privacy.md?raw';
import termsRaw from '../data/terms.md?raw';
import { Button } from './ui/Button';

const SOURCES = { privacy: privacyRaw, terms: termsRaw };
const TITLES = { privacy: 'Privacy Policy', terms: 'Terms of Service' };

function renderInline(text, keyPrefix) {
  const parts = [];
  const regex = /(\*\*[^*]+\*\*)|(\*[^*]+\*|_[^_]+_)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) {
      parts.push(<strong key={`${keyPrefix}b${i++}`}>{t.slice(2, -2)}</strong>);
    } else if (t.startsWith('*') || t.startsWith('_')) {
      parts.push(<em key={`${keyPrefix}i${i++}`}>{t.slice(1, -1)}</em>);
    } else if (t.startsWith('`')) {
      parts.push(
        <code key={`${keyPrefix}c${i++}`} className="px-1.5 py-0.5 rounded bg-[var(--ds-background-200)] font-mono text-[0.9em]">
          {t.slice(1, -1)}
        </code>,
      );
    } else if (t.startsWith('[')) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(t);
      if (mm) {
        parts.push(
          <a key={`${keyPrefix}a${i++}`} href={mm[2]} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand)] hover:underline underline-offset-4">
            {mm[1]}
          </a>,
        );
      }
    }
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderMarkdown(source) {
  const lines = source.split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('# ')) {
      blocks.push(<h1 key={key++} className="text-heading-32 text-[var(--ds-gray-1000)] mb-2 mt-0">{renderInline(line.slice(2), `h1-${key}`)}</h1>);
      i++;
    } else if (line.startsWith('## ')) {
      blocks.push(<h2 key={key++} className="text-heading-20 text-[var(--ds-gray-1000)] mt-10 mb-3">{renderInline(line.slice(3), `h2-${key}`)}</h2>);
      i++;
    } else if (line.startsWith('### ')) {
      blocks.push(<h3 key={key++} className="text-heading-16 text-[var(--ds-gray-1000)] mt-6 mb-2">{renderInline(line.slice(4), `h3-${key}`)}</h3>);
      i++;
    } else if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
      blocks.push(<p key={key++} className="text-copy-14 text-[var(--ds-gray-700)] italic mb-6">{line.slice(1, -1)}</p>);
      i++;
    } else if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-6 mb-4 space-y-2 text-copy-16 text-[var(--ds-gray-900)]">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `li-${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
    } else {
      const buf = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,3} |- |\*[^*])/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      blocks.push(
        <p key={key++} className="text-copy-16 text-[var(--ds-gray-900)] leading-relaxed mb-4">
          {renderInline(buf.join(' '), `p-${key}`)}
        </p>,
      );
    }
  }
  return blocks;
}

export default function LegalPage({ doc, onBack }) {
  const body = useMemo(() => renderMarkdown(SOURCES[doc] || ''), [doc]);
  const title = TITLES[doc] || 'Legal';

  return (
    <div className="min-h-screen bg-[var(--ds-background-100)]">
      <header className="sticky top-0 z-10 bg-[var(--ds-background-100)]/95 backdrop-blur border-b border-[var(--ds-gray-400)]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-copy-14 text-[var(--ds-gray-1000)] no-underline">
            <img src="/setlists-md-mark.svg" alt="" width="24" height="24" className="rounded" />
            <span className="font-semibold">Setlists MD</span>
          </a>
          {onBack ? (
            <Button variant="secondary" size="sm" onClick={onBack}>Back to app</Button>
          ) : (
            <a href="/" className="text-copy-14 text-[var(--color-brand)] no-underline hover:underline">Open the app</a>
          )}
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <article>{body}</article>
        <footer className="mt-16 pt-8 border-t border-[var(--ds-gray-400)] text-copy-13 text-[var(--ds-gray-700)] flex flex-wrap gap-4">
          <a href="/" className="hover:underline">Home</a>
          <a href="/privacy" className="hover:underline">{TITLES.privacy}</a>
          <a href="/terms" className="hover:underline">{TITLES.terms}</a>
          <span className="ml-auto">© {new Date().getFullYear()} Setlists MD</span>
        </footer>
      </main>
    </div>
  );
}
