// The What's new page reads src/data/changelog.md. This module turns that
// markdown into releases and decides what the page shows. Pure, no React.
//
// Shape of one release (the heading format CLAUDE.md's "finish" workflow
// writes): `## 0.21.0 — Title`, an `*Month YYYY*` line, then `### Added` /
// `### Improved` / `### Fixed` … with `- ` bullets.

// What a reader sees instead of the changelog's own section words.
const SECTION_LABELS = {
  Added: 'New',
  Improved: 'Better',
  Fixed: 'Fixed',
  Removed: 'Removed',
  Security: 'Security',
};
export const sectionLabel = (name) => SECTION_LABELS[name] || name;

export function parseChangelog(raw = '') {
  const releases = [];
  let current = null;
  let section = null;
  for (const rawLine of raw.split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim()) { section = null; continue; }
    if (line.startsWith('## ')) {
      const [version, ...rest] = line.slice(3).split('—');
      current = { version: version.trim(), title: rest.join('—').trim(), date: '', sections: [] };
      releases.push(current);
      section = null;
      continue;
    }
    if (!current) continue; // page title + intro: the page has its own
    if (!current.date && /^\*[^*].*\*$/.test(line)) {
      current.date = line.slice(1, -1).trim();
      continue;
    }
    if (line.startsWith('### ')) {
      section = { name: line.slice(4).trim(), items: [] };
      current.sections.push(section);
      continue;
    }
    if (line.startsWith('- ')) {
      if (!section) {
        section = { name: '', items: [] };
        current.sections.push(section);
      }
      section.items.push(line.slice(2).trim());
      continue;
    }
    // A wrapped bullet continues the one before it; a loose paragraph is
    // its own item.
    if (section?.items.length) {
      section.items[section.items.length - 1] += ' ' + line.trim();
    } else {
      section = section || { name: '', items: [] };
      if (!current.sections.includes(section)) current.sections.push(section);
      section.items.push(line.trim());
    }
  }
  return releases.filter((r) => r.sections.some((s) => s.items.length));
}

// Pre-alpha and alpha builds mean nothing to a church member (owner,
// 2026-11-09): the page stops at the first real release.
export const isShownRelease = (r) => !/-(pre-)?alpha\b/i.test(r.version);

// `0.21.0-beta.3` is the 0.21.0 entry — the changelog heading is the bare
// target version.
export const baseVersion = (v = '') => String(v).replace(/^v/, '').split('-')[0];

/** Index of the release this build is, or 0 (the newest) when none matches. */
export function currentIndex(releases, appVersion) {
  const i = releases.findIndex((r) => baseVersion(r.version) === baseVersion(appVersion));
  return i < 0 ? 0 : i;
}

export const bulletCount = (release) =>
  release.sections.reduce((n, s) => n + s.items.length, 0);

/**
 * The first `limit` bullets of a release, keeping their sections. Sections
 * past the limit drop out entirely rather than showing an empty heading.
 */
export function capSections(release, limit) {
  if (limit == null || bulletCount(release) <= limit) return release.sections;
  const out = [];
  let left = limit;
  for (const s of release.sections) {
    if (left <= 0) break;
    out.push({ ...s, items: s.items.slice(0, left) });
    left -= s.items.length;
  }
  return out;
}

/**
 * Splits `**bold**`, `*italic*`, `` `code` `` and `[text](url)` out of one
 * bullet. Returns [{ type: 'text'|'bold'|'italic'|'code'|'link', text, href? }].
 */
export function inlineSegments(text = '') {
  const out = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
    const t = m[0];
    if (m[1]) out.push({ type: 'code', text: t.slice(1, -1) });
    else if (m[2]) out.push({ type: 'bold', text: t.slice(2, -2) });
    else if (m[3]) out.push({ type: 'italic', text: t.slice(1, -1) });
    else {
      const [, label, href] = /\[([^\]]+)\]\(([^)]+)\)/.exec(t);
      out.push({ type: 'link', text: label, href });
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}
