import { useState } from 'react';
import { Input } from '../ui/Input';

export default function BrowseTab() {
  const [query, setQuery] = useState('');

  return (
    <div className="flex-1 min-h-0 p-5 overflow-y-auto">
      <Input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search public-domain songs…"
        disabled
      />

      <div className="mt-6 rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: 'var(--ds-gray-400)', background: 'var(--ds-gray-100)' }}>
        <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: 'var(--ds-gray-200)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <div className="text-heading-16 text-[var(--ds-gray-1000)] mb-1">
          Public-domain library — coming soon
        </div>
        <div className="text-copy-13 text-[var(--ds-gray-700)] max-w-md mx-auto">
          Browse a built-in collection of public-domain hymns and worship
          songs — Amazing Grace, Be Thou My Vision, How Great Thou Art and
          more. We're still wiring this up; for now, use Import or Paste to
          add songs.
        </div>
      </div>
    </div>
  );
}
