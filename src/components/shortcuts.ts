import type { MessageKey } from "@/i18n/messages";
import type { Translator } from "@/i18n/translate";

/**
 * Every keyboard shortcut, for the Settings → Shortcuts reference. Display
 * data only: each handler still lives with its component. The map tool keys
 * are the one table both sides read (MapSidebar binds them from here).
 * Texts are `shortcuts` message keys; localizeShortcutGroups turns them into words.
 */

/** The map sidebar tool whose screen (panel, modal or mode) is currently open. */
export type SidebarTool = "select" | "scene" | "layers" | "markers" | "zones" | "lines" | "text" | "grid" | "legend" | "scale" | "area" | "travel" | "settings";

/** Single-key shortcuts (no modifiers) that open each map tool, shown in its tooltip. */
export const SHORTCUT_KEYS: Record<SidebarTool, string> = {
  select: "V",
  scene: "S",
  markers: "M",
  zones: "Z",
  text: "T",
  lines: "P",
  grid: "G",
  legend: "K",
  scale: "R",
  area: "A",
  travel: "J",
  layers: "L",
  settings: ",",
};

type Key = MessageKey<"shortcuts">;

export interface Shortcut {
  /** Alternatives; each one a "+"-joined combo ("Ctrl+Shift+Z"). "Ctrl" reads ⌘ on macOS. */
  keys: string[];
  action: string;
  /** Where it works, when narrower than the group. */
  context?: string;
}

export interface ShortcutGroup {
  id: string;
  title: string;
  description: string;
  shortcuts: Shortcut[];
}

interface ShortcutEntry {
  keys: string[];
  action: Key;
  context?: Key;
}

interface ShortcutGroupEntry {
  id: "everywhere" | "mapTools" | "mapEditing" | "drawing" | "textEditor" | "articles" | "boards";
  shortcuts: ShortcutEntry[];
}

const TOOL_ORDER: SidebarTool[] = ["select", "scene", "layers", "markers", "zones", "text", "lines", "scale", "area", "travel", "grid", "legend", "settings"];

