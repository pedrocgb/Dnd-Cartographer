/**
 * Every keyboard shortcut, for the Settings → Shortcuts reference. Display
 * data only: each handler still lives with its component. The map tool keys
 * are the one table both sides read (MapSidebar binds them from here).
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

const TOOL_NAMES: Record<SidebarTool, string> = {
  select: "Selection tool",
  scene: "Scene panel",
  layers: "Layers panel",
  markers: "Markers panel",
  zones: "Zones tool",
  text: "Text tool",
  lines: "Lines tool",
  travel: "Travel routes",
  grid: "Grid overlay",
  legend: "Legend",
  scale: "Scale bar & measure",
  area: "Area calculation",
  settings: "Map settings",
};

export interface Shortcut {
  /** Alternatives; each one a "+"-joined combo ("Ctrl+Shift+Z"). "Ctrl" reads ⌘ on macOS. */
  keys: string[];
  action: string;
  /** Where it works, when narrower than the group. */
  context?: string;
}

export interface ShortcutGroup {
  title: string;
  description: string;
  shortcuts: Shortcut[];
}

const TOOL_ORDER: SidebarTool[] = ["select", "scene", "layers", "markers", "zones", "text", "lines", "scale", "area", "travel", "grid", "legend", "settings"];

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Everywhere",
    description: "Dialogs, menus and pickers across the app.",
    shortcuts: [
      { keys: ["Esc"], action: "Close the open dialog, menu, picker or tooltip" },
      { keys: ["↑", "↓"], action: "Move through a menu or list of options" },
      { keys: ["Enter"], action: "Pick the highlighted option" },
      { keys: ["Home", "End"], action: "Jump to the first or last font", context: "Font picker" },
    ],
  },
  {
    title: "Map tools",
    description: "Single keys on the map page (not while typing).",
    shortcuts: TOOL_ORDER.map((tool) => ({ keys: [SHORTCUT_KEYS[tool]], action: `Open ${TOOL_NAMES[tool]}` })),
  },
  {
    title: "Map editing",
    description: "Working with the items on the current layer.",
    shortcuts: [
      { keys: ["Ctrl+Z"], action: "Undo" },
      { keys: ["Ctrl+Y", "Ctrl+Shift+Z"], action: "Redo" },
      { keys: ["Ctrl+C"], action: "Copy the selected marker, zone, text or line" },
      { keys: ["Ctrl+V"], action: "Paste" },
      { keys: ["Ctrl+A"], action: "Select everything in the folder" },
      { keys: ["Delete", "Backspace"], action: "Delete the selection" },
      { keys: ["Esc"], action: "Step back: deselect, disarm the tool, then close the panel" },
      { keys: ["Ctrl+Click"], action: "Add to or remove from the selection" },
      { keys: ["Shift+Click"], action: "Select a range", context: "Panel lists" },
      { keys: ["Middle-drag"], action: "Pan the map, even while drawing" },
      { keys: ["Esc"], action: "Cancel a marker drag", context: "Dragging a marker" },
      { keys: ["←", "→", "↑", "↓"], action: "Nudge (Shift: ×10)", context: "Layer image dialog" },
      { keys: ["←", "→", "↑", "↓"], action: "Move the legend or scale bar (Shift: ×5)", context: "Focused legend or scale bar" },
    ],
  },
  {
    title: "Drawing",
    description: "While drawing zones, lines, travel routes, areas or measuring.",
    shortcuts: [
      { keys: ["Enter"], action: "Finish the line, route or polygon" },
      { keys: ["Right-click"], action: "Finish the route, measurement or area polygon" },
      { keys: ["Backspace"], action: "Remove the last point" },
      { keys: ["Esc"], action: "Clear the points, or stop drawing" },
      { keys: ["Shift"], action: "Snap to 45° (lines, routes, measure) or draw a square / keep proportions (zones)" },
      { keys: ["[", "]"], action: "Smaller / larger brush", context: "Zone paint brush" },
      { keys: ["Shift+Wheel"], action: "Resize the brush", context: "Zone paint brush" },
      { keys: ["Delete", "Backspace"], action: "Remove the hovered vertex", context: "Editing a zone" },
      { keys: ["Shift"], action: "Snap the rotation", context: "Rotating a text" },
    ],
  },
  {
    title: "Text editor",
    description: "Article bodies, descriptions and notes.",
    shortcuts: [
      { keys: ["Ctrl+B"], action: "Bold" },
      { keys: ["Ctrl+I"], action: "Italic" },
      { keys: ["Ctrl+U"], action: "Underline" },
      { keys: ["Ctrl+Shift+S"], action: "Strikethrough" },
      { keys: ["Ctrl+Alt+T"], action: "Title style" },
      { keys: ["Ctrl+Alt+1", "Ctrl+Alt+5"], action: "Heading 1 to 5" },
      { keys: ["Ctrl+Alt+0"], action: "Normal text" },
      { keys: ["Ctrl+Shift+7"], action: "Numbered list" },
      { keys: ["Ctrl+Shift+8"], action: "Bulleted list" },
      { keys: ["Ctrl+Shift+B"], action: "Quote" },
      { keys: ["Ctrl+Shift+L", "Ctrl+Shift+E", "Ctrl+Shift+R", "Ctrl+Shift+J"], action: "Align left, center, right, justify" },
      { keys: ["Tab", "Shift+Tab"], action: "Indent / outdent a list item" },
      { keys: ["Tab", "Shift+Tab"], action: "Next / previous cell (Tab in the last cell adds a row)", context: "In a table" },
      { keys: ["Drag"], action: "Resize a column or row (drag its border)", context: "In a table" },
      { keys: ["Double-click"], action: "Reset a row to automatic height", context: "Row border in a table" },
      { keys: ["Ctrl+\\"], action: "Clear formatting" },
      { keys: ["Ctrl+K"], action: "Link an article" },
      { keys: ["Ctrl+Click"], action: "Open a mention in a new tab", context: "While editing" },
      { keys: ["/"], action: "Insert menu (blocks, tables, images…)" },
      { keys: ["@"], action: "Mention an article" },
      { keys: ["Ctrl+Z", "Ctrl+Y"], action: "Undo / redo" },
    ],
  },
  {
    title: "Articles & campaign",
    description: "Article pages, tags, boards and outlines.",
    shortcuts: [
      { keys: ["Esc"], action: "Leave edit mode", context: "Article page" },
      { keys: ["Ctrl+Drag"], action: "Add an article to another folder and keep it in this one (plain drag moves it)", context: "Sidebar Folders tab" },
      { keys: ["Enter"], action: "Save the title", context: "Editing a title" },
      { keys: ["Enter", ","], action: "Add the tag", context: "Tag editor" },
      { keys: ["Backspace"], action: "Remove the last tag", context: "Empty tag input" },
      { keys: ["Alt+←", "Alt+→", "Alt+↑", "Alt+↓"], action: "Move a card", context: "Quest board" },
      { keys: ["Alt+↑", "Alt+↓"], action: "Move an item up or down", context: "Writer outline, legend items" },
      { keys: ["Ctrl+Enter"], action: "Confirm", context: "Article link dialog, relations canvas" },
      { keys: ["Shift+Click"], action: "Focus a card", context: "Relations canvas" },
      { keys: ["Enter", "Space"], action: "Set a progress clock to the focused segment", context: "Fronts" },
    ],
  },
];

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
