import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ChordPicker from './ChordPicker';
import TabGridEditor from './TabGridEditorV2';
import { parseTabBlock } from '../../parser';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';

const SECTION_TYPES = [
  'Intro', 'Verse', 'Pre Chorus', 'Chorus', 'Bridge',
  'Instrumental', 'Interlude', 'Tag', 'Vamp', 'Outro', 'Ending', 'Refrain',
];

export default function WriteTab({ md, onChange, textareaRef, customSectionTypes, time, onUndo, onRedo, onImport }) {
  const sectionTypes = useMemo(() => {
    const custom = (customSectionTypes || [])
      .map(t => t?.name?.trim())
      .filter(Boolean);
    return [...SECTION_TYPES, ...custom];
  }, [customSectionTypes]);
  const [showChordPicker, setShowChordPicker] = useState(false);
  const [showSectionMenu, setShowSectionMenu] = useState(false);
  const [showCueInput, setShowCueInput] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showModMenu, setShowModMenu] = useState(false);
  const [showTabEditor, setShowTabEditor] = useState(false);
  const [tabEditState, setTabEditState] = useState(null);
  const [chordAnchor, setChordAnchor] = useState(null);
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
    onChange(newVal);

    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = newCursor;
      ta.focus();
    });
  }, [onChange, textareaRef]);

  // Harvest chords currently in the song text (most recent first by appearance)
  const songChords = useMemo(() => {
    const seen = new Set();
    const out = [];
    const re = /\[([^\]]+)\]/g;
    let m;
    while ((m = re.exec(md)) !== null) {
      const c = m[1].trim();
      if (c && !seen.has(c)) { seen.add(c); out.push(c); }
    }
    return out;
  }, [md]);

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
      onChange(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + insert.length;
        ta.focus();
      });
    } else {
      const insert = `[${chord}]`;
      const newVal = val.substring(0, start) + insert + val.substring(end);
      onChange(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + insert.length;
        ta.focus();
      });
    }
    setShowChordPicker(false);
    addRecent(chord);
  }, [onChange, textareaRef, addRecent]);

  // ─── Section insertion with auto-numbering ───
  const handleSectionInsert = useCallback((type) => {
    const regex = new RegExp(`^## ${type}(\\s+\\d+)?$`, 'gm');
    const matches = md.match(regex);
    const count = matches ? matches.length : 0;
    const needsNumber = ['Verse', 'Pre Chorus', 'Chorus', 'Bridge'].includes(type);
    const label = needsNumber ? `${type} ${count + 1}` : (count > 0 ? `${type} ${count + 1}` : type);
    insertAtCursor(`## ${label}\n`, { newLine: true });
    setShowSectionMenu(false);
  }, [md, insertAtCursor]);

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
    insertAtCursor(`{modulate: +${n}}\n`, { newLine: true });
    setShowModMenu(false);
  }, [insertAtCursor]);

  const handleTabInsert = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) { setTabEditState(null); setShowTabEditor(true); return; }
    const cursorPos = ta.selectionStart;
    const val = ta.value;

    const openRegex = /\{tab(?:,\s*[^}]*)?\}/g;
    let editState = null;
    let match;
    while ((match = openRegex.exec(val)) !== null) {
      const blockStart = match.index;
      const closeIdx = val.indexOf('{/tab}', match.index + match[0].length);
      if (closeIdx === -1) continue;
      const blockEnd = closeIdx + '{/tab}'.length;
      if (cursorPos >= blockStart && cursorPos <= blockEnd) {
        const blockText = val.substring(match.index + match[0].length, closeIdx).trim();
        const rawLines = blockText.split('\n').filter(l => l.trim());
        const parsed = parseTabBlock(rawLines);
        const timePart = match[0].match(/time:\s*(\S+)/);
        const time = timePart ? timePart[1] : null;
        parsed.time = time;
        editState = { initialTab: parsed, time, range: { start: blockStart, end: blockEnd } };
        break;
      }
    }

    setTabEditState(editState);
    setShowTabEditor(true);
  }, [md, textareaRef]);

  const handleTabEditorSave = useCallback((asciiBlock) => {
    if (tabEditState?.range) {
      const { start, end } = tabEditState.range;
      const newVal = md.substring(0, start) + asciiBlock + md.substring(end);
      onChange(newVal);
    } else {
      insertAtCursor(asciiBlock, { newLine: true });
    }
    setTabEditState(null);
    setShowTabEditor(false);
  }, [tabEditState, md, onChange, insertAtCursor]);

  const openChordPicker = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setChordAnchor(rect);
    setShowChordPicker(true);
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
    const hay = caseSensitive ? md : md.toLowerCase();
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
  }, [showFind, findText, caseSensitive, md]);

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
    const newVal = md.substring(0, start) + replaceText + md.substring(end);
    onChange(newVal);
    // stay near current match after replace
    setMatchIdx((m) => Math.min(m, matches.length - 2 < 0 ? 0 : matches.length - 2));
  }, [matches, matchIdx, findText, replaceText, md, onChange]);

  const replaceAll = useCallback(() => {
    if (matches.length === 0 || !findText) return;
    let out = '';
    let cursor = 0;
    for (const pos of matches) {
      out += md.substring(cursor, pos) + replaceText;
      cursor = pos + findText.length;
    }
    out += md.substring(cursor);
    onChange(out);
    setMatchIdx(0);
  }, [matches, findText, replaceText, md, onChange]);

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
      {/* ─── Toolbar ─── */}
      <div className="flex flex-wrap gap-1 py-1.5 border-b border-[var(--ds-gray-300)] mb-2">
        <ToolBtn label="Chord" onClick={openChordPicker} />
        <ToolBtn label="Section" onClick={(e) => openPopup(setShowSectionMenu, e)} />
        <ToolBtn label="Cue" onClick={(e) => openPopup(setShowCueInput, e)} />
        <ToolBtn label="Note" onClick={(e) => openPopup(setShowNoteInput, e)} />
        <ToolBtn label="Modulate" onClick={(e) => openPopup(setShowModMenu, e)} />
        <ToolBtn label="Tab" onClick={handleTabInsert} />
        <ToolBtn label="Find" onClick={() => setShowFind(true)} />
        {(onUndo || onRedo || onImport) && (
          <span className="w-px self-stretch bg-[var(--ds-gray-300)] mx-0.5" aria-hidden="true" />
        )}
        {onUndo && <ToolBtn label="Undo" onClick={onUndo} />}
        {onRedo && <ToolBtn label="Redo" onClick={onRedo} />}
        {onImport && <ToolBtn label="Paste import" onClick={onImport} />}
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
        value={md}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleTextareaKeyDown}
        spellCheck={false}
        className="flex-1 w-full min-h-[50vh] bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded-lg p-4 text-copy-13 leading-relaxed text-[var(--ds-gray-1000)] resize-y outline-none font-mono"
        style={{ caretColor: 'var(--chord)' }}
      />

      {/* ─── Popups ─── */}
      {showChordPicker && (
        <ChordPicker
          anchorRect={chordAnchor}
          onSelect={handleChordSelect}
          onClose={() => setShowChordPicker(false)}
          recentChords={effectiveRecent}
        />
      )}

      {showSectionMenu && (
        <Popup anchor={popupAnchor} onClose={() => setShowSectionMenu(false)}>
          <div className="flex flex-col gap-0.5">
            {sectionTypes.map(t => (
              <button
                key={t}
                onClick={() => handleSectionInsert(t)}
                className="bg-transparent border-none rounded-md px-3 py-1.5 text-left cursor-pointer text-copy-13 font-medium text-[var(--ds-gray-1000)] hover:bg-[var(--ds-gray-200)] transition-colors"
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

      {showModMenu && (
        <Popup anchor={popupAnchor} onClose={() => setShowModMenu(false)}>
          <div className="flex gap-1 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7].map(n => (
              <Button key={n} variant="brand" size="xs" onClick={() => handleModInsert(n)} className="w-9 text-center justify-center">
                +{n}
              </Button>
            ))}
          </div>
        </Popup>
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
