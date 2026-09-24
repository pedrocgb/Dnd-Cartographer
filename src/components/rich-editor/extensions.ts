import { Node, mergeAttributes, type Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { Color, FontFamily, TextStyle } from "@tiptap/extension-text-style";
import Image from "@tiptap/extension-image";
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
    Placeholder.configure({ placeholder }),
  ];
}
