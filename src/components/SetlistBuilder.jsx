import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { generateId } from '@/parser';
import { semitonesBetween } from '@/music';
import { resolveSongView, getArrangement } from '@/arrangements';
import { mostPlayedKey } from '@/keyHistory';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { toast } from '@/ui/use-toast';
import { showUndoToast } from '@/lib/undoToast';
import { useConfirm } from '@/ui/useConfirmHook';
import ScreenHeader from '@/ui/ScreenHeader';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { nextSundayDateStr } from '@/lib/dateFormat';

const UNDO_STACK_LIMIT = 50;
import SetlistMetaForm from '@/components/setlist/SetlistMetaForm';
import SetlistItemRow from '@/components/setlist/SetlistItemRow';
import SetlistCardRow from '@/components/setlist/SetlistCardRow';
import SetlistIdentityCard from '@/components/setlist/SetlistIdentityCard';
import SetlistSongPicker from '@/components/setlist/SetlistSongPicker';
import RecommendedNextPanel from '@/components/setlist/RecommendedNextPanel';
import { useDragReorder } from '@/lib/useDragReorder';

export default function SetlistBuilder({ songs, setlist, onSave, onBack, onDelete, knownServices = [], onDirtyChange, onUpdateSong, firstDayOfWeek = 'sunday', clockFormat = '12h', cards = true }) {
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
  // Setlist-level note (shared across the whole set — distinct from per-song
  // cue notes and per-break notes).
  const [notes, setNotes] = useState(setlist?.notes || '');

  // Snapshot the form on first render so Cancel/back can warn about unsaved
  // changes (only when something actually changed — no nag on a pristine form).
  const [initialSnapshot] = useState(() => JSON.stringify({ name, date, time, endTime, location, tags, items, service, status, rehearsalDate, rehearsalTime, rehearsalLocation, notes }));
  const isDirty = JSON.stringify({ name, date, time, endTime, location, tags, items, service, status, rehearsalDate, rehearsalTime, rehearsalLocation, notes }) !== initialSnapshot;

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
  // Remove immediately and offer a timed Undo toast (no blocking modal) — the
  // same countdown toast the song editor uses. Undo re-inserts the exact item
  // at its original position.
  const removeItem = (idx) => {
    const removed = items[idx];
    if (!removed) return;
    const isBreak = removed.type === 'break';
    applyStructural(p => p.filter((_, i) => i !== idx));
    showUndoToast({
      title: `${isBreak ? 'Break' : (removed.songTitle || 'Song')} removed`,
      onUndo: () => setItems(p => { const n = [...p]; n.splice(Math.min(idx, n.length), 0, removed); return n; }),
    });
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
  // Generic per-item field update (cards row: key/capo/tempo/structure/note/…).
  const updateItemField = (idx, field, value) =>
    setItems(p => p.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  // Reorder used by the drag hook (grip drag + touch).
  const reorderItems = useCallback((from, to) => {
    applyStructural(prev => {
      if (from == null || to == null || from === to || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, [applyStructural]);
  const getSong = (id, title, arrangementId) => {
    let s = songs.find(s => s.id === id);
    if (!s && title) s = songs.find(s => s.title === title);
    return s ? resolveSongView(s, arrangementId) : null;
  };

  // Card-language drag-to-reorder (grip HTML5 + native touch + autoscroll).
  const dnd = useDragReorder(reorderItems);
  // Running "N songs · ~X min" for the Set card header. Unknown song lengths
  // estimate at 4 min so the total is never wildly off; breaks add their minutes.
  const setStats = useMemo(() => {
    let songCount = 0;
    let seconds = 0;
    for (const it of items) {
      if (it.type === 'break') { seconds += (it.duration || 0) * 60; continue; }
      songCount += 1;
      const s = songs.find(x => x.id === it.songId);
      const arr = s ? getArrangement(s, it.arrangementId) : null;
      const dur = it.tempo ? null : arr?.duration;
      seconds += dur || 240;
    }
    return { songCount, minutes: Math.round(seconds / 60) };
  }, [items, songs]);

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
      notes: notes || '',
      rehearsalDate: rehearsalDate || null,
      rehearsalTime: rehearsalDate ? rehearsalTime : null,
      rehearsalLocation: rehearsalDate ? (rehearsalLocation || null) : null,
      createdAt: setlist?.createdAt || Date.now(),
    });
  };

  // Delete is undoable — App shows a 5s "Undo" toast — so no confirm modal here.
  const handleDelete = () => { onDelete(setlist.id); };

  // Per-item arrangement switch (preserve transpose only when source keys match).
  const selectArrangement = (idx, arrId) => setItems(p => p.map((it, i) => {
    if (i !== idx) return it;
    const raw = songs.find(s => s.id === it.songId);
    const newArr = getArrangement(raw, arrId);
    const oldArr = getArrangement(raw, it.arrangementId);
    const keepTranspose = newArr && oldArr && newArr.key === oldArr.key;
    return { ...it, arrangementId: arrId, arrangementName: newArr?.name || it.arrangementName, transpose: keepTranspose ? it.transpose : 0 };
  }));

  // ─────────────────────────── Card-language layout ──────────────────────────
  if (cards) {
    const identityProps = {
      name, date, time, endTime, location, tags, service,
      rehearsalDate, rehearsalTime, rehearsalLocation, notes, status,
      knownServices, firstDayOfWeek, clockFormat,
      onNameChange: setName, onDateChange: setDate, onTimeChange: setTime,
      onEndTimeChange: setEndTime, onLocationChange: setLocation, onTagsChange: setTags,
      onServiceChange: setService, onRehearsalDateChange: setRehearsalDate,
      onRehearsalTimeChange: setRehearsalTime, onRehearsalLocationChange: setRehearsalLocation,
      onNotesChange: setNotes, onStatusChange: setStatus,
    };

    const libraryContent = (
      <div className="flex flex-col gap-5">
        <SetlistSongPicker songs={songs} currentItems={items} onAddSong={addSong} />
        <RecommendedNextPanel songs={songs} currentItems={items} onAddSong={(song, k) => addSong(song, k)} />
      </div>
    );

    const setRows = (
      <div className="flex flex-col gap-2" role="list">
        {items.map((item, idx) => (
          <div key={idx} {...dnd.getRowProps(idx)}>
            <SetlistCardRow
              item={item}
              idx={idx}
              songNum={songNumberFor[idx]}
              song={item.type !== 'break' ? getSong(item.songId, item.songTitle, item.arrangementId) : null}
              rawSong={item.type !== 'break' ? songs.find(s => s.id === item.songId) : null}
              onRemove={removeItem}
              onUpdateField={updateItemField}
              onSelectArrangement={(arrId) => selectArrangement(idx, arrId)}
              gripProps={dnd.getGripProps(idx)}
              dragging={dnd.dragIdx === idx}
              dragOver={dnd.dragOverIdx === idx && dnd.dragIdx !== null && dnd.dragIdx !== idx}
            />
          </div>
        ))}
      </div>
    );

    return (
      <div className="min-h-screen material-page flex flex-col">
        <div className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-5 pt-4 pb-28 lg:pb-6 flex flex-col gap-3">
          <SetlistIdentityCard {...identityProps} />

          <div className="flex flex-col lg:flex-row gap-3 items-start">
            {/* Set card */}
            <div className="flex-1 min-w-0 w-full rounded-2xl border border-[var(--border-1)] bg-[var(--ds-background-100)] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-1)]">
                <h3 className="text-heading-14 font-semibold text-[var(--ds-gray-1000)] m-0">Set order</h3>
                <span className="text-copy-12 text-[var(--ds-gray-600)]">
                  {setStats.songCount} {setStats.songCount === 1 ? 'song' : 'songs'} · ~{setStats.minutes} min
                </span>
                <span className="flex-1" />
                <span className="hidden sm:inline text-copy-12 text-[var(--ds-gray-500)]">drag to reorder</span>
              </div>
              <div className="p-3">
                {items.length === 0 ? (
                  <div className="py-10 text-center border-2 border-dashed border-[var(--ds-gray-400)] rounded-xl text-copy-14 text-[var(--ds-gray-700)]">
                    Add songs from the library
                  </div>
                ) : setRows}
                <div className="flex mt-3">
                  <button
                    type="button"
                    onClick={addBreak}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-[var(--color-brand-border)] text-label-12 font-semibold text-[var(--color-brand-text)] cursor-pointer hover:bg-[var(--color-brand-soft)] transition-colors"
                  >
                    + Add break
                  </button>
                </div>
              </div>
            </div>

            {/* Library card — beside the set on desktop, stacked below on mobile */}
            <div className="w-full lg:w-[340px] shrink-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto rounded-2xl border border-[var(--border-1)] bg-[var(--ds-background-100)] p-4">
              <h3 className="text-heading-14 font-semibold text-[var(--ds-gray-1000)] m-0 mb-4">Library</h3>
              {libraryContent}
            </div>
          </div>
        </div>

        {/* Sticky bottom Save/Cancel — a floating card (mirrors the song editor)
            rather than a full-width bar. */}
        <div className="sticky bottom-0 z-30 px-3 sm:px-5 pt-2 pb-3 pointer-events-none">
          <div
            className="max-w-6xl mx-auto rounded-xl border border-[var(--border-1)] bg-[var(--ds-background-100)] shadow-lg px-3 sm:px-4 py-2.5 flex items-center gap-3 pointer-events-auto"
            style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {!name.trim() && (
              <span className="inline-flex items-center gap-1.5 text-label-11 font-semibold text-[var(--ds-amber-700,#b45309)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                Add a setlist name to save
              </span>
            )}
            <span className="flex-1" />
            <Button variant="ghost" size="md" onClick={handleCancel}>Cancel</Button>
            <Button variant="brand" size="md" onClick={handleSave} disabled={!name.trim()}>Save</Button>
          </div>
        </div>
      </div>
    );
  }

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
