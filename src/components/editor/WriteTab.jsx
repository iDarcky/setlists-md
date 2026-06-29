import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ChordAutocomplete from './ChordAutocomplete';
import KeyChangeDialog from './KeyChangeDialog';
import TabGridEditor from './TabGridEditorV2';
import { parseTabBlock, parseSongMd, serializeTabDef } from '../../parser';
import { sectionStyle } from '../../music';

function nextTabName(library = []) {
  const used = new Set(library.map(t => t.name));
  let n = library.length + 1;
  while (used.has(`Tab ${n}`)) n++;
  return `Tab ${n}`;
}

// The %% tabs library region is kept in the body but hidden from the Advanced
// editor's textarea — it's managed through the Tab button, not raw text.
function splitTabsRegion(body) {
  const m = body.match(/^%% tabs[ \t]*$/m);
  if (!m) return { visible: body, tabs: '' };
  return { visible: body.slice(0, m.index).replace(/\s+$/, ''), tabs: body.slice(m.index).replace(/\s+$/, '') };
}
function joinTabsRegion(visible, tabs) {
  const v = visible.replace(/\s+$/, '');
  return tabs ? `${v}\n\n${tabs.replace(/\s+$/, '')}\n` : `${v}\n`;
}

function tabObjectFromAscii(ascii) {
  const tm = ascii.match(/\{tab(?:,\s*time:\s*([^}]+))?\}/);
  const time = tm && tm[1] ? tm[1].trim() : null;
  const stringLines = ascii.split('\n').map(l => l.trim()).filter(l => /^[eBGDAE]\|/.test(l));
  const tab = parseTabBlock(stringLines);
  tab.time = time;
  return tab;
}
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';

const SECTION_TYPES = [
  'Intro', 'Verse', 'Pre Chorus', 'Chorus', 'Bridge',
  'Instrumental', 'Interlude', 'Tag', 'Vamp', 'Outro', 'Ending', 'Refrain',
];

