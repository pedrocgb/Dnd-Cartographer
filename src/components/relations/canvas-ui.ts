"use client";

import { createContext, type ReactNode } from "react";
import type { BoardArrow } from "@/server/relations/boards";
import type { CanvasCard } from "./RelationsCanvas";

/** Per-canvas hooks the card and arrow components read (toolbars, note and label editing). */
export interface CanvasUi {
  renderToolbar?: (card: CanvasCard) => ReactNode;
  onNoteText?: (id: string, text: string) => void;
  onNoteResize?: (id: string, size: { w: number; h: number }) => void;
  /** Cards show dots to drag arrows from (Boards). */
  connectable?: boolean;
  /** `editLabel` opens the arrow's label for writing. */
  renderArrowToolbar?: (arrow: BoardArrow, editLabel: () => void) => ReactNode;
  onArrowLabel?: (id: string, label: string) => void;
  /** The arrow whose label is being written, if any. */
  editingArrow?: string | null;
  setEditingArrow?: (id: string | null) => void;
  /** The group whose title is being written, if any. */
  editingGroup?: string | null;
  setEditingGroup?: (id: string | null) => void;
  onGroupRename?: (id: string, title: string) => void;
}

export const CanvasUiContext = createContext<CanvasUi>({});
