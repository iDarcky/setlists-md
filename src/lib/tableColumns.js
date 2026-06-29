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
  ],
  setlists: [
    { id: 'date', label: 'Date' },
    { id: 'songs', label: 'Songs' },
    { id: 'service', label: 'Service', requires: 'showService' },
    { id: 'instr', label: 'Instruments', requires: 'showSchedule' },
    { id: 'vocals', label: 'Vocals', requires: 'showSchedule' },
    { id: 'sched', label: 'Scheduled', requires: 'showSchedule' },
    { id: 'tags', label: 'Tags' },
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

// Toggle a column id on/off, returning the next ordered id array (in canonical
// column order, available-only) to persist.
export function toggleColumn(table, saved, context, id) {
  const visible = resolveVisibleColumns(table, saved, context);
  if (visible.has(id)) visible.delete(id);
  else visible.add(id);
  return availableColumns(table, context).map(c => c.id).filter(cid => visible.has(cid));
}

// The default visible ids for a table, available-only — used by "Reset".
export function defaultVisibleColumns(table, context = {}) {
  return availableColumns(table, context).map(c => c.id).filter(id => DEFAULT_VISIBLE[table].includes(id));
}
