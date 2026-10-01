import { Extension, Node, mergeAttributes, type Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { Color, FontFamily, TextStyle } from "@tiptap/extension-text-style";
import Image from "@tiptap/extension-image";
import { Mention } from "./mention";
import { CalendarDate } from "./calendar-date";
import { MenuKeys } from "./menu-keys";
import { TableOfContents } from "./TableOfContents";
import { TABLE_EXTENSIONS } from "./tables";
import { IMAGE_ALIGNS, HEADING_LEVELS, TEXT_ALIGNS } from "@/server/documents/rich-attrs";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    title: {
      /** Turns the current block into the document-level Title style. */
      setTitle: () => ReturnType;
    };
  }
}

/**
 * The "Title" block style: bigger than Heading 1 and a node of its own, so
 * existing documents' H1–H3 keep their meaning.
 */
export const Title = Node.create({
  name: "title",
  group: "block",
  content: "inline*",
  defining: true,
  parseHTML() {
    // Above the heading extension's h1 rule.
    return [{ tag: 'h1[data-type="title"]', priority: 60 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["h1", mergeAttributes(HTMLAttributes, { "data-type": "title", class: "rich-title" }), 0];
  },
  addCommands() {
    return {
      setTitle:
        () =>
        ({ commands }) =>
          commands.setNode(this.name),
    };
  },
});

export type ImageAlign = (typeof IMAGE_ALIGNS)[number];

/**
 * Block image with native corner resizing (aspect ratio kept), drag-to-move,
 * an alignment (left/right float with text wrap, center, full width), and an
 * optional link opened on click while reading. Both extra attributes render
 * as data-* on the <img>; CSS aligns the resize container around it.
 */
export const ArticleImage = Image.extend({
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "center",
        parseHTML: (el) => el.getAttribute("data-align") ?? "center",
        renderHTML: (attrs) => ({ "data-align": attrs.align }),
      },
      href: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-href"),
        renderHTML: (attrs) => (attrs.href ? { "data-href": attrs.href } : {}),
      },
    };
  },
}).configure({
  resize: {
    enabled: true,
    directions: ["top-left", "top-right", "bottom-left", "bottom-right"],
    minWidth: 48,
    minHeight: 48,
    alwaysPreserveAspectRatio: true,
  },
});

/**
 * Word-processor shortcuts on top of TipTap's own (Ctrl+B/I/U, Ctrl+Shift+S
 * strike, Ctrl+Alt+0–5 paragraph/headings, Ctrl+Shift+7/8 lists,
 * Ctrl+Shift+B quote, Ctrl+Shift+L/E/R/J align, and Tab / Shift+Tab to
 * nest and un-nest a list item, as in Google Docs and Notion):
 * - Tab in a list never leaves the editor: on an item that can't nest
 *   further (the first one) it does nothing instead of moving focus.
 * - Ctrl+Alt+T turns the line into the Title style.
 * - Ctrl+\ clears the selection's formatting (Google Docs).
 */
export const EditingShortcuts = Extension.create({
  name: "editingShortcuts",
  // Below the list items' own Tab/Shift+Tab (priority 100), which run first.
  priority: 50,
  addKeyboardShortcuts() {
    const inList = () => this.editor.isActive("bulletList") || this.editor.isActive("orderedList");
    return {
      Tab: () => inList(),
      "Shift-Tab": () => inList(),
      "Mod-Alt-t": () => this.editor.chain().focus().clearNodes().setTitle().run(),
      "Mod-\\": () => this.editor.chain().focus().unsetAllMarks().run(),
    };
  },
});

export function buildExtensions(placeholder: string): Extensions {
  return [
    StarterKit.configure({
      link: { openOnClick: false, protocols: ["http", "https", "mailto"] },
      heading: { levels: [...HEADING_LEVELS] },
    }),
    Title,
    TextStyle,
    Color,
    FontFamily,
    TextAlign.configure({ types: ["heading", "paragraph", "title"], alignments: [...TEXT_ALIGNS] }),
    ArticleImage,
    // Always loaded, so a document with mentions keeps them in every editor.
    Mention,
    CalendarDate,
    TableOfContents,
    ...TABLE_EXTENSIONS,
    MenuKeys,
    EditingShortcuts,
    Placeholder.configure({ placeholder }),
  ];
}
