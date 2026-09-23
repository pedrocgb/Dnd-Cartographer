"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { EMPTY_HISTORY, pushEntry, takeRedo, takeUndo, type EditEntry, type HistoryState } from "./edit-history";

export interface EditHistory {
  /** Records an edit; ignored while an undo/redo is being applied. */
  record: (entry: Omit<EditEntry, "at">) => void;
  undo: () => void;
  redo: () => void;
  undoLabel: string | null;
  redoLabel: string | null;
}

/**
 * Undo/redo over the last edits. An entry's undo/redo runs the same mutation
 * functions a user edit does; those record nothing while it runs (their
 * recording is synchronous, so a flag around the call is enough). Steps run
 * one at a time, each waiting for the previous one's server call, so fast
 * key presses can't reorder them.
 */
export function useEditHistory(): EditHistory {
  const [state, setState] = useState<HistoryState>(EMPTY_HISTORY);
  const stateRef = useRef(state);
  const replayingRef = useRef(false);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const commit = useCallback((next: HistoryState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const record = useCallback(
    (entry: Omit<EditEntry, "at">) => {
      if (replayingRef.current) return;
      commit(pushEntry(stateRef.current, { ...entry, at: Date.now() }));
    },
    [commit]
  );

  const step = useCallback(
    (direction: "undo" | "redo") => {
      queueRef.current = queueRef.current.then(async () => {
        const taken = direction === "undo" ? takeUndo(stateRef.current) : takeRedo(stateRef.current);
        if (!taken) return;
        commit(taken.state);
        let pending: unknown;
        replayingRef.current = true;
        try {
          pending = taken.entry[direction]();
        } finally {
          replayingRef.current = false;
        }
        try {
          await pending;
        } catch (err) {
          console.error(`Could not ${direction} "${taken.entry.label}"`, err);
        }
      });
    },
    [commit]
  );

  const undo = useCallback(() => step("undo"), [step]);
  const redo = useCallback(() => step("redo"), [step]);

  return useMemo(
    () => ({
      record,
      undo,
      redo,
      undoLabel: state.past[state.past.length - 1]?.label ?? null,
      redoLabel: state.future[state.future.length - 1]?.label ?? null,
    }),
    [record, undo, redo, state]
  );
}
