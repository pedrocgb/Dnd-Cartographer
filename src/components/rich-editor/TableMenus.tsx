"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { BubbleMenu, type BubbleMenuProps } from "@tiptap/react/menus";
import { CellSelection } from "@tiptap/pm/tables";
import {
  Columns3,
  Heading,
  Minus,
  PanelLeft,
  Plus,
  Rows3,
  TableCellsMerge,
  TableCellsSplit,
  Trash2,
} from "lucide-react";
import { TABLE_LIMITS, currentTable, resizeTable } from "./tables";

/** Marks editor UI rendered outside the card (see BubbleMenus). */
const FLOATING_CLASS = "rich-floating";
const GRID_ROWS = 8;
const GRID_COLS = 10;
const DEFAULT_SIZE = { rows: 3, cols: 3 };

const clamp = (value: number, max: number) => Math.min(Math.max(1, Math.round(value) || 1), max);
const keepSelection = (e: React.MouseEvent) => e.preventDefault();

type IconComponent = React.ComponentType<{ size?: number; strokeWidth?: number }>;
type Side = "above" | "below" | "left" | "right";

/* A table block with a "+" on the side where the row or column goes (lucide has no such icons). */
const INSERT_ICON_SHAPES: Record<Side, { table: string; divider: string; plus: [number, number] }> = {
  above: { table: "M3 11h18v10H3z", divider: "M3 16h18", plus: [12, 5.5] },
  below: { table: "M3 3h18v10H3z", divider: "M3 8h18", plus: [12, 18.5] },
  left: { table: "M11 3h10v18H11z", divider: "M16 3v18", plus: [5.5, 12] },
  right: { table: "M3 3h10v18H3z", divider: "M8 3v18", plus: [18.5, 12] },
};

function insertIcon(side: Side): IconComponent {
  const { table, divider, plus } = INSERT_ICON_SHAPES[side];
  const [x, y] = plus;
  function InsertIcon({ size = 24, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={table} />
        <path d={divider} />
        <path d={`M${x - 3} ${y}h6M${x} ${y - 3}v6`} />
      </svg>
    );
  }
  return InsertIcon;
}

const RowAboveIcon = insertIcon("above");
const RowBelowIcon = insertIcon("below");
const ColumnLeftIcon = insertIcon("left");
const ColumnRightIcon = insertIcon("right");

/** A number with − / + around it; typing a value applies it on Enter or blur. */
function Stepper({ label, short, value, max, onChange }: { label: string; short: string; value: number; max: number; onChange: (next: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== "") onChange(clamp(Number(draft), max));
    setDraft(null);
  };
  return (
    <span className="rich-stepper" data-tooltip={label}>
      <span className="rich-stepper-label" aria-hidden>
        {short}
      </span>
      <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= 1} onMouseDown={keepSelection} onClick={() => onChange(value - 1)}>
        <Minus size={13} strokeWidth={2.5} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        aria-label={label}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setDraft(null);
          }
        }}
      />
      <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onMouseDown={keepSelection} onClick={() => onChange(value + 1)}>
        <Plus size={13} strokeWidth={2.5} />
      </button>
    </span>
  );
}

/**
 * The "Insert table" popover: hover the grid and click for a size (as in
 * Google Docs), or type the rows and columns for a bigger one.
 */
