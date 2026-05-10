import React, { useMemo } from 'react';
import changelogRaw from '../../data/changelog.md?raw';

// ── Inline markdown (bold / italic / code / links) ───────────────────────
function renderInline(text) {
  const parts = [];
  // Order matters: code first so its content isn't double-processed.
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*|_[^_]+_)|(\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`')) {
      parts.push(
        <code
          key={`c${key++}`}
          className="px-1.5 py-0.5 rounded bg-[var(--modes-surface-strong)] text-[var(--modes-text)] font-mono text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      parts.push(<strong key={`b${key++}`} className="text-[var(--modes-text)] font-semibold">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') || token.startsWith('_')) {
      parts.push(<em key={`i${key++}`} className="italic">{token.slice(1, -1)}</em>);
    } else if (token.startsWith('[')) {
      const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (m) {
        parts.push(
          <a
            key={`a${key++}`}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-brand)] hover:underline underline-offset-4"
          >
            {m[1]}
          </a>,
        );
      }
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

// ── Section badge styling ────────────────────────────────────────────────
const SECTION_STYLES = {
  Added: { bg: 'rgba(46, 204, 113, 0.12)', fg: '#3ddc84', dot: '#3ddc84' },
  Improved: { bg: 'rgba(99, 162, 255, 0.14)', fg: '#7eb6ff', dot: '#7eb6ff' },
  Fixed: { bg: 'rgba(245, 158, 11, 0.14)', fg: '#fbbf24', dot: '#fbbf24' },
  Removed: { bg: 'rgba(239, 68, 68, 0.14)', fg: '#fca5a5', dot: '#fca5a5' },
  Security: { bg: 'rgba(168, 85, 247, 0.14)', fg: '#c4b5fd', dot: '#c4b5fd' },
};

function SectionBadge({ name }) {
  const style = SECTION_STYLES[name] || { bg: 'var(--modes-surface)', fg: 'var(--modes-text)', dot: 'var(--modes-text-muted)' };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-11 font-semibold tracking-wide"
      style={{ background: style.bg, color: style.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
      {name}
    </span>
  );
}

// ── Parse the changelog into structured release blocks ───────────────────
function parseChangelog(raw) {
  const lines = raw.split('\n');
  const releases = [];
  let pageTitle = '';
  let pageIntro = '';
  let current = null;
  let currentSection = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim()) {
      currentSection = null;
      continue;
    }
    if (line.startsWith('# ') && !pageTitle) {
      pageTitle = line.slice(2).trim();
      continue;
    }
    if (line.startsWith('## ')) {
      if (current) releases.push(current);
      const heading = line.slice(3).trim();
      const [version, ...rest] = heading.split('—');
      current = {
        version: version.trim(),
        title: rest.join('—').trim(),
        date: '',
        sections: [],
      };
      currentSection = null;
      continue;
    }
    if (!current) {
      // Lines before the first ## are treated as page intro.
      pageIntro += (pageIntro ? ' ' : '') + line.trim();
      continue;
    }
    if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**') && !current.date) {
      current.date = line.replace(/^\*|\*$/g, '').trim();
      continue;
    }
    if (line.startsWith('### ')) {
      currentSection = { name: line.slice(4).trim(), items: [] };
      current.sections.push(currentSection);
      continue;
    }
    if (line.startsWith('- ')) {
      const text = line.slice(2);
      if (currentSection) {
        currentSection.items.push(text);
      } else {
        if (!current.notes) current.notes = [];
        current.notes.push(text);
      }
      continue;
    }
    // Loose paragraph line attached to current section/release.
    if (currentSection) {
      const last = currentSection.items[currentSection.items.length - 1];
      if (last !== undefined) {
        currentSection.items[currentSection.items.length - 1] = last + ' ' + line.trim();
      }
    } else if (current) {
      current.notes = current.notes || [];
      current.notes.push(line.trim());
    }
  }
  if (current) releases.push(current);
  return { pageTitle, pageIntro, releases };
}

// ── Panel ────────────────────────────────────────────────────────────────
export default function WhatsNewPanel() {
  const { pageIntro, releases } = useMemo(() => parseChangelog(changelogRaw), []);
  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';

  return (
    <div className="flex flex-col gap-6">
      {pageIntro && (
        <p className="text-copy-14 text-[var(--modes-text-muted)] m-0 px-1">
          {pageIntro}
        </p>
      )}

      <div className="flex flex-col gap-5">
        {releases.map((release, idx) => {
          const isCurrent = release.version === currentVersion;
          return (
            <article
              key={release.version + idx}
              className="modes-card overflow-hidden flex flex-col"
              style={{ borderColor: 'var(--modes-border)' }}
            >
              {/* ── Header strip ── */}
              <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="font-mono text-label-13 font-semibold px-2.5 py-1 rounded-md shrink-0"
                    style={{
                      background: isCurrent ? 'var(--color-brand-soft, rgba(45, 212, 191, 0.16))' : 'var(--modes-surface-strong)',
                      color: isCurrent ? 'var(--color-brand, #2dd4bf)' : 'var(--modes-text-muted)',
                    }}
                  >
                    v{release.version}
                  </span>
                  {isCurrent && (
                    <span className="text-label-11 font-semibold tracking-wide uppercase text-[var(--color-brand, #2dd4bf)]">
                      Current
                    </span>
                  )}
                  {release.date && (
                    <span className="text-label-12 text-[var(--modes-text-dim)] truncate">
                      {release.date}
                    </span>
                  )}
                </div>
              </header>

              {release.title && (
                <h3 className="text-heading-20 font-semibold text-[var(--modes-text)] m-0 px-5 pb-1">
                  {release.title}
                </h3>
              )}

              <div className="flex flex-col gap-4 px-5 pb-5 pt-3">
                {release.notes?.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {release.notes.map((n, i) => (
                      <p key={i} className="text-copy-14 text-[var(--modes-text-muted)] m-0 leading-relaxed">
                        {renderInline(n)}
                      </p>
                    ))}
                  </div>
                )}

                {release.sections.map((section) => (
                  <section key={section.name} className="flex flex-col gap-2">
                    <SectionBadge name={section.name} />
                    <ul className="flex flex-col gap-1.5 m-0 pl-0 list-none">
                      {section.items.map((item, i) => (
                        <li
                          key={i}
                          className="text-copy-14 text-[var(--modes-text-muted)] leading-relaxed pl-5 relative"
                        >
                          <span
                            className="absolute left-1 top-[0.65em] w-1 h-1 rounded-full"
                            style={{ background: 'var(--modes-text-dim)' }}
                          />
                          {renderInline(item)}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
