/**
 * Undo/redo history of map edits (pure; see use-edit-history.ts for the
 * React side). Entries are closures that re-apply a change through the
 * workspace's own mutation functions.
 */

export interface EditEntry {
  /** Shown in the toolbar button titles ("Undo: Move marker"). */
  label: string;
  /** Pushes with the same key close together merge into one step (a slider drag). */
  key?: string;
  /** Time of the latest push merged into this entry (ms). */
  at: number;
  undo: () => unknown;
  redo: () => unknown;
}

export interface HistoryState {
  past: EditEntry[];
  future: EditEntry[];
}

export const HISTORY_LIMIT = 10;
export const COALESCE_MS = 1500;
export const EMPTY_HISTORY: HistoryState = { past: [], future: [] };

/** Records a new edit: clears the redo stack and keeps only the last HISTORY_LIMIT edits. */
export function pushEntry(state: HistoryState, entry: EditEntry): HistoryState {
  const last = state.past[state.past.length - 1];
  if (entry.key && last?.key === entry.key && state.future.length === 0 && entry.at - last.at <= COALESCE_MS) {
    // Same continuous edit: undo still goes back to before its first step.
    const merged: EditEntry = { ...entry, undo: last.undo };
    return { past: [...state.past.slice(0, -1), merged], future: [] };
  }
  return { past: [...state.past, entry].slice(-HISTORY_LIMIT), future: [] };
}

export function takeUndo(state: HistoryState): { entry: EditEntry; state: HistoryState } | null {
  const entry = state.past[state.past.length - 1];
  if (!entry) return null;
  return { entry, state: { past: state.past.slice(0, -1), future: [...state.future, entry] } };
}

export function takeRedo(state: HistoryState): { entry: EditEntry; state: HistoryState } | null {
  const entry = state.future[state.future.length - 1];
  if (!entry) return null;
  // Not coalescable with whatever gets pushed next.
  return { entry, state: { past: [...state.past, { ...entry, key: undefined }], future: state.future.slice(0, -1) } };
}
