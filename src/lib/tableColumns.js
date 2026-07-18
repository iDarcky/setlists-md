// Shared column-customization model for the list tables (Songs + Setlists).
// Same mechanism for both: a per-table set of optional columns the user can
// show/hide, persisted in settings.tableColumns and synced across devices.
// The Name/Title column and the select checkbox are always present (not listed
// here). Entitlement-gated columns declare `requires`, checked against a
// per-table context (showService / showSchedule).

export const TABLE_COLUMNS = {
  library: [
    { id: 'artist', label: 'Artist' },
    { id: 'key', label: 'Key' },
    { id: 'tempo', label: 'Tempo' },
    { id: 'tags', label: 'Tags' },
    { id: 'updated', label: 'Updated' },
    // Extra columns unlocked by the songsLibraryPlus Labs flag.
    { id: 'ccli', label: 'CCLI', requires: 'plus' },
    { id: 'year', label: 'Year', requires: 'plus' },
    { id: 'capo', label: 'Capo', requires: 'plus' },
    { id: 'duration', label: 'Duration', requires: 'plus' },
    { id: 'arrangements', label: 'Arrangements', requires: 'plus' },
    { id: 'themes', label: 'Themes', requires: 'plus' },
    { id: 'language', label: 'Language', requires: 'plus' },
    { id: 'scripture', label: 'Scripture', requires: 'plus' },
    { id: 'usage', label: 'Setlists', requires: 'plus' },
  ],
  setlists: [
    { id: 'date', label: 'Date' },
    { id: 'songs', label: 'Songs' },
    { id: 'service', label: 'Service', requires: 'showService' },
    { id: 'instr', label: 'Instruments', requires: 'showSchedule' },
    { id: 'vocals', label: 'Vocals', requires: 'showSchedule' },
    { id: 'sched', label: 'Scheduled', requires: 'showSchedule' },
    { id: 'tags', label: 'Tags' },
    // Extra column unlocked by the setlistsLibraryPlus Labs flag.
    { id: 'duration', label: 'Duration', requires: 'plus' },
  ],
};

// Columns shown by default — mirrors each table's pre-customization behavior.
// New, opt-in columns (e.g. Tempo / Updated) are intentionally left off.
export const DEFAULT_VISIBLE = {
  library: ['artist', 'key', 'tags'],
  setlists: ['date', 'songs', 'service', 'instr', 'vocals', 'sched', 'tags'],
};

// Columns available in the current context (entitlement gates applied).
export function availableColumns(table, context = {}) {
  return (TABLE_COLUMNS[table] || []).filter(c => !c.requires || context[c.requires]);
}

// The visible column ids as a Set, honoring saved prefs when present and
// per-table defaults otherwise, intersected with what's available. A column
// absent from a saved list is treated as hidden (so new columns are opt-in).
export function resolveVisibleColumns(table, saved, context = {}) {
  const available = availableColumns(table, context).map(c => c.id);
  const savedForTable = saved && saved[table];
  const hasSaved = Array.isArray(savedForTable);
  const visible = new Set();
  for (const id of available) {
    const on = hasSaved ? savedForTable.includes(id) : DEFAULT_VISIBLE[table].includes(id);
    if (on) visible.add(id);
  }
  return visible;
}

// Toggle a column id on/off, preserving the user's saved column order. A newly
// shown column is appended at the end; hiding removes it from the order.
export function toggleColumn(table, saved, context, id) {
  const order = savedOrder(table, saved, context);
  const visible = resolveVisibleColumns(table, saved, context);
  if (visible.has(id)) return order.filter(cid => cid !== id);
  return [...order, id];
}

// The saved (or default) ordered list of VISIBLE column ids, intersected with
// what's currently available. Honors a user-defined order; any available column
// not present in the saved order but visible-by-default is appended in canonical
// order (so new default columns still appear after a customization).
function savedOrder(table, saved, context) {
  const available = availableColumns(table, context).map(c => c.id);
  const visible = resolveVisibleColumns(table, saved, context);
  const savedForTable = saved && saved[table];
  const ordered = [];
  if (Array.isArray(savedForTable)) {
    for (const id of savedForTable) {
      if (available.includes(id) && visible.has(id) && !ordered.includes(id)) ordered.push(id);
    }
  }
  for (const id of available) {
    if (visible.has(id) && !ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}

// Ordered array of visible column DESCRIPTORS ({ id, label, requires }), honoring
// the user's saved order. Used by the tables to render cells + by ColumnsMenu's
// reorder list.
export function orderedVisibleColumns(table, saved, context = {}) {
  const byId = Object.fromEntries((TABLE_COLUMNS[table] || []).map(c => [c.id, c]));
  return savedOrder(table, saved, context).map(id => byId[id]).filter(Boolean);
}

// Move a visible column to a new index within the visible order, returning the
// next id array to persist (full available-order aware).
export function reorderColumns(table, saved, context, id, toIndex) {
  const order = savedOrder(table, saved, context);
  const from = order.indexOf(id);
  if (from === -1) return order;
  const next = [...order];
  next.splice(from, 1);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, id);
  return next;
}

// The default visible ids for a table, available-only — used by "Reset".
export function defaultVisibleColumns(table, context = {}) {
  return availableColumns(table, context).map(c => c.id).filter(id => DEFAULT_VISIBLE[table].includes(id));
}
