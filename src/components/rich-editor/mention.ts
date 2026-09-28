import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { mentionHref } from "@/server/mentions/kinds";

export interface MentionStorage {
  /** The open @ menu's key handler (arrows, Enter, Escape); null while it's closed. */
  onKeyDown: ((event: KeyboardEvent) => boolean) | null;
}

declare module "@tiptap/core" {
  interface Storage {
    mention: MentionStorage;
  }
}

const dataAttr = (name: string, fallback: string | null) => ({
  default: fallback,
  parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) ?? fallback,
  renderHTML: (attrs: Record<string, unknown>) => (attrs[name] ? { [`data-${name}`]: String(attrs[name]) } : {}),
});

/**
 * An @mention of an article, quest, front or outline item: an inline atom
 * rendered as a link ("@Name"). Typing "@" opens MentionMenu, which inserts
 * it; saving a document indexes its mentions for backlinks.
 */
export const Mention = Node.create<Record<string, never>, MentionStorage>({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    return { kind: dataAttr("kind", "generic"), id: dataAttr("id", ""), label: dataAttr("label", ""), campaign: dataAttr("campaign", null) };
  },
  parseHTML() {
    return [{ tag: "a[data-mention]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const { kind, id, campaign, label } = node.attrs as { kind: string; id: string; campaign: string | null; label: string };
    return ["a", mergeAttributes(HTMLAttributes, { "data-mention": "", class: "rx-mention", href: mentionHref({ kind, id, campaign }) }), `@${label}`];
  },
  renderText({ node }) {
    return `@${node.attrs.label}`;
  },
  addStorage() {
    return { onKeyDown: null };
  },
  addProseMirrorPlugins() {
    const storage = this.storage;
    return [new Plugin({ key: new PluginKey("mentionMenuKeys"), props: { handleKeyDown: (_view, event) => storage.onKeyDown?.(event) ?? false } })];
  },
});

/** Hands the @ menu's key handler to the editor (null when the menu goes away). */
export function setMentionKeyHandler(editor: { storage: { mention?: MentionStorage } }, handler: MentionStorage["onKeyDown"]) {
  if (editor.storage.mention) editor.storage.mention.onKeyDown = handler;
}
