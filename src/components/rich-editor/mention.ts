import { Node, mergeAttributes } from "@tiptap/core";
import { mentionDisplayText, mentionHref } from "@/server/mentions/kinds";

const dataAttr = (name: string, fallback: string | null) => ({
  default: fallback,
  parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) ?? fallback,
  renderHTML: (attrs: Record<string, unknown>) => (attrs[name] ? { [`data-${name}`]: String(attrs[name]) } : {}),
});

/**
 * An @mention of an article, quest, front or outline item: an inline atom
 * rendered as a link: "@Name", or its custom `text` when the article link
 * dialog gave it one. Typing "@" opens MentionMenu, which inserts it; saving
 * a document indexes its mentions for backlinks.
 */
export const Mention = Node.create({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    return { kind: dataAttr("kind", "generic"), id: dataAttr("id", ""), label: dataAttr("label", ""), campaign: dataAttr("campaign", null), text: dataAttr("text", null) };
  },
  parseHTML() {
    return [{ tag: "a[data-mention]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const { kind, id, campaign } = node.attrs as { kind: string; id: string; campaign: string | null };
    return ["a", mergeAttributes(HTMLAttributes, { "data-mention": "", class: "rx-mention", href: mentionHref({ kind, id, campaign }) }), mentionDisplayText(node.attrs)];
  },
  renderText({ node }) {
    return mentionDisplayText(node.attrs);
  },
});
