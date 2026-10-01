import { findParentNode, type Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { TableMap, columnResizing, tableEditing } from "@tiptap/pm/tables";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { MAX_ROW_HEIGHT, rowResizing } from "./row-resizing";

/** Sizes offered when inserting or resizing a table. */
export const TABLE_LIMITS = { maxRows: 100, maxCols: 20 } as const;

const CELL_MIN_WIDTH = 60;

/**
 * Column borders drag to resize (prosemirror-tables' columnResizing). TipTap
 * only adds that plugin when the editor is editable at creation, but one
 * editor here switches between reading and editing; the plugin ignores
 * input while not editable, so it's always added.
 */
const ResizableTable = Table.extend({
  addProseMirrorPlugins() {
    const { handleWidth, cellMinWidth, View, lastColumnResizable, allowTableNodeSelection } = this.options;
    return [
      columnResizing({ handleWidth, cellMinWidth, defaultCellMinWidth: cellMinWidth, View, lastColumnResizable }),
      tableEditing({ allowTableNodeSelection }),
    ];
  },
  // columnResizing renders the table (TableView, with its <colgroup>) itself.
  addNodeView() {
    return null;
  },
});

/** A row with an optional height (px, a minimum), set by dragging its bottom border. */
const ResizableTableRow = TableRow.extend({
  addAttributes() {
    return {
      height: {
        default: null,
        parseHTML: (el) => {
          const px = parseInt(el.style.height, 10);
          return px > 0 ? Math.min(px, MAX_ROW_HEIGHT) : null;
        },
        renderHTML: (attrs) => (attrs.height ? { style: `height: ${attrs.height}px` } : {}),
      },
    };
  },
  addProseMirrorPlugins() {
    return [rowResizing()];
  },
});

/** Tables: drag any border to resize; Tab / Shift+Tab move between cells (Tab in the last one adds a row). */
export const TABLE_EXTENSIONS = [ResizableTable.configure({ resizable: true, cellMinWidth: CELL_MIN_WIDTH, lastColumnResizable: true }), ResizableTableRow, TableHeader, TableCell];

export interface TableInfo {
  /** Position of the table node. */
  pos: number;
  rows: number;
  cols: number;
  map: TableMap;
}

/** The table holding the selection, with its size. */
export function currentTable(editor: Editor): TableInfo | null {
  const found = findParentNode((node) => node.type.name === "table")(editor.state.selection);
  if (!found) return null;
  const map = TableMap.get(found.node);
  return { pos: found.pos, rows: map.height, cols: map.width, map };
}

/** Puts the caret in a cell of the current table (row / column from 0). */
function caretToCell(editor: Editor, table: TableInfo, row: number, col: number) {
  const cellPos = table.pos + 1 + table.map.map[row * table.cols + col];
  const { tr, doc } = editor.state;
  editor.view.dispatch(tr.setSelection(TextSelection.near(doc.resolve(cellPos + 1))));
}

/**
 * Grows or shrinks the current table to `rows` × `cols`, adding or removing
 * rows at the bottom and columns at the right (merged cells are handled by
 * the table commands). The caret goes back to the cell it was in, or the
 * nearest one left.
 */
export function resizeTable(editor: Editor, rows: number, cols: number) {
  const start = currentTable(editor);
  if (!start) return;
  const targetRows = Math.min(Math.max(1, Math.round(rows)), TABLE_LIMITS.maxRows);
  const targetCols = Math.min(Math.max(1, Math.round(cols)), TABLE_LIMITS.maxCols);
  const home = cellOfSelection(editor, start) ?? { row: 0, col: 0 };

  // Each step is its own transaction; the editor's history groups them into one undo.
  for (let guard = 0; guard < TABLE_LIMITS.maxRows * 2; guard++) {
    const t = currentTable(editor);
    if (!t || t.rows === targetRows) break;
    caretToCell(editor, t, t.rows - 1, 0);
    if (!(t.rows < targetRows ? editor.commands.addRowAfter() : editor.commands.deleteRow())) break;
  }
  for (let guard = 0; guard < TABLE_LIMITS.maxCols * 2; guard++) {
    const t = currentTable(editor);
    if (!t || t.cols === targetCols) break;
    caretToCell(editor, t, 0, t.cols - 1);
    if (!(t.cols < targetCols ? editor.commands.addColumnAfter() : editor.commands.deleteColumn())) break;
  }

  const end = currentTable(editor);
  if (end) caretToCell(editor, end, Math.min(home.row, end.rows - 1), Math.min(home.col, end.cols - 1));
  editor.commands.focus();
}

/** Row and column of the cell holding the caret. */
function cellOfSelection(editor: Editor, table: TableInfo): { row: number; col: number } | null {
  const $from = editor.state.selection.$from;
  for (let depth = $from.depth; depth > 0; depth--) {
    const role = $from.node(depth).type.spec.tableRole;
    if (role === "cell" || role === "header_cell") {
      const rect = table.map.findCell($from.before(depth) - table.pos - 1);
      return { row: rect.top, col: rect.left };
    }
  }
  return null;
}
