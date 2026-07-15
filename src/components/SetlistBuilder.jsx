import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { generateId } from '../parser';
import { semitonesBetween } from '../music';
import { resolveSongView, getArrangement } from '../arrangements';
import { mostPlayedKey } from '../keyHistory';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { toast } from './ui/use-toast';
import { useConfirm } from './ui/useConfirmHook';
import ScreenHeader from './ui/ScreenHeader';
import { SegmentedControl } from './ui/SegmentedControl';
import { nextSundayDateStr } from '../lib/dateFormat';

const UNDO_STACK_LIMIT = 50;
import SetlistMetaForm from './setlist/SetlistMetaForm';
import SetlistItemRow from './setlist/SetlistItemRow';
import SetlistSongPicker from './setlist/SetlistSongPicker';
import RecommendedNextPanel from './setlist/RecommendedNextPanel';

export default function SetlistBuilder({ songs, setlist, onSave, onBack, onDelete, knownServices = [], onDirtyChange, onUpdateSong, firstDayOfWeek = 'sunday', clockFormat = '12h' }) {
  const confirm = useConfirm();
  const [name, setName] = useState(setlist?.name || '');
  // New setlists default to the upcoming Sunday at 10:00 — the most common
  // worship slot. Existing ones keep whatever they were saved with.
  const [date, setDate] = useState(setlist?.date || nextSundayDateStr());
  const [time, setTime] = useState(setlist?.time || '10:00');
  // Optional end time — keeps the set in "Upcoming" / on the dashboard until it
  // actually ends, instead of dropping to "Past" at the start time.
  const [endTime, setEndTime] = useState(setlist?.endTime || '');
  const [location, setLocation] = useState(setlist?.location || '');
  // Migrate legacy `service` field → tags
  const [tags, setTags] = useState(() => {
    if (setlist?.tags?.length) return setlist.tags;
    if (setlist?.service) return [setlist.service];
    return [];
  });
  const [items, setItems] = useState(setlist?.items || []);
  const [service, setService] = useState(setlist?.service || '');
  // Optional rehearsal day — surfaces as a distinct entry on the schedule.
  const [rehearsalDate, setRehearsalDate] = useState(setlist?.rehearsalDate || '');
  const [rehearsalTime, setRehearsalTime] = useState(setlist?.rehearsalTime || '19:00');
  const [rehearsalLocation, setRehearsalLocation] = useState(setlist?.rehearsalLocation || '');
  // New setlists start as drafts; existing ones without a status are treated as
  // ready (don't surprise-demote a legacy setlist to draft on edit).
  const [status, setStatus] = useState(setlist?.status || (setlist ? 'ready' : 'draft'));
  // Builder tabs — Roster only available once the setlist has been saved.

  // Snapshot the form on first render so Cancel/back can warn about unsaved
  // changes (only when something actually changed — no nag on a pristine form).
  const [initialSnapshot] = useState(() => JSON.stringify({ name, date, time, endTime, location, tags, items, service, status, rehearsalDate, rehearsalTime, rehearsalLocation }));
  const isDirty = JSON.stringify({ name, date, time, endTime, location, tags, items, service, status, rehearsalDate, rehearsalTime, rehearsalLocation }) !== initialSnapshot;

  // Report dirty state up so App can guard header nav / browser back. Reset on
  // unmount so a stale flag never blocks navigation after we leave.
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const handleCancel = async () => {
    if (isDirty) {
      const ok = await confirm({
        title: 'Discard changes?',
        description: 'You have unsaved changes to this setlist. They will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        variant: 'danger',
      });
      if (!ok) return;
    }
    onBack();
  };

  // Per-item song numbers (1-based, breaks excluded). Computed once per
  // items change so SetlistItemRow can render "01", "02", … on songs only.
  const songNumberFor = useMemo(() => {
    const acc = { count: 0 };
    const map = {};
    items.forEach((it, idx) => {
      if (it.type !== 'break') {
        acc.count += 1;
        map[idx] = acc.count;
      }
    });
    return map;
  }, [items]);
  const undoStackRef = useRef([]);

  // Wraps setItems for structural mutations (add/remove/reorder) that
  // should be undoable via Cmd/Ctrl+Z. Pushes the previous state onto the
  // undo stack before applying the update. Text-field edits go through
  // setItems directly to avoid per-keystroke snapshots.
  const applyStructural = useCallback((updater) => {
    setItems(prev => {
      undoStackRef.current.push(prev);
      if (undoStackRef.current.length > UNDO_STACK_LIMIT) undoStackRef.current.shift();
      return typeof updater === 'function' ? updater(prev) : updater;
    });
  }, []);

  const undo = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (prev !== undefined) {
      setItems(prev);
      toast({ title: 'Undone', description: 'Reverted the last change.' });
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo]);

  // Drag state
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // Auto-scroll to a freshly added song/break. addSong/addBreak set the flag;
  // an effect on `items` then scrolls the end marker into view once it mounts.
  const listEndRef = useRef(null);
  const scrollPendingRef = useRef(false);
  useEffect(() => {
    if (scrollPendingRef.current) {
      scrollPendingRef.current = false;
      listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [items]);

  // Adds a song to the setlist. Defaults the transpose so the song lands in
  // its most-played key (when keyHistory has data); otherwise leaves it at 0.
  // overrideKey, when supplied (e.g. from the recommendations panel), wins.
  const addSong = (song, overrideKey) => {
    if (!song) return;
    const arr = getArrangement(song);
    const arrangementId = arr?.id || song.defaultArrangementId;
    const arrangementName = arr?.name || 'Main Arrangement';
    const targetKey = overrideKey || mostPlayedKey(song.keyHistory);
    let transpose = 0;
    if (targetKey && arr?.key && targetKey !== arr.key) {
      const semis = semitonesBetween(arr.key, targetKey);
      // semitonesBetween returns 0..11 — wrap to nearest in [-6, 6] for a
      // sensible UI default (small + or - rather than always positive).
      transpose = semis > 6 ? semis - 12 : semis;
      toast({
        title: `Most played in ${targetKey}`,
        description: `Transposed ${transpose > 0 ? '+' : ''}${transpose}`,
      });
    }
    scrollPendingRef.current = true;
    applyStructural(p => [...p, {
      songId: song.id,
      songTitle: song.title,
      arrangementId,
      arrangementName,
      note: '',
      transpose,
      capo: 0,
    }]);
  };
  const addBreak = () => {
    scrollPendingRef.current = true;
    applyStructural(p => [...p, { type: 'break', label: '', note: '', duration: 0 }]);
  };
  const removeItem = async (idx) => {
    const item = items[idx];
    const isBreak = item?.type === 'break';
    const ok = await confirm({
      title: isBreak ? 'Remove break?' : 'Remove song?',
      description: isBreak
        ? 'This break will be removed from the setlist.'
        : `"${item?.songTitle || 'This song'}" will be removed from the setlist.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
      variant: 'danger',
    });
    if (!ok) return;
    applyStructural(p => p.filter((_, i) => i !== idx));
  };

  // Move item up or down by one position (for mobile-friendly reorder buttons)
  const moveItem = useCallback((fromIdx, toIdx) => {
    applyStructural(prev => {
      if (toIdx < 0 || toIdx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, [applyStructural]);
  const updateNote = (idx, note) =>
    setItems(p => p.map((it, i) => i === idx ? { ...it, note } : it));
  const updateTranspose = (idx, val) =>
    setItems(p => p.map((it, i) => i === idx ? { ...it, transpose: val } : it));
  const updateCapo = (idx, val) =>
    setItems(p => p.map((it, i) => i === idx ? { ...it, capo: val } : it));
  const updateBreakField = (idx, field, value) =>
    setItems(p => p.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  const getSong = (id, title, arrangementId) => {
    let s = songs.find(s => s.id === id);
    if (!s && title) s = songs.find(s => s.title === title);
    return s ? resolveSongView(s, arrangementId) : null;
  };

  // Drag handlers
  const handleDragStart = useCallback((idx) => {
    setDragIdx(idx);
  }, []);

  const handleDragEnter = useCallback((idx) => {
    setDragOverIdx(idx);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIdx(dragIdx => {
      setDragOverIdx(dragOverIdx => {
        if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
          return null;
        }
        applyStructural(prev => {
          const next = [...prev];
          const [moved] = next.splice(dragIdx, 1);
          next.splice(dragOverIdx, 0, moved);
          return next;
        });
        return null;
      });
      return null;
    });
  }, [applyStructural]);

  // Touch drag for mobile
  const handleTouchStart = useCallback((idx) => {
    setDragIdx(idx);
  }, []);

  const handleTouchMove = useCallback((e) => {
    // Determine the element underneath the pointer
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el) {
      const row = el.closest('[data-drag-idx]');
      if (row) {
        setDragOverIdx(parseInt(row.dataset.dragIdx, 10));
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: 'Name required', description: 'Please enter a setlist name.', variant: 'error' });
      return;
    }
    onSave({
      ...setlist, // preserve fields the builder doesn't edit (workspace/authorship/etc.)
      id: setlist?.id || generateId(),
      name: name.trim(), date, time, endTime: endTime || '', location, tags, items, service, status,
      rehearsalDate: rehearsalDate || null,
      rehearsalTime: rehearsalDate ? rehearsalTime : null,
      rehearsalLocation: rehearsalDate ? (rehearsalLocation || null) : null,
      createdAt: setlist?.createdAt || Date.now(),
    });
  };

  // Delete is undoable — App shows a 5s "Undo" toast — so no confirm modal here.
  const handleDelete = () => { onDelete(setlist.id); };

  return (
    <div className="min-h-screen material-page flex flex-col">

      {/* ── Sticky header — title + secondary actions only. The primary
          Save / Cancel pair lives in the bottom action bar where it's
          always thumb-reachable on tablet/mobile. The back chevron is
          gone; bail-out lives in Cancel below. ── */}
      <ScreenHeader
        title={setlist ? 'Edit Setlist' : 'New Setlist'}
        actions={
          <div className="flex items-center gap-2">
             <SegmentedControl
               value={status}
               onChange={setStatus}
               size="sm"
               options={[
                 { value: 'draft', label: 'Draft' },
                 { value: 'ready', label: 'Ready' },
               ]}
             />
             {setlist && onDelete && (
               <IconButton variant="error" size="sm" onClick={handleDelete} aria-label="Delete setlist">
                 <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                 </svg>
               </IconButton>
             )}
           </div>
        }
      />

      {/* ── Content: responsive two-column layout. flex-1 makes this fill
          all available space so the Save/Cancel bar below pins to the
          bottom of <main> even when the form is short. ── */}
      <div className="flex-1 w-full max-w-5xl mx-auto px-5 pt-6 pb-12">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Left column: meta + current set */}
          <div className="flex-1 min-w-0 flex flex-col gap-8">

            {/* Meta form */}
            <SetlistMetaForm
              name={name}
              date={date}
              time={time}
              endTime={endTime}
              location={location}
              tags={tags}
              service={service}
              rehearsalDate={rehearsalDate}
              rehearsalTime={rehearsalTime}
              rehearsalLocation={rehearsalLocation}
              firstDayOfWeek={firstDayOfWeek}
              clockFormat={clockFormat}
              onNameChange={setName}
              onDateChange={setDate}
              onTimeChange={setTime}
              onEndTimeChange={setEndTime}
              onLocationChange={setLocation}
              onTagsChange={setTags}
              onServiceChange={setService}
              onRehearsalDateChange={setRehearsalDate}
              onRehearsalTimeChange={setRehearsalTime}
              onRehearsalLocationChange={setRehearsalLocation}
              knownServices={knownServices}
            />

            {/* Divider */}
            <div className="border-t border-[var(--ds-gray-300)]" />

            {/* Current set */}
            <div>
              <p className="text-label-12 font-semibold text-[var(--ds-gray-600)] m-0 mb-4">Current Set</p>

              <div className="flex flex-col gap-2">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    data-drag-idx={idx}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => e.preventDefault()}
                    className={dragIdx === idx ? 'opacity-50' : ''}
                    style={{
                      transform: dragOverIdx !== null && dragIdx !== null && dragOverIdx !== dragIdx
                        ? (
                            (idx === dragOverIdx && dragIdx < dragOverIdx)
                              ? 'translateY(-4px)'
                              : (idx === dragOverIdx && dragIdx > dragOverIdx)
                                ? 'translateY(4px)'
                                : 'none'
                          )
                        : 'none',
                      borderTop: dragOverIdx !== null && dragIdx !== null && dragIdx > dragOverIdx && idx === dragOverIdx ? '2px solid var(--color-brand)' : '',
                      borderBottom: dragOverIdx !== null && dragIdx !== null && dragIdx < dragOverIdx && idx === dragOverIdx ? '2px solid var(--color-brand)' : '',
                      transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)'
                    }}
                  >
                    <SetlistItemRow
                      item={item}
                      idx={idx}
                      songNum={songNumberFor[idx]}
                      song={item.type !== 'break' ? getSong(item.songId, item.songTitle, item.arrangementId) : null}
                      rawSong={item.type !== 'break' ? songs.find(s => s.id === item.songId) : null}
                      onSelectArrangement={(arrId) => setItems(p => p.map((it, i) => {
                        if (i !== idx) return it;
                        const raw = songs.find(s => s.id === it.songId);
                        const newArr = getArrangement(raw, arrId);
                        const oldArr = getArrangement(raw, it.arrangementId);
                        // Preserve transpose only when the source key matches.
                        const keepTranspose = newArr && oldArr && newArr.key === oldArr.key;
                        return {
                          ...it,
                          arrangementId: arrId,
                          arrangementName: newArr?.name || it.arrangementName,
                          transpose: keepTranspose ? it.transpose : 0,
                        };
                      }))}
                      onRemove={removeItem}
                      onUpdateNote={updateNote}
                      onUpdateTranspose={updateTranspose}
                      onUpdateCapo={updateCapo}
                      onUpdateSong={onUpdateSong}
                      onUpdateBreakField={updateBreakField}
                      onMoveUp={() => moveItem(idx, idx - 1)}
                      onMoveDown={() => moveItem(idx, idx + 1)}
                      isFirst={idx === 0}
                      isLast={idx === items.length - 1}
                      dragHandleProps={{
                        onTouchStart: (e) => handleTouchStart(idx, e),
                        onTouchMove: handleTouchMove,
                        onTouchEnd: handleTouchEnd,
                        onTouchCancel: handleTouchEnd,
                      }}
                    />
                  </div>
                ))}
              </div>

              {items.length === 0 && (
                <div className="py-10 text-center border-2 border-dashed border-[var(--ds-gray-400)] rounded-xl text-copy-14 text-[var(--ds-gray-700)]">
                  Add songs from the library below
                </div>
              )}

              {/* Add buttons */}
              <div className="flex gap-2 mt-3">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={addBreak}
                  onKeyDown={e => e.key === 'Enter' && addBreak()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[var(--ds-gray-alpha-100)] border border-dashed border-[var(--ds-gray-400)] text-label-12 font-semibold text-[var(--ds-gray-600)] cursor-pointer hover:bg-[var(--ds-gray-200)] hover:border-[var(--ds-gray-500)] transition-colors select-none"
                >
                  + Add Break
                </div>
              </div>
              {/* Scroll anchor below the add buttons so adding an item reveals
                  the new card AND the add controls. The bottom scroll-margin
                  clears the fixed Save/Cancel action bar so nothing hides
                  under it. */}
              <div ref={listEndRef} className="h-px" style={{ scrollMarginBottom: '7rem' }} />
            </div>
          </div>

          {/* Right column: song library picker — pinned on desktop so it
              stays in view as the user scrolls a long set of items below.
              `top-20` clears the sticky ScreenHeader; the height clamp
              leaves room for the bottom action bar at the foot of <main>. */}
          <div className="lg:w-[320px] shrink-0 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto flex flex-col gap-4">
            <SetlistSongPicker
              songs={songs}
              currentItems={items}
              onAddSong={addSong}
            />
            <RecommendedNextPanel
              songs={songs}
              currentItems={items}
              onAddSong={(song, suggestedKey) => addSong(song, suggestedKey)}
            />
          </div>

        </div>
      </div>

      {/* ── Sticky bottom action bar ──
          Save lives here so it's always thumb-reachable on tablets/phones
          without scrolling, and so it pairs naturally with Cancel — the
          standard form pattern. Sticky (not fixed) so the bar stops at the
          edge of <main> on desktop instead of running under the sidebar. */}
      <div
        className="sticky bottom-0 z-30 border-t border-[var(--ds-gray-300)] w-full"
        style={{
          background: 'var(--header-bg-blur)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="w-full px-5 py-3 flex items-center justify-end gap-2">
          <Button variant="ghost" size="md" onClick={handleCancel}>Cancel</Button>
          <Button variant="brand" size="md" onClick={handleSave}>Save</Button>
        </div>
      </div>
    </div>
  );
}
