"use client";

import { useEffect, useRef, useState } from "react";
import { Folder, Plus, RotateCcw, Settings, Trash2, X } from "lucide-react";
import ColorWheel from "@/components/ColorWheel";
import { MAX_FOLDER_NAME_LENGTH } from "@/server/maps/folders";
import type { FolderSummary } from "./types";

/** The folder icon's color when none is set (--brass-400). */
export const DEFAULT_FOLDER_COLOR = "#D29C53";
/** The color wheel reports every drag step; saves wait for it to settle. */
const COLOR_SAVE_DELAY_MS = 300;

/**
 * A folder's side panel (opened from its Settings button): rename, icon
 * color, create a map inside, delete. Mount it keyed by folder id.
 */
export default function FolderSettingsPanel({
  folder,
  itemCount,
  onPatch,
  onCreateMap,
  onDelete,
  onClose,
}: {
  folder: FolderSummary;
  /** Folders and maps directly inside. */
  itemCount: number;
  /** Saves a change; resolves an error message, or null. */
  onPatch: (body: { name?: string; color?: string | null }) => Promise<string | null>;
  onCreateMap: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(folder.name);
  const [color, setColor] = useState(folder.color);
  const [error, setError] = useState<string | null>(null);
  const colorTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Remounts the wheel on reset so it picks up the default again.
  const [wheelKey, setWheelKey] = useState(0);

  useEffect(() => () => clearTimeout(colorTimerRef.current), []);

  async function save(body: { name?: string; color?: string | null }) {
    setError(await onPatch(body));
  }

  function commitName() {
    const next = name.trim();
    if (!next) return setName(folder.name);
    if (next !== folder.name) void save({ name: next });
  }

  function changeColor(next: string | null) {
    setColor(next);
    clearTimeout(colorTimerRef.current);
    colorTimerRef.current = setTimeout(() => void save({ color: next }), COLOR_SAVE_DELAY_MS);
  }

  return (
    <aside className="marker-side-panel maps-settings-panel" aria-label="Folder settings">
      <div className="marker-side-panel-header">
        <h2>
          <Settings size={16} strokeWidth={2.25} aria-hidden />
          Folder settings
        </h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close folder settings">
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>
      <p className="maps-settings-subject">
        <Folder size={15} strokeWidth={2.25} aria-hidden style={{ color: color ?? DEFAULT_FOLDER_COLOR }} />
        <span>
          {folder.name} ({itemCount})
        </span>
      </p>

      <label className="field-label" htmlFor="folder-settings-name">
        Name
      </label>
      <input
        id="folder-settings-name"
        type="text"
        value={name}
        maxLength={MAX_FOLDER_NAME_LENGTH}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />

      <div className="maps-settings-row">
        <span className="field-label">Color</span>
        {color && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              changeColor(null);
              setWheelKey((k) => k + 1);
            }}
            data-tooltip="Back to the default folder color"
          >
            <RotateCcw size={12} strokeWidth={2.25} />
            Default
          </button>
        )}
      </div>
      <ColorWheel key={wheelKey} value={color ?? DEFAULT_FOLDER_COLOR} onChange={changeColor} />

      {error && <p className="form-error">{error}</p>}

      <div className="maps-settings-actions">
        <button type="button" className="btn btn-sm btn-create" onClick={onCreateMap}>
          <Plus size={13} strokeWidth={2.25} />
          Create map in this folder
        </button>
        <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>
          <Trash2 size={13} strokeWidth={2.25} />
          Delete folder
        </button>
      </div>
    </aside>
  );
}