export const SHORTCUT_GROUPS: ShortcutGroupEntry[] = [
  {
    id: "everywhere",
    shortcuts: [
      { keys: ["Esc"], action: "action.closeOpen" },
      { keys: ["↑", "↓"], action: "action.moveList" },
      { keys: ["Enter"], action: "action.pickOption" },
      { keys: ["Home", "End"], action: "action.jumpFont", context: "context.fontPicker" },
    ],
  },
  {
    id: "mapTools",
    shortcuts: TOOL_ORDER.map((tool) => ({ keys: [SHORTCUT_KEYS[tool]], action: `tool.${tool}` as const })),
  },
  {
    id: "mapEditing",
    shortcuts: [
      { keys: ["Ctrl+Z"], action: "action.undo" },
      { keys: ["Ctrl+Y", "Ctrl+Shift+Z"], action: "action.redo" },
      { keys: ["Ctrl+C"], action: "action.copy" },
      { keys: ["Ctrl+V"], action: "action.paste" },
      { keys: ["Ctrl+A"], action: "action.selectAll" },
      { keys: ["Delete", "Backspace"], action: "action.deleteSelection" },
      { keys: ["Esc"], action: "action.stepBack" },
      { keys: ["Ctrl+Click"], action: "action.toggleSelection" },
      { keys: ["Shift+Click"], action: "action.selectRange", context: "context.panelLists" },
      { keys: ["Middle-drag"], action: "action.pan" },
      { keys: ["Esc"], action: "action.cancelDrag", context: "context.draggingMarker" },
      { keys: ["←", "→", "↑", "↓"], action: "action.nudge", context: "context.layerImageDialog" },
      { keys: ["←", "→", "↑", "↓"], action: "action.moveLegend", context: "context.focusedLegend" },
    ],
  },
  {
    id: "drawing",
    shortcuts: [
      { keys: ["Enter"], action: "action.finishLine" },
      { keys: ["Right-click"], action: "action.finishRoute" },
      { keys: ["Backspace"], action: "action.removeLastPoint" },
      { keys: ["Right-click"], action: "action.removeLastPoint", context: "context.zonePolygon" },
      { keys: ["Esc"], action: "action.clearPoints" },
      { keys: ["Shift"], action: "action.snap45" },
      { keys: ["[", "]"], action: "action.brushSize", context: "context.zoneBrush" },
      { keys: ["Shift+Wheel"], action: "action.resizeBrush", context: "context.zoneBrush" },
      { keys: ["Delete", "Backspace"], action: "action.removeVertex", context: "context.editingZone" },
      { keys: ["Shift"], action: "action.snapRotation", context: "context.rotatingText" },
      { keys: ["Shift"], action: "action.fineAlign", context: "context.aligningGrid" },
    ],
  },
  {
    id: "textEditor",
    shortcuts: [
      { keys: ["Ctrl+B"], action: "action.bold" },
      { keys: ["Ctrl+I"], action: "action.italic" },
      { keys: ["Ctrl+U"], action: "action.underline" },
      { keys: ["Ctrl+Shift+S"], action: "action.strikethrough" },
      { keys: ["Ctrl+Alt+T"], action: "action.titleStyle" },
      { keys: ["Ctrl+Alt+1", "Ctrl+Alt+5"], action: "action.headings" },
      { keys: ["Ctrl+Alt+0"], action: "action.normalText" },
      { keys: ["Ctrl+Shift+7"], action: "action.numberedList" },
      { keys: ["Ctrl+Shift+8"], action: "action.bulletedList" },
      { keys: ["Ctrl+Shift+B"], action: "action.quote" },
      { keys: ["Ctrl+Shift+L", "Ctrl+Shift+E", "Ctrl+Shift+R", "Ctrl+Shift+J"], action: "action.align" },
      { keys: ["Tab", "Shift+Tab"], action: "action.indent" },
      { keys: ["Tab", "Shift+Tab"], action: "action.nextCell", context: "context.inTable" },
      { keys: ["Drag"], action: "action.resizeCell", context: "context.inTable" },
      { keys: ["Double-click"], action: "action.resetRow", context: "context.rowBorder" },
      { keys: ["Ctrl+\\"], action: "action.clearFormatting" },
      { keys: ["Ctrl+K"], action: "action.linkArticle" },
      { keys: ["Ctrl+Click"], action: "action.openMention", context: "context.whileEditing" },
      { keys: ["/"], action: "action.insertMenu" },
      { keys: ["@"], action: "action.mention" },
      { keys: ["Ctrl+Z", "Ctrl+Y"], action: "action.undoRedo" },
    ],
  },
  {
    id: "articles",
    shortcuts: [
      { keys: ["Esc"], action: "action.leaveEdit", context: "context.articlePage" },
      { keys: ["Ctrl+Drag"], action: "action.copyToFolder", context: "context.foldersTab" },
      { keys: ["Enter"], action: "action.saveTitle", context: "context.editingTitle" },
      { keys: ["Enter", ","], action: "action.addTag", context: "context.tagEditor" },
      { keys: ["Backspace"], action: "action.removeLastTag", context: "context.emptyTagInput" },
      { keys: ["Alt+←", "Alt+→", "Alt+↑", "Alt+↓"], action: "action.moveCard", context: "context.questBoard" },
      { keys: ["Alt+↑", "Alt+↓"], action: "action.moveItem", context: "context.writerOutline" },
      { keys: ["Ctrl+Enter"], action: "action.confirm", context: "context.linkDialog" },
      { keys: ["Shift+Click"], action: "action.focusCard", context: "context.relationsCanvas" },
      { keys: ["Enter", "Space"], action: "action.setClock", context: "context.fronts" },
    ],
  },
  {
    id: "boards",
    shortcuts: [
      { keys: ["Middle-drag"], action: "action.panBoard" },
      { keys: ["Drag"], action: "action.boxSelect", context: "context.emptyCanvas" },
      { keys: ["Ctrl+Click"], action: "action.toggleSelection" },
      { keys: ["Right-click"], action: "action.boardMenu" },
      { keys: ["Delete", "Backspace"], action: "action.deleteSelection" },
      { keys: ["Drag"], action: "action.drawArrow", context: "context.cardDot" },
      { keys: ["Double-click"], action: "action.writeOnBoard", context: "context.noteOrArrow" },
      { keys: ["Double-click"], action: "action.openGroup", context: "context.groupFrame" },
      { keys: ["Double-click"], action: "action.renameGroup", context: "context.groupTitle" },
      { keys: ["Esc"], action: "action.closeGroup" },
    ],
  },
];

/** Mouse and named keys that read differently per language; other key caps (Ctrl, Esc, Enter, arrows) are shown as-is. */
const KEY_NAMES: Record<string, Key> = {
  Click: "keyName.Click",
  Drag: "keyName.Drag",
  "Middle-drag": "keyName.Middle-drag",
  "Right-click": "keyName.Right-click",
  "Double-click": "keyName.Double-click",
  Wheel: "keyName.Wheel",
  Space: "keyName.Space",
};

/** One key cap of a combo ("Click" in "Shift+Click") in the language. */
export const keyCapLabel = (key: string, t: Translator<"shortcuts">) => (KEY_NAMES[key] ? t(KEY_NAMES[key]) : key);

/** The catalog in words: titles, actions, contexts and key caps translated. */
export function localizeShortcutGroups(groups: ShortcutGroupEntry[], t: Translator<"shortcuts">): ShortcutGroup[] {
  return groups.map((g) => ({
    id: g.id,
    title: t(`group.${g.id}.title`),
    description: t(`group.${g.id}.description`),
    shortcuts: g.shortcuts.map((s) => ({
      keys: s.keys.map((combo) => (combo === "+" ? combo : combo.split("+").map((k) => keyCapLabel(k, t)).join("+"))),
      action: t(s.action),
      context: s.context && t(s.context),
    })),
  }));
}

/** Case-insensitive match on the action, context or keys. */
export function filterShortcutGroups(groups: ShortcutGroup[], query: string): ShortcutGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((g) => ({
      ...g,
      shortcuts: g.shortcuts.filter((s) => [s.action, s.context ?? "", ...s.keys].some((text) => text.toLowerCase().includes(q))),
    }))
    .filter((g) => g.shortcuts.length > 0);
}
