import { Node, mergeAttributes } from "@tiptap/core";

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
        const label = revealed ? "Hide secret" : "Reveal secret";
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