export function TableInsertPicker({ anchor, onInsert, onClose }: { anchor: { left: number; top: number }; onInsert: (rows: number, cols: number, withHeaderRow: boolean) => void; onClose: () => void }) {
  const [hover, setHover] = useState<{ rows: number; cols: number } | null>(null);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [header, setHeader] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onCloseRef.current();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const shown = hover ?? size;
  // Open upward when it wouldn't fit below the caret.
  const style = anchor.top + 320 > window.innerHeight ? { bottom: window.innerHeight - anchor.top + 24, left: anchor.left } : { top: anchor.top, left: anchor.left };

  return createPortal(
    <div className={`${FLOATING_CLASS} rich-table-picker`} role="dialog" aria-label="Insert table" style={style} ref={rootRef}>
      <div className="rich-table-grid" role="grid" aria-label="Table size" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: GRID_ROWS }, (_, r) => (
          <div key={r} role="row" className="rich-table-grid-row">
            {Array.from({ length: GRID_COLS }, (_, c) => {
              const on = r < shown.rows && c < shown.cols;
              return (
                <button
                  key={c}
                  type="button"
                  role="gridcell"
                  aria-label={`${r + 1} × ${c + 1}`}
                  className={on ? "rich-table-grid-cell on" : "rich-table-grid-cell"}
                  onMouseEnter={() => setHover({ rows: r + 1, cols: c + 1 })}
                  onFocus={() => setHover({ rows: r + 1, cols: c + 1 })}
                  onClick={() => onInsert(r + 1, c + 1, header)}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="rich-table-picker-size" aria-live="polite">
        {shown.rows} {shown.rows === 1 ? "row" : "rows"} × {shown.cols} {shown.cols === 1 ? "column" : "columns"}
      </p>
      <form
        className="rich-table-picker-form"
        onSubmit={(e) => {
          e.preventDefault();
          onInsert(size.rows, size.cols, header);
        }}
      >
        <label>
          Rows
          <input type="number" min={1} max={TABLE_LIMITS.maxRows} value={size.rows} onChange={(e) => setSize((s) => ({ ...s, rows: clamp(Number(e.target.value), TABLE_LIMITS.maxRows) }))} />
        </label>
        <label>
          Columns
          <input type="number" min={1} max={TABLE_LIMITS.maxCols} value={size.cols} onChange={(e) => setSize((s) => ({ ...s, cols: clamp(Number(e.target.value), TABLE_LIMITS.maxCols) }))} />
        </label>
        <label className="rich-table-picker-check">
          <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} />
          Header row
        </label>
        <button type="submit" className="btn btn-sm btn-primary">
          Insert
        </button>
      </form>
    </div>,
    document.body,
  );
}

const MENU_OPTIONS: BubbleMenuProps["options"] = { placement: "top", offset: 8, flip: true };

/** Visible while the caret (or a cell selection) is in a table and the editor or the menu has focus. */
const showTableMenu: NonNullable<BubbleMenuProps["shouldShow"]> = ({ editor, state, from, to, element }) =>
  editor.isEditable &&
  editor.isActive("table") &&
  (from === to || state.selection instanceof CellSelection) &&
  (editor.view.hasFocus() || element.contains(document.activeElement));

function ToolButton({ label, Icon, active, onClick }: { label: string; Icon: IconComponent; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={active ? "active" : ""} aria-label={label} aria-pressed={active} data-tooltip={label} onMouseDown={keepSelection} onClick={onClick}>
      <Icon size={15} strokeWidth={2.25} />
    </button>
  );
}

/** Sits above the table holding the caret. */
function tableAnchor(editor: Editor) {
  return () => {
    const table = currentTable(editor);
    const dom = table ? editor.view.nodeDOM(table.pos) : null;
    const el = dom instanceof HTMLElement ? (dom.querySelector("table") ?? dom) : null;
    return el ? { getBoundingClientRect: () => el.getBoundingClientRect() } : null;
  };
}

/**
 * The table toolbar: row and column counts (−/+ or typed), insert and delete
 * around the caret's cell, header row and column, merge / split, delete table.
 */
export function TableBubbleMenu({ editor }: { editor: Editor }) {
  const table = currentTable(editor);
  // Stable per editor: BubbleMenu re-dispatches whenever this changes identity.
  const anchor = useMemo(() => tableAnchor(editor), [editor]);
  const run = (fn: (c: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => fn(editor.chain().focus()).run();

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="richTableBubble"
      className={`${FLOATING_CLASS} rich-bubble`}
      options={MENU_OPTIONS}
      shouldShow={showTableMenu}
      getReferencedVirtualElement={anchor}
    >
      {table && (
        <div className="rich-bubble-row" role="toolbar" aria-label="Table">
          <Stepper label="Rows" short="Rows" value={table.rows} max={TABLE_LIMITS.maxRows} onChange={(rows) => resizeTable(editor, rows, table.cols)} />
          <Stepper label="Columns" short="Cols" value={table.cols} max={TABLE_LIMITS.maxCols} onChange={(cols) => resizeTable(editor, table.rows, cols)} />
          <span className="rich-toolbar-divider" aria-hidden />
          <ToolButton label="Insert row above" Icon={RowAboveIcon} onClick={() => run((c) => c.addRowBefore())} />
          <ToolButton label="Insert row below" Icon={RowBelowIcon} onClick={() => run((c) => c.addRowAfter())} />
          <ToolButton label="Insert column left" Icon={ColumnLeftIcon} onClick={() => run((c) => c.addColumnBefore())} />
          <ToolButton label="Insert column right" Icon={ColumnRightIcon} onClick={() => run((c) => c.addColumnAfter())} />
          <span className="rich-toolbar-divider" aria-hidden />
          <ToolButton label="Delete row" Icon={Rows3} onClick={() => run((c) => c.deleteRow())} />
          <ToolButton label="Delete column" Icon={Columns3} onClick={() => run((c) => c.deleteColumn())} />
          <span className="rich-toolbar-divider" aria-hidden />
          <ToolButton label="Header row" Icon={Heading} onClick={() => run((c) => c.toggleHeaderRow())} />
          <ToolButton label="Header column" Icon={PanelLeft} onClick={() => run((c) => c.toggleHeaderColumn())} />
          {editor.can().mergeCells() && <ToolButton label="Merge cells" Icon={TableCellsMerge} onClick={() => run((c) => c.mergeCells())} />}
          {editor.can().splitCell() && <ToolButton label="Split cell" Icon={TableCellsSplit} onClick={() => run((c) => c.splitCell())} />}
          <span className="rich-toolbar-divider" aria-hidden />
          <ToolButton label="Delete table" Icon={Trash2} onClick={() => run((c) => c.deleteTable())} />
        </div>
      )}
    </BubbleMenu>
  );
}
