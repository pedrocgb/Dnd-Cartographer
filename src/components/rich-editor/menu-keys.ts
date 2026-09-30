import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

type KeyHandler = (event: KeyboardEvent) => boolean;

export interface MenuKeysStorage {
  /** Key handlers of the open suggestion menus (@, /); each returns true when it used the key. */
  handlers: Set<KeyHandler>;
}

declare module "@tiptap/core" {
  interface Storage {
    menuKeys: MenuKeysStorage;
  }
}

/**
 * Lets a floating suggestion menu (the @ and / menus) take arrows, Enter,
 * Tab and Escape before the editor does. Registered first among the
 * editor's plugins' handlers, so Tab picks an option instead of indenting.
 */
export const MenuKeys = Extension.create<Record<string, never>, MenuKeysStorage>({
  name: "menuKeys",
  priority: 1000,
  addStorage() {
    return { handlers: new Set() };
  },
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        key: new PluginKey("menuKeys"),
        props: { handleKeyDown: (_view, event) => [...storage.handlers].some((handle) => handle(event)) },
      }),
    ];
  },
});

/** Adds a menu's key handler to the editor; returns the function that removes it. */
export function addMenuKeyHandler(editor: { storage: { menuKeys?: MenuKeysStorage } }, handler: KeyHandler): () => void {
  editor.storage.menuKeys?.handlers.add(handler);
  return () => editor.storage.menuKeys?.handlers.delete(handler);
}

export interface TriggerMatch {
  /** Where the trigger character is. */
  from: number;
  to: number;
  query: string;
}

/**
 * The "<trigger>query" right before the caret, when the trigger starts the
 * line or follows a space, an opening bracket or quote, or a dash — anywhere
 * in the text, but not right after a letter or digit (so "a/b" or
 * "mail@host" don't open a menu).
 */
export function triggerMatch(
  editor: { isEditable: boolean; state: import("@tiptap/pm/state").EditorState },
  trigger: string,
  maxQuery: number
): TriggerMatch | null {
  const { selection } = editor.state;
  if (!editor.isEditable || !selection.empty || !selection.$from.parent.isTextblock) return null;
  const $from = selection.$from;
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - maxQuery - 2), $from.parentOffset, undefined, "￼");
  const t = trigger.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  // String.raw: in a plain template string "\s" loses its backslash and matches the letter "s".
  const m = new RegExp(String.raw`(?:^|[\s(\[{"'\u201c\u2018\u2014\u2013-])${t}([^${t}\n\ufffc]*)$`).exec(before);
  if (!m || m[1].length > maxQuery || m[1].startsWith(" ") || m[1].includes("  ")) return null;
  return { from: selection.from - m[1].length - 1, to: selection.from, query: m[1] };
}
