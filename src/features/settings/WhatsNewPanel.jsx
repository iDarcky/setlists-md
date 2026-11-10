import { useEffect, useState } from 'react';
import { parseChangelog, isShownRelease, currentIndex } from '@/lib/changelog';
import { WhatsNewView } from './WhatsNewView';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';

// The changelog is loaded when this page opens, not with the app: it is the
// longest text in the bundle and almost nobody reads it.
let cache = null;
const loadReleases = () => {
  cache = cache || import('@/data/changelog.md?raw').then((m) => parseChangelog(m.default).filter(isShownRelease));
  cache.catch(() => { cache = null; });
  return cache;
};

export default function WhatsNewPanel({ settings, onMarkSeen }) {
  const [releases, setReleases] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    loadReleases().then(
      (rs) => live && setReleases(rs),
      () => live && setError('Couldn’t load the release notes. Check your connection and try again.'),
    );
    return () => { live = false; };
  }, []);

  // Opening the page clears the "What's new" dot.
  useEffect(() => {
    if (!onMarkSeen || !APP_VERSION) return;
    if (settings?.lastChangelogVersion === APP_VERSION) return;
    onMarkSeen(APP_VERSION);
  }, [settings?.lastChangelogVersion, onMarkSeen]);

  return <WhatsNewView releases={releases} current={releases ? currentIndex(releases, APP_VERSION) : 0} error={error} />;
}