export default function WriteTab({ md, onChange, textareaRef, customSectionTypes, time, songKey = 'C', onUndo, onRedo, onImport, structureRow }) {
  const sectionTypes = useMemo(() => {
    const custom = (customSectionTypes || [])
      .map(t => t?.name?.trim())
      .filter(Boolean);
    return [...SECTION_TYPES, ...custom];
  }, [customSectionTypes]);
  const [showChordBar, setShowChordBar] = useState(false);
  const [chordAnchor, setChordAnchor] = useState(null);
  const [showSectionMenu, setShowSectionMenu] = useState(false);
  const [showCueInput, setShowCueInput] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showKeyChange, setShowKeyChange] = useState(false);
  const [showTabEditor, setShowTabEditor] = useState(false);
  const [tabEditState, setTabEditState] = useState(null);
  const [showTabMenu, setShowTabMenu] = useState(false);
  const [popupAnchor, setPopupAnchor] = useState(null);
  const [cueText, setCueText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchIdx, setMatchIdx] = useState(0);
  const [recentChords, setRecentChords] = useState([]);
  const findInputRef = useRef(null);

  // Split off the hidden %% tabs region; the textarea only shows the visible
  // song body. emit() re-attaches the preserved tabs region on every change.
  const { visible, tabs } = useMemo(() => splitTabsRegion(md), [md]);
  const emit = useCallback((newVisible) => onChange(tabs ? joinTabsRegion(newVisible, tabs) : newVisible), [onChange, tabs]);

  // ─── Textarea helpers ───
  const insertAtCursor = useCallback((text, opts = {}) => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = ta.value;

    let insert = text;
    let newCursor = start + insert.length;

    if (opts.wrapSelection && start !== end) {
      const selected = val.substring(start, end);
      insert = opts.wrapSelection.replace('$1', selected);
      newCursor = start + insert.length;
    }

    if (opts.newLine) {
      const before = val.substring(0, start);
      const needsNewLine = before.length > 0 && !before.endsWith('\n');
      const needsBlankLine = before.length > 0 && !before.endsWith('\n\n');
      const prefix = needsBlankLine ? (needsNewLine ? '\n\n' : '\n') : '';
      insert = prefix + insert;
      newCursor = start + insert.length;
    }

    const newVal = val.substring(0, start) + insert + val.substring(end);
    emit(newVal);

    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = newCursor;
      ta.focus();
    });
  }, [emit, textareaRef]);

  // The song's reusable tab library, parsed from the body's %% tabs region.
  const tabLibrary = useMemo(() => {
    try { return parseSongMd(md).tabLibrary || []; } catch { return []; }
  }, [md]);

  const insertTabRef = useCallback((name) => {
    insertAtCursor(`{tabref: ${name}}`, { newLine: true });
    setShowTabMenu(false);
  }, [insertAtCursor]);

  // Save a brand-new library tab: append a named def to the %% tabs region and
  // drop a {tabref} at the cursor — one combined edit so both land together.
  const saveNewLibraryTab = useCallback((ascii) => {
    const name = nextTabName(tabLibrary);
    const tab = tabObjectFromAscii(ascii);
    const ta = textareaRef.current;
    const start = ta ? ta.selectionStart : visible.length;
    const ref = `{tabref: ${name}}`;
    const before = visible.slice(0, start);
    const needsNl = before.length > 0 && !before.endsWith('\n');
    const newVisible = before + (needsNl ? '\n' : '') + ref + visible.slice(start);
    const def = serializeTabDef({ name, tab });
    const newTabs = tabs ? `${tabs.replace(/\s+$/, '')}\n\n${def}` : `%% tabs\n\n${def}`;
    onChange(joinTabsRegion(newVisible, newTabs));
  }, [visible, tabs, tabLibrary, onChange, textareaRef]);

  // Harvest chords currently in the song text (most recent first by appearance)
  const songChords = useMemo(() => {
    const seen = new Set();
    const out = [];
    const re = /\[([^\]]+)\]/g;
    let m;
    while ((m = re.exec(visible)) !== null) {
      const c = m[1].trim();
      if (c && !seen.has(c)) { seen.add(c); out.push(c); }
    }
    return out;
  }, [visible]);

  const effectiveRecent = useMemo(() => {
    const merged = [...recentChords];
    for (const c of songChords) {
      if (!merged.includes(c)) merged.push(c);
    }
    return merged.slice(0, 10);
  }, [recentChords, songChords]);

  const addRecent = useCallback((chord) => {
    setRecentChords(prev => {
      const next = [chord, ...prev.filter(c => c !== chord)];
      return next.slice(0, 10);
    });
  }, []);

  // ─── Chord insertion ───
  const handleChordSelect = useCallback((chord) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = ta.value;

    if (start !== end) {
      const selected = val.substring(start, end);
      const insert = `[${chord}]${selected}`;
      const newVal = val.substring(0, start) + insert + val.substring(end);
      emit(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + insert.length;
        ta.focus();
      });
    } else {
      const insert = `[${chord}]`;
      const newVal = val.substring(0, start) + insert + val.substring(end);
      emit(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + insert.length;
        ta.focus();
      });
    }
    setShowChordBar(false);
    addRecent(chord);
  }, [emit, textareaRef, addRecent]);

  // ─── Section insertion with auto-numbering ───
  const handleSectionInsert = useCallback((type) => {
    const regex = new RegExp(`^## ${type}(\\s+\\d+)?$`, 'gm');
    const matches = visible.match(regex);
    const count = matches ? matches.length : 0;
    const needsNumber = ['Verse', 'Pre Chorus', 'Chorus', 'Bridge'].includes(type);
    const label = needsNumber ? `${type} ${count + 1}` : (count > 0 ? `${type} ${count + 1}` : type);
    insertAtCursor(`## ${label}\n`, { newLine: true });
    setShowSectionMenu(false);
  }, [visible, insertAtCursor]);

  const handleCueInsert = useCallback(() => {
    if (!cueText.trim()) return;
    insertAtCursor(`> ${cueText.trim()}\n`, { newLine: true });
    setCueText('');
    setShowCueInput(false);
  }, [cueText, insertAtCursor]);

  const handleNoteInsert = useCallback(() => {
    if (!noteText.trim()) return;
    insertAtCursor(`{!${noteText.trim()}}`);
    setNoteText('');
    setShowNoteInput(false);
  }, [noteText, insertAtCursor]);

  const handleModInsert = useCallback((n) => {
    insertAtCursor(`{modulate: ${n > 0 ? '+' : ''}${n}}\n`, { newLine: true });
    setShowKeyChange(false);
  }, [insertAtCursor]);

  const handleTabEditorSave = useCallback((asciiBlock) => {
    if (tabEditState?.range) {
      const { start, end } = tabEditState.range;
      const newVal = md.substring(0, start) + asciiBlock + md.substring(end);
      onChange(newVal);
    } else {
      // New tab → save to the library and reference it (matches Arrange).
      saveNewLibraryTab(asciiBlock);
    }
    setTabEditState(null);
    setShowTabEditor(false);
  }, [tabEditState, md, onChange, saveNewLibraryTab]);

  const openChordPicker = (e) => {
    setChordAnchor(e?.currentTarget?.getBoundingClientRect() || null);
    setShowChordBar(true);
  };

  const openPopup = (setter, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPopupAnchor(rect);
    setter(true);
  };

  // Time sig for TabGridEditor — passed down from the Editor shell, since the
  // frontmatter is no longer part of this editor's text.
  const getTime = () => time || '4/4';

  // ─── Find / Replace ───
  const matches = useMemo(() => {
    if (!showFind || !findText) return [];
    const out = [];
    const hay = caseSensitive ? visible : visible.toLowerCase();
    const needle = caseSensitive ? findText : findText.toLowerCase();
    if (!needle) return [];
    let i = 0;
    while (true) {
      const pos = hay.indexOf(needle, i);
      if (pos === -1) break;
      out.push(pos);
      i = pos + Math.max(needle.length, 1);
    }
    return out;
  }, [showFind, findText, caseSensitive, visible]);

  useEffect(() => {
    if (!showFind || matches.length === 0) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const start = matches[matchIdx] ?? 0;
    const end = start + findText.length;
    ta.focus();
    ta.setSelectionRange(start, end);
    findInputRef.current?.focus();
  }, [showFind, matches, matchIdx, findText, textareaRef]);

  const closeFind = useCallback(() => {
    setShowFind(false);
    setFindText('');
    setReplaceText('');
    setMatchIdx(0);
  }, []);

  const gotoMatch = useCallback((dir) => {
    if (matches.length === 0) return;
    setMatchIdx((m) => (m + dir + matches.length) % matches.length);
  }, [matches.length]);

  const replaceCurrent = useCallback(() => {
    if (matches.length === 0 || !findText) return;
    const start = matches[matchIdx];
    const end = start + findText.length;
    const newVal = visible.substring(0, start) + replaceText + visible.substring(end);
    emit(newVal);
    // stay near current match after replace
    setMatchIdx((m) => Math.min(m, matches.length - 2 < 0 ? 0 : matches.length - 2));
  }, [matches, matchIdx, findText, replaceText, visible, emit]);

  const replaceAll = useCallback(() => {
    if (matches.length === 0 || !findText) return;
    let out = '';
    let cursor = 0;
    for (const pos of matches) {
      out += visible.substring(cursor, pos) + replaceText;
      cursor = pos + findText.length;
    }
    out += visible.substring(cursor);
    emit(out);
    setMatchIdx(0);
  }, [matches, findText, replaceText, visible, emit]);

  // Cmd/Ctrl+F inside the textarea opens find
  const handleTextareaKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (ta) {
        const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd);
        if (sel && sel.length < 120) setFindText(sel);
      }
      setShowFind(true);
    }
  }, [textareaRef]);

  return (
    <div className="flex flex-col h-full pl-3 pr-6">
      {/* The song's official structure (mirrored from the Arrange tab) — same
          band styling so the two tabs match. The negative margins break it out of
          the tab's pl-3/pr-6 padding to span the full width like the Arrange row. */}
      {structureRow && (
        <div className="flex items-center py-1.5 -ml-3 -mr-6 pl-3 pr-6 border-b border-[var(--ds-gray-200)] bg-[var(--ds-background-200)] mb-2">
          {structureRow}
        </div>
      )}
      {/* ─── Toolbar ─── */}
      <div className="flex flex-wrap gap-1 py-1.5 border-b border-[var(--ds-gray-300)] mb-2">
        <ToolBtn label="Chord" onClick={openChordPicker} />
        <ToolBtn label="Section" onClick={(e) => openPopup(setShowSectionMenu, e)} />
        <ToolBtn label="Cue" onClick={(e) => openPopup(setShowCueInput, e)} />
        <ToolBtn label="Note" onClick={(e) => openPopup(setShowNoteInput, e)} />
        <ToolBtn label="Key change" onClick={() => setShowKeyChange(true)} />
        <ToolBtn label="Tab" onClick={(e) => openPopup(setShowTabMenu, e)} />
        <ToolBtn label="Find" onClick={() => setShowFind(true)} />
        {(onUndo || onRedo || onImport) && (
          <span className="w-px self-stretch bg-[var(--ds-gray-300)] mx-0.5" aria-hidden="true" />
        )}
        {onUndo && (
          <IconButton variant="secondary" size="sm" onClick={onUndo} aria-label="Undo" title="Undo">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-1" /></svg>
          </IconButton>
        )}
        {onRedo && (
          <IconButton variant="secondary" size="sm" onClick={onRedo} aria-label="Redo" title="Redo">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h1" /></svg>
          </IconButton>
        )}
        {onImport && (
          <IconButton variant="secondary" size="sm" onClick={onImport} aria-label="Paste &amp; import a chord sheet" title="Paste &amp; import">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></svg>
          </IconButton>
        )}
      </div>

      {/* ─── Find / Replace bar ─── */}
      {showFind && (
        <FindReplaceBar
          findText={findText}
          replaceText={replaceText}
          caseSensitive={caseSensitive}
          matchCount={matches.length}
          matchIdx={matchIdx}
          findInputRef={findInputRef}
          onFindChange={(t) => { setFindText(t); setMatchIdx(0); }}
          onReplaceChange={setReplaceText}
          onToggleCase={() => { setCaseSensitive(v => !v); setMatchIdx(0); }}
          onPrev={() => gotoMatch(-1)}
          onNext={() => gotoMatch(1)}
          onReplaceOne={replaceCurrent}
          onReplaceAll={replaceAll}
          onClose={closeFind}
        />
      )}

      {/* ─── Textarea ─── */}
      <textarea
        ref={textareaRef}
        value={visible}
        onChange={e => emit(e.target.value)}
        onKeyDown={handleTextareaKeyDown}
        spellCheck={false}
        className="flex-1 w-full min-h-[50vh] bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-lg p-4 text-copy-13 leading-relaxed text-[var(--ds-gray-1000)] resize-y outline-none font-mono"
        style={{ caretColor: 'var(--chord)' }}
      />

      {/* ─── Popups ─── */}
      {showChordBar && (
        <ChordAutocomplete
          anchorRect={chordAnchor}
          songKey={songKey}
          recents={effectiveRecent}
          onCommit={handleChordSelect}
          onClose={() => setShowChordBar(false)}
        />
      )}

      {showTabMenu && (
        <Popup anchor={popupAnchor} onClose={() => setShowTabMenu(false)}>
          <div className="flex flex-col gap-0.5 min-w-[180px]">
            {tabLibrary.map(t => (
              <button
                key={t.name}
                onClick={() => insertTabRef(t.name)}
                className="bg-transparent border-none rounded-md px-3 py-1.5 text-left cursor-pointer text-copy-13 font-medium text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)] transition-colors flex items-center gap-2"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/></svg>
                {t.name}
              </button>
            ))}
            {tabLibrary.length > 0 && <div className="my-1 border-t border-[var(--ds-gray-300)]" />}
            <button
              onClick={() => { setShowTabMenu(false); setTabEditState(null); setShowTabEditor(true); }}
              className="bg-transparent border-none rounded-md px-3 py-1.5 text-left cursor-pointer text-copy-13 font-semibold text-[var(--color-brand-text)] hover:bg-[var(--ds-gray-200)] transition-colors"
            >
              + New tab…
            </button>
          </div>
        </Popup>
      )}

      {showSectionMenu && (
        <Popup anchor={popupAnchor} onClose={() => setShowSectionMenu(false)}>
          <div className="flex flex-col gap-0.5">
            {sectionTypes.map(t => (
              <button
                key={t}
                onClick={() => handleSectionInsert(t)}
                className="bg-transparent border-none rounded-md px-3 py-1.5 text-left cursor-pointer text-copy-13 font-bold uppercase tracking-wider hover:bg-[var(--ds-gray-200)] transition-colors"
                style={{ color: sectionStyle(t, null, customSectionTypes).b }}
              >
                {t}
              </button>
            ))}
          </div>
        </Popup>
      )}

      {showCueInput && (
        <Popup anchor={popupAnchor} onClose={() => setShowCueInput(false)}>
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={cueText}
              onChange={e => setCueText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCueInsert(); }}
              placeholder="Band cue text..."
              className="flex-1 px-2.5 py-1.5 bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-md text-copy-13 text-[var(--ds-gray-1000)] outline-none font-mono"
            />
            <Button variant="brand" size="xs" onClick={handleCueInsert}>Insert</Button>
          </div>
        </Popup>
      )}

      {showNoteInput && (
        <Popup anchor={popupAnchor} onClose={() => setShowNoteInput(false)}>
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleNoteInsert(); }}
              placeholder="Inline note..."
              className="flex-1 px-2.5 py-1.5 bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-md text-copy-13 text-[var(--ds-gray-1000)] outline-none font-mono"
            />
            <Button variant="brand" size="xs" onClick={handleNoteInsert}>Insert</Button>
          </div>
        </Popup>
      )}

      {showKeyChange && (
        <KeyChangeDialog
          showAddChords={false}
          onConfirm={(steps) => handleModInsert(steps)}
          onClose={() => setShowKeyChange(false)}
        />
      )}

      {showTabEditor && (
        <TabGridEditor
          key={tabEditState?.range?.start ?? 'new'}
          initialTab={tabEditState?.initialTab}
          time={tabEditState?.time || getTime()}
          onSave={handleTabEditorSave}
          onClose={() => { setShowTabEditor(false); setTabEditState(null); }}
        />
      )}
    </div>
  );
}

