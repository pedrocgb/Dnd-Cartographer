import { Mark, Node, getMarkRange, mergeAttributes, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { activeT } from "@/i18n/active";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    secret: {
      /** Wraps the selected blocks in a secret, or unwraps them when already inside one. */
      toggleSecret: () => ReturnType;
    };
  }
}

/** Transaction meta set by the padlock: lets read mode save a reveal (and nothing else). */
export const SECRET_REVEAL_META = "secretReveal";

// Lucide's lock / lock-open glyphs, inlined: the node view is plain DOM, not React.
const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>';
const LOCKED_ICON = `${SVG_OPEN}<path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const UNLOCKED_ICON = `${SVG_OPEN}<path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;

/**
 * A GM-only block (like LegendKeeper's /secret): wraps paragraphs in a
 * purple box with a padlock in its top-left corner. Clicking the padlock
 * reveals it (gold, open padlock); shared views drop unrevealed secrets
 * and show revealed ones as plain text (see server/share/transform.ts).
 */
export const Secret = Node.create({
  name: "secret",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      revealed: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-revealed") === "true",
        renderHTML: (attrs) => ({ "data-revealed": attrs.revealed ? "true" : "false" }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="secret"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "secret", class: "rx-secret" }), 0];
  },
  addCommands() {
    return {
      toggleSecret:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
    };
  },
  addNodeView() {
    return ({ node: initial, getPos, editor }) => {
      let node = initial;
      const dom = document.createElement("div");
      dom.className = "rx-secret";
      dom.setAttribute("data-type", "secret");
      const lock = document.createElement("button");
      lock.type = "button";
      lock.className = "rx-secret-lock";
      lock.contentEditable = "false";
      const content = document.createElement("div");
      content.className = "rx-secret-body";
      dom.append(lock, content);

      const paint = () => {
        const revealed = node.attrs.revealed === true;
        dom.setAttribute("data-revealed", revealed ? "true" : "false");
        lock.innerHTML = revealed ? UNLOCKED_ICON : LOCKED_ICON;
        const label = activeT("editor")(revealed ? "secret.hide" : "secret.reveal");
        lock.setAttribute("aria-label", label);
        lock.setAttribute("aria-pressed", String(revealed));
        lock.setAttribute("data-tooltip", label);
      };
      paint();

      // Mousedown would move the caret into the box; the click does the toggling.
      lock.addEventListener("mousedown", (e) => e.preventDefault());
      lock.addEventListener("click", (e) => {
        e.preventDefault();
        const pos = typeof getPos === "function" ? getPos() : undefined;
        if (pos === undefined || editor.isDestroyed) return;
        const { view } = editor;
        view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, revealed: node.attrs.revealed !== true }).setMeta(SECRET_REVEAL_META, true));
      });

      return {
        dom,
        contentDOM: content,
        update: (next) => {
          if (next.type !== node.type) return false;
          node = next;
          paint();
          return true;
        },
        stopEvent: (event) => event.target instanceof globalThis.Node && lock.contains(event.target),
        // Our own repaints (the box's data-revealed, the padlock's icon) aren't document changes.
        ignoreMutation: (mutation) => mutation.type !== "selection" && ((mutation.type === "attributes" && mutation.target === dom) || lock.contains(mutation.target)),
      };
    };
  },
});

const SECRET_TEXT = "secretText";

/**
 * Secret text inside a paragraph: the inline cousin of the secret block, for
 * a few words in a long passage. Violet while hidden, brass once revealed;
 * in read mode a click on it reveals or hides it (saved like the block's
 * padlock). Shared views drop it unless revealed (server/share/transform.ts).
 */
export const SecretText = Mark.create({
  name: SECRET_TEXT,
  // Typing at its edge doesn't extend the secret.
  inclusive: false,
  addAttributes() {
    return {
      revealed: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-revealed") === "true",
        renderHTML: (attrs) => ({ "data-revealed": attrs.revealed ? "true" : "false" }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-type="secret-text"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-type": "secret-text", class: "rx-secret-text" }), 0];
  },
  addProseMirrorPlugins() {
    const type = this.type;
    // A padlock widget before each run of secret text: decorations, not
    // document content, so it's never saved and never reaches a share.
    const padlocks = (doc: PMNode) => {
      const widgets: Decoration[] = [];
      let prevEnd = -1;
      doc.descendants((node, pos) => {
        const mark = node.isInline ? node.marks.find((m) => m.type === type) : undefined;
        // A run split across text nodes (bold in the middle) gets one padlock.
        if (mark && pos !== prevEnd) widgets.push(padlockWidget(pos, mark.attrs.revealed === true));
        if (mark) prevEnd = pos + node.nodeSize;
      });
      return DecorationSet.create(doc, widgets);
    };
    const padlockWidget = (at: number, revealed: boolean) =>
      Decoration.widget(
        at,
        (view, getPos) => {
          const lock = document.createElement("button");
          lock.type = "button";
          lock.className = "rx-secret-lock rx-secret-text-lock";
          lock.contentEditable = "false";
          lock.setAttribute("data-revealed", String(revealed));
          lock.innerHTML = revealed ? UNLOCKED_ICON : LOCKED_ICON;
          const label = activeT("editor")(revealed ? "secret.hide" : "secret.reveal");
          lock.setAttribute("aria-label", label);
          lock.setAttribute("aria-pressed", String(revealed));
          lock.setAttribute("data-tooltip", label);
          // Like the block's padlock: works while reading or editing, and saves the reveal.
          lock.addEventListener("mousedown", (e) => e.preventDefault());
          lock.addEventListener("click", (e) => {
            e.preventDefault();
            const pos = getPos();
            if (pos === undefined) return;
            const { doc } = view.state;
            const range = getMarkRange(doc.resolve(pos), type);
            const mark = range && doc.nodeAt(range.from)?.marks.find((m) => m.type === type);
            if (!range || !mark) return;
            const next = type.create({ ...mark.attrs, revealed: mark.attrs.revealed !== true });
            view.dispatch(view.state.tr.removeMark(range.from, range.to, type).addMark(range.from, range.to, next).setMeta(SECRET_REVEAL_META, true));
          });
          return lock;
        },
        { side: -1, key: `secret-text-${at}-${revealed}`, ignoreSelection: true, stopEvent: () => true }
      );
    return [
      new Plugin({
        key: new PluginKey("secretTextPadlocks"),
        state: {
          init: (_, state) => padlocks(state.doc),
          apply: (tr, set) => (tr.docChanged ? padlocks(tr.doc) : set),
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

/**
 * The toolbar padlock: words picked inside one paragraph become secret text;
 * no selection, a whole paragraph or several make (or unmake) a secret block.
 * Inside secret text, it turns that text back to normal.
 */
export function toggleAnySecret(editor: Editor): boolean {
  const chain = editor.chain().focus();
  if (editor.isActive(SECRET_TEXT)) return chain.extendMarkRange(SECRET_TEXT).unsetMark(SECRET_TEXT).run();
  const { empty, $from, $to } = editor.state.selection;
  const partOfOneLine = !empty && $from.sameParent($to) && $from.parent.isTextblock && !($from.parentOffset === 0 && $to.parentOffset === $from.parent.content.size);
  return partOfOneLine ? chain.setMark(SECRET_TEXT).run() : chain.toggleSecret().run();
}
