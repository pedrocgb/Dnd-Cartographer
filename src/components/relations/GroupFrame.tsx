"use client";

import { useContext, useEffect, useRef, useState } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { Folder, FolderOpen } from "lucide-react";
import { MAX_GROUP_TITLE, type BoardGroup } from "@/server/relations/boards";
import { useT } from "@/i18n/useT";
import { CanvasUiContext } from "./canvas-ui";

export type GroupFlowNode = Node<{ group: BoardGroup; open: boolean }, "boardGroup">;

/**
 * A board group's frame: sized around its cards by the canvas, its title on
 * top (double-click to rename). Closed, it moves its cards as one; open
 * (double-click the frame), they're edited one by one.
 */
export default function GroupFrame({ id, data, selected }: NodeProps<GroupFlowNode>) {
  const t = useT("relations");
  const { editingGroup, setEditingGroup, onGroupRename } = useContext(CanvasUiContext);
  const { group, open } = data;
  const editing = editingGroup === group.id && Boolean(onGroupRename);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Renaming starts from the current title.
  const [wasEditing, setWasEditing] = useState(editing);
  if (editing !== wasEditing) {
    setWasEditing(editing);
    if (editing) setDraft(group.title);
  }
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const stop = () => setEditingGroup?.(null);
  const commit = () => {
    if (draft.trim() !== group.title) onGroupRename?.(group.id, draft.trim());
    stop();
  };

  return (
    <div className={["rel-group", open && "open", selected && "selected"].filter(Boolean).join(" ")} data-group-node={id}>
      <div className="rel-group-head">
        {open ? <FolderOpen size={14} className="rel-group-icon" aria-hidden /> : <Folder size={14} className="rel-group-icon" aria-hidden />}
        {editing ? (
          <input
            ref={inputRef}
            className="nodrag nopan rel-group-input"
            value={draft}
            maxLength={MAX_GROUP_TITLE}
            aria-label={t("boards.group.title")}
            placeholder={t("boards.group.untitled")}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                e.preventDefault();
                stop();
              } else if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
          />
        ) : (
          <span
            className={group.title ? "rel-group-title" : "rel-group-title rel-group-untitled"}
            onDoubleClick={(e) => {
              if (!onGroupRename) return;
              e.stopPropagation();
              setEditingGroup?.(group.id);
            }}
          >
            {group.title || t("boards.group.untitled")}
          </span>
        )}
      </div>
    </div>
  );
}