/* ─── Toolbar button ─── */
function ToolBtn({ label, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title || label}
      className="bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-lg px-3 py-1.5 cursor-pointer text-[var(--ds-gray-1000)] text-label-12 font-semibold whitespace-nowrap hover:bg-[var(--ds-gray-200)] hover:border-[var(--ds-gray-600)] transition-colors"
    >
      {label}
    </button>
  );
}

/* ─── Find / Replace bar ─── */
function FindReplaceBar({
  findText, replaceText, caseSensitive, matchCount, matchIdx,
  findInputRef,
  onFindChange, onReplaceChange, onToggleCase,
  onPrev, onNext, onReplaceOne, onReplaceAll, onClose,
}) {
  useEffect(() => {
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, [findInputRef]);

  const handleFindKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) onPrev(); else onNext();
    }
  };

  const handleReplaceKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey || e.altKey) onReplaceAll(); else onReplaceOne();
    }
  };

  const hasMatches = matchCount > 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-2 p-1.5 rounded-lg bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)]">
      <input
        ref={findInputRef}
        value={findText}
        onChange={e => onFindChange(e.target.value)}
        onKeyDown={handleFindKey}
        placeholder="Find"
        className="flex-1 min-w-[120px] px-2 py-1 bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] rounded-md text-copy-12 text-[var(--ds-gray-1000)] outline-none font-mono"
      />
      <span
        className="text-label-11-mono whitespace-nowrap px-1"
        style={{ color: findText && !hasMatches ? 'var(--ds-red-900)' : 'var(--ds-gray-600)' }}
      >
        {findText ? (hasMatches ? `${matchIdx + 1} / ${matchCount}` : '0 / 0') : ''}
      </span>
      <IconButton variant="ghost" size="xs" onClick={onPrev} disabled={!hasMatches} aria-label="Previous match" title="Previous (Shift+Enter)">↑</IconButton>
      <IconButton variant="ghost" size="xs" onClick={onNext} disabled={!hasMatches} aria-label="Next match" title="Next (Enter)">↓</IconButton>
      <button
        onClick={onToggleCase}
        title="Case sensitive"
        className={`rounded-md px-2 py-1 text-label-11 font-semibold font-mono border transition-colors ${
          caseSensitive
            ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] border-[var(--color-brand-border)]'
            : 'bg-[var(--ds-background-200)] text-[var(--ds-gray-600)] border-[var(--ds-gray-400)] hover:bg-[var(--ds-gray-200)]'
        }`}
      >
        Aa
      </button>
      <input
        value={replaceText}
        onChange={e => onReplaceChange(e.target.value)}
        onKeyDown={handleReplaceKey}
        placeholder="Replace"
        className="flex-1 min-w-[120px] px-2 py-1 bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] rounded-md text-copy-12 text-[var(--ds-gray-1000)] outline-none font-mono"
      />
      <Button variant="secondary" size="xs" onClick={onReplaceOne} disabled={!hasMatches}>Replace</Button>
      <Button variant="secondary" size="xs" onClick={onReplaceAll} disabled={!hasMatches}>All</Button>
      <IconButton variant="ghost" size="xs" onClick={onClose} aria-label="Close find" title="Close (Esc)">✕</IconButton>
    </div>
  );
}

/* ─── Generic popup wrapper ─── */
function Popup({ anchor, onClose, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-[var(--ds-background-200)] border border-[var(--ds-gray-400)] rounded-xl p-2.5 min-w-[180px]"
      style={{
        top: anchor ? anchor.bottom + 4 : '50%',
        left: anchor ? Math.min(anchor.left, window.innerWidth - 260) : '50%',
        ...(anchor ? {} : { transform: 'translate(-50%, -50%)' }),
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      {children}
    </div>
  );
}
