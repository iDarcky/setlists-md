// The legal documents and the small markdown renderer both the Legal page
// and the Terms sheet use.
import privacyRaw from '@/data/privacy.md?raw';
import termsRaw from '@/data/terms.md?raw';
import copyrightRaw from '@/data/copyright.md?raw';

export const SOURCES = { privacy: privacyRaw, terms: termsRaw, copyright: copyrightRaw };
export const TITLES = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  copyright: 'Copyright Policy & DMCA',
};

const PAGE_CLASSES = {
  code: 'px-1.5 py-0.5 rounded bg-[var(--ds-background-200)] font-mono text-[0.9em]',
  a: 'text-[var(--color-brand)] hover:underline underline-offset-4',
  h1: 'text-heading-32 text-[var(--ds-gray-1000)] mb-2 mt-0',
  h2: 'text-heading-20 text-[var(--ds-gray-1000)] mt-10 mb-3',
  h3: 'text-heading-16 text-[var(--ds-gray-1000)] mt-6 mb-2',
  meta: 'text-copy-14 text-[var(--ds-gray-700)] italic mb-6',
  ul: 'list-disc pl-6 mb-4 space-y-2 text-copy-16 text-[var(--ds-gray-900)]',
  p: 'text-copy-16 text-[var(--ds-gray-900)] leading-relaxed mb-4',
};

function renderInline(text, keyPrefix, cls) {
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
        <code key={`${keyPrefix}c${i++}`} className={cls.code}>
          {t.slice(1, -1)}
        </code>,
      );
    } else if (t.startsWith('[')) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(t);
      if (mm) {
        parts.push(
          <a key={`${keyPrefix}a${i++}`} href={mm[2]} target="_blank" rel="noopener noreferrer" className={cls.a}>
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

/** The legal markdown as React. `cls` restyles it (the Terms sheet uses the new tokens). */
export function renderMarkdown(source, cls = PAGE_CLASSES) {
  const lines = source.split('\n');
  const blocks = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('# ')) {
      blocks.push(<h1 key={key++} className={cls.h1}>{renderInline(line.slice(2), `h1-${key}`, cls)}</h1>);
      i++;
    } else if (line.startsWith('## ')) {
      blocks.push(<h2 key={key++} className={cls.h2}>{renderInline(line.slice(3), `h2-${key}`, cls)}</h2>);
      i++;
    } else if (line.startsWith('### ')) {
      blocks.push(<h3 key={key++} className={cls.h3}>{renderInline(line.slice(4), `h3-${key}`, cls)}</h3>);
      i++;
    } else if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
      blocks.push(<p key={key++} className={cls.meta}>{line.slice(1, -1)}</p>);
      i++;
    } else if (line.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++} className={cls.ul}>
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `li-${key}-${idx}`, cls)}</li>
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
        <p key={key++} className={cls.p}>
          {renderInline(buf.join(' '), `p-${key}`, cls)}
        </p>,
      );
    }
  }
  return blocks;
}
