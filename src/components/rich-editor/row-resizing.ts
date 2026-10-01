import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

/** Pointer distance (px) from a row's bottom border that grabs it. */
const HANDLE_WIDTH = 5;
export const MIN_ROW_HEIGHT = 28;
export const MAX_ROW_HEIGHT = 2000;

interface RowResizeState {
  /** Position of the tableRow whose bottom border is under the pointer, or -1. */
  activeRow: number;
  /** The height shown while dragging (saved on release). */
  dragging: { startY: number; startHeight: number; height: number } | null;
}

const rowResizingKey = new PluginKey<RowResizeState>("rowResizing");
const IDLE: RowResizeState = { activeRow: -1, dragging: null };

const update = (view: EditorView, patch: Partial<RowResizeState>) => view.dispatch(view.state.tr.setMeta(rowResizingKey, patch));

/** The doc position of a <tr>. */
function rowPos(view: EditorView, row: Element): number {
  const $pos = view.state.doc.resolve(view.posAtDOM(row, 0));
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type.name === "tableRow") return $pos.before(depth);
  }
  return -1;
}

/** The row whose bottom border the pointer is on (a cell's top border is the row above's bottom). */
function rowAtEdge(view: EditorView, event: MouseEvent): number {
  const cell = event.target instanceof Element ? event.target.closest("td, th") : null;
  const tr = cell?.parentElement;
  const table = tr?.closest("table");
  if (!cell || !(tr instanceof HTMLTableRowElement) || !table || !view.dom.contains(table)) return -1;
  const { top, bottom } = cell.getBoundingClientRect();
  let row: Element | undefined;
  if (bottom - event.clientY <= HANDLE_WIDTH) row = table.rows[tr.rowIndex + (cell as HTMLTableCellElement).rowSpan - 1];
  else if (event.clientY - top <= HANDLE_WIDTH && tr.rowIndex > 0) row = table.rows[tr.rowIndex - 1];
  return row ? rowPos(view, row) : -1;
}

function setRowHeight(view: EditorView, pos: number, height: number | null) {
  const node = view.state.doc.nodeAt(pos);
  if (node?.type.name !== "tableRow") return;
  view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, height }).setMeta(rowResizingKey, { dragging: null }));
}

function startDrag(view: EditorView, event: MouseEvent, pos: number) {
  const dom = view.nodeDOM(pos);
  if (!(dom instanceof HTMLElement)) return;
  const startHeight = dom.getBoundingClientRect().height;
  update(view, { dragging: { startY: event.clientY, startHeight, height: startHeight } });

  const height = (e: MouseEvent) => Math.round(Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, startHeight + e.clientY - event.clientY)));
  const onMove = (e: MouseEvent) => {
    const dragging = rowResizingKey.getState(view.state)?.dragging;
    if (!dragging || e.buttons === 0) return finish(e);
    update(view, { dragging: { ...dragging, height: height(e) } });
  };
  const finish = (e: MouseEvent) => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", finish);
    if (!rowResizingKey.getState(view.state)?.dragging) return;
    if (Math.abs(e.clientY - event.clientY) < 2) return update(view, { dragging: null });
    setRowHeight(view, pos, height(e));
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", finish);
}

function decorations(state: EditorState): DecorationSet | null {
  const s = rowResizingKey.getState(state);
  if (!s || s.activeRow === -1) return null;
  const node = state.doc.nodeAt(s.activeRow);
  if (node?.type.name !== "tableRow") return null;
  const attrs: Record<string, string> = { class: "row-resize-active" };
  if (s.dragging) attrs.style = `height: ${s.dragging.height}px`;
  return DecorationSet.create(state.doc, [Decoration.node(s.activeRow, s.activeRow + node.nodeSize, attrs)]);
}

/**
 * Row resizing, the counterpart of prosemirror-tables' column resizing:
 * drag a row's bottom border to set its height (saved as the row's `height`
 * attribute, a minimum: taller content still grows it); double-click the
 * border to go back to automatic height. The drag previews through a node
 * decoration, so ProseMirror never fights a hand-set style.
 */
export function rowResizing(): Plugin<RowResizeState> {
  return new Plugin<RowResizeState>({
    key: rowResizingKey,
    state: {
      init: () => IDLE,
      apply(tr, prev) {
        const meta = tr.getMeta(rowResizingKey) as Partial<RowResizeState> | undefined;
        if (meta) return { ...prev, ...meta };
        // Positions moved: drop the handle, it reappears on the next mouse move.
        return tr.docChanged && prev.activeRow !== -1 ? IDLE : prev;
      },
    },
    props: {
      attributes: (state): Record<string, string> => (rowResizingKey.getState(state)?.activeRow !== -1 ? { class: "row-resize-cursor" } : {}),
      decorations,
      handleDOMEvents: {
        mousemove(view, event) {
          const s = rowResizingKey.getState(view.state);
          if (!view.editable || !s || s.dragging) return false;
          const row = rowAtEdge(view, event);
          if (row !== s.activeRow) update(view, { activeRow: row });
          return false;
        },
        mouseleave(view) {
          const s = rowResizingKey.getState(view.state);
          if (s && !s.dragging && s.activeRow !== -1) update(view, { activeRow: -1 });
          return false;
        },
        mousedown(view, event) {
          const s = rowResizingKey.getState(view.state);
          if (!view.editable || !s || s.activeRow === -1 || event.button !== 0) return false;
          event.preventDefault();
          if (event.detail === 2) setRowHeight(view, s.activeRow, null);
          else startDrag(view, event, s.activeRow);
          return true;
        },
      },
    },
  });
}
