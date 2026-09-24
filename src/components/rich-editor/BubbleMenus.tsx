"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu, type BubbleMenuProps } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import {
  Baseline,
  Bold,
  Captions,
  ChevronDown,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Pilcrow,
  Strikethrough,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Trash2,
  Type,
  Underline,
  Unlink,
  type LucideIcon,
} from "lucide-react";
import FontPicker from "@/components/FontPicker";
import ColorWheel from "@/components/ColorWheel";
import { MAP_FONTS, mapFontFamily, type MapFontKey } from "@/server/texts/fonts";
import type { ImageAlign } from "./extensions";

/** Marks editor UI rendered outside the card, so the card's "click outside" check ignores it. */
const FLOATING_CLASS = "rich-floating";
/** The UI font; picking it clears the font mark instead of storing a family. */
const DEFAULT_FONT: MapFontKey = "inter";
const DEFAULT_TEXT_COLOR = "#E6E6E6";

/*
 * BubbleMenu dispatches an editor transaction whenever `options` or
 * `shouldShow` changes identity, and the editor re-renders on every
 * transaction — so both must be stable (module-level), never inline.
 */
const MENU_OPTIONS: BubbleMenuProps["options"] = { placement: "top", offset: 8, flip: true };

type ShouldShow = NonNullable<BubbleMenuProps["shouldShow"]>;

/** Visible while the editor (or a field inside the menu itself) has focus. */
const hasFocus = (editor: Editor, menu: HTMLElement) => editor.view.hasFocus() || menu.contains(document.activeElement);

const showTextMenu: ShouldShow = ({ editor, state, from, to, element }) =>
  editor.isEditable && from !== to && !(state.selection instanceof NodeSelection) && hasFocus(editor, element);

const showImageMenu: ShouldShow = ({ editor, state, element }) =>
  editor.isEditable &&
  state.selection instanceof NodeSelection &&
  state.selection.node.type.name === "image" &&
  hasFocus(editor, element);

/** Keeps the editor's selection: toolbar buttons act on mousedown focus-wise, on click action-wise. */
const keepSelection = (e: React.MouseEvent) => e.preventDefault();

function ToolButton({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: LucideIcon;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={active ? "active" : ""} aria-label={label} aria-pressed={active} title={label} onMouseDown={keepSelection} onClick={onClick}>
      <Icon size={15} strokeWidth={2.25} />
    </button>
  );
}

/** A menu's inline field closes whenever the selection moves (it belongs to what was selected). */
function useResetOnSelectionChange(editor: Editor, reset: () => void) {
  const resetRef = useRef(reset);
  useEffect(() => {
    resetRef.current = reset;
  });
  useEffect(() => {
    const onSelection = () => resetRef.current();
    editor.on("selectionUpdate", onSelection);
    return () => {
      editor.off("selectionUpdate", onSelection);
    };
  }, [editor]);
}

/** Adds https:// to a bare address; rejects anything but http(s)/mailto (the server does too). */
function normalizeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** Inline field replacing a menu's buttons (link URL, alt text). Enter applies, Esc cancels. */
function InlineField({
  label,
  initial,
  placeholder,
  onApply,
  onCancel,
}: {
  label: string;
  initial: string;
  placeholder: string;
  onApply: (value: string) => string | null;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="rich-bubble-field"
      onSubmit={(e) => {
        e.preventDefault();
        setError(onApply(value));
      }}
    >
      <input
        type="text"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
      />
      <button type="submit" className="btn btn-sm btn-primary">
        Apply
      </button>
      {error && <span className="form-error">{error}</span>}
    </form>
  );
}

const BLOCK_STYLES: { key: string; label: string; Icon: LucideIcon; isActive: (e: Editor) => boolean; apply: (e: Editor) => void }[] = [
  { key: "paragraph", label: "Paragraph", Icon: Pilcrow, isActive: (e) => e.isActive("paragraph") && !e.isActive("bulletList") && !e.isActive("orderedList"), apply: (e) => e.chain().focus().clearNodes().setParagraph().run() },
  { key: "title", label: "Title", Icon: Type, isActive: (e) => e.isActive("title"), apply: (e) => e.chain().focus().clearNodes().setTitle().run() },
  ...([1, 2, 3, 4, 5] as const).map((level) => ({
    key: `h${level}`,
    label: `Heading ${level}`,
    Icon: [Heading1, Heading2, Heading3, Heading4, Heading5][level - 1],
    isActive: (e: Editor) => e.isActive("heading", { level }),
    apply: (e: Editor) => e.chain().focus().clearNodes().setHeading({ level }).run(),
  })),
  { key: "bullet", label: "Bullet list", Icon: List, isActive: (e) => e.isActive("bulletList"), apply: (e) => e.chain().focus().toggleBulletList().run() },
  { key: "ordered", label: "Numbered list", Icon: ListOrdered, isActive: (e) => e.isActive("orderedList"), apply: (e) => e.chain().focus().toggleOrderedList().run() },
];

function BlockStyleMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = BLOCK_STYLES.find((s) => s.isActive(editor)) ?? BLOCK_STYLES[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="rich-dropdown" ref={rootRef}>
      <button
        type="button"
        className="rich-dropdown-button"
        aria-label={`Text style: ${current.label}`}
        title="Text style"
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={keepSelection}
        onClick={() => setOpen((o) => !o)}
      >
        <current.Icon size={15} strokeWidth={2.25} />
        <ChevronDown size={12} strokeWidth={2.25} aria-hidden />
      </button>
      {open && (
        <ul className="rich-dropdown-list" role="menu" aria-label="Text style">
          {BLOCK_STYLES.map((s) => (
            <li key={s.key} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={s === current}
                className={s === current ? "active" : ""}
                onMouseDown={keepSelection}
                onClick={() => {
                  s.apply(editor);
                  setOpen(false);
                }}
              >
                <s.Icon size={15} strokeWidth={2.25} aria-hidden />
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ColorButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const color: string | undefined = editor.getAttributes("textStyle").color;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="rich-dropdown" ref={rootRef}>
      <button
        type="button"
        className={color ? "active" : ""}
        aria-label="Text color"
        title="Text color"
        aria-expanded={open}
        onMouseDown={keepSelection}
        onClick={() => setOpen((o) => !o)}
      >
        <Baseline size={15} strokeWidth={2.25} style={{ color: color ?? undefined }} />
      </button>
      {open && (
        <div className="rich-dropdown-list rich-color-popover">
          <ColorWheel value={color ?? DEFAULT_TEXT_COLOR} onChange={(hex) => editor.chain().setColor(hex).run()} />
          <button
            type="button"
            className="btn btn-sm"
            onMouseDown={keepSelection}
            onClick={() => {
              editor.chain().focus().unsetColor().run();
              setOpen(false);
            }}
          >
            Default color
          </button>
        </div>
      )}
    </div>
  );
}

/** Formatting toolbar shown over a non-empty text selection. */
export function TextBubbleMenu({ editor }: { editor: Editor }) {
  const [linking, setLinking] = useState(false);
  useResetOnSelectionChange(editor, () => setLinking(false));
  const fontFamily: string | undefined = editor.getAttributes("textStyle").fontFamily;
  const fontKey = MAP_FONTS.find((f) => mapFontFamily(f.key) === fontFamily)?.key ?? DEFAULT_FONT;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="richTextBubble"
      className={`${FLOATING_CLASS} rich-bubble`}
      options={MENU_OPTIONS}
      shouldShow={showTextMenu}
    >
      {linking ? (
        <InlineField
          label="Link address"
          placeholder="https://…"
          initial={editor.getAttributes("link").href ?? ""}
          onCancel={() => setLinking(false)}
          onApply={(raw) => {
            if (!raw.trim()) {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              setLinking(false);
              return null;
            }
            const href = normalizeHref(raw);
            if (!href) return "Use an http(s) or mailto address.";
            editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
            setLinking(false);
            return null;
          }}
        />
      ) : (
        <div className="rich-bubble-row" role="toolbar" aria-label="Formatting">
          <BlockStyleMenu editor={editor} />
          <span className="rich-toolbar-divider" aria-hidden />
          <ToolButton label="Bold" Icon={Bold} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
          <ToolButton label="Italic" Icon={Italic} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
          <ToolButton label="Underline" Icon={Underline} active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} />
          <ToolButton label="Strikethrough" Icon={Strikethrough} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} />
          <span className="rich-toolbar-divider" aria-hidden />
          <FontPicker
            value={fontKey}
            bold={false}
            onChange={(key) =>
              key === DEFAULT_FONT ? editor.chain().focus().unsetFontFamily().run() : editor.chain().focus().setFontFamily(mapFontFamily(key)).run()
            }
          />
          <span className="rich-toolbar-divider" aria-hidden />
          <ToolButton label="Align left" Icon={TextAlignStart} active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
          <ToolButton label="Align center" Icon={TextAlignCenter} active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
          <ToolButton label="Align right" Icon={TextAlignEnd} active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
          <ToolButton label="Justify" Icon={TextAlignJustify} active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} />
          <span className="rich-toolbar-divider" aria-hidden />
          <ColorButton editor={editor} />
          <ToolButton label="Link" Icon={Link2} active={editor.isActive("link")} onClick={() => setLinking(true)} />
          {editor.isActive("link") && <ToolButton label="Remove link" Icon={Unlink} onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()} />}
        </div>
      )}
    </BubbleMenu>
  );
}

const IMAGE_ALIGN_OPTIONS: { align: ImageAlign; label: string; Icon: LucideIcon }[] = [
  { align: "left", label: "Float left (text wraps)", Icon: TextAlignStart },
  { align: "center", label: "Center", Icon: TextAlignCenter },
  { align: "right", label: "Float right (text wraps)", Icon: TextAlignEnd },
  { align: "full", label: "Full width", Icon: Maximize2 },
];

/** Image toolbar: alignment, link, alt text, delete. Resize with the corner handles; drag to move. */
export function ImageBubbleMenu({ editor }: { editor: Editor }) {
  const [field, setField] = useState<"link" | "alt" | null>(null);
  useResetOnSelectionChange(editor, () => setField(null));
  const attrs = editor.getAttributes("image");
  const update = (patch: Record<string, unknown>) => editor.chain().focus().updateAttributes("image", patch).run();

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="richImageBubble"
      className={`${FLOATING_CLASS} rich-bubble`}
      options={MENU_OPTIONS}
      shouldShow={showImageMenu}
    >
      {field === "link" && (
        <InlineField
          label="Image link"
          placeholder="https://… (opens on click)"
          initial={attrs.href ?? ""}
          onCancel={() => setField(null)}
          onApply={(raw) => {
            if (!raw.trim()) {
              update({ href: null });
              setField(null);
              return null;
            }
            const href = normalizeHref(raw);
            if (!href) return "Use an http(s) or mailto address.";
            update({ href });
            setField(null);
            return null;
          }}
        />
      )}
      {field === "alt" && (
        <InlineField
          label="Alt text"
          placeholder="Describe the image"
          initial={attrs.alt ?? ""}
          onCancel={() => setField(null)}
          onApply={(raw) => {
            update({ alt: raw.trim() || null });
            setField(null);
            return null;
          }}
        />
      )}
      {field === null && (
        <div className="rich-bubble-row" role="toolbar" aria-label="Image">
          {IMAGE_ALIGN_OPTIONS.map((o) => (
            <ToolButton key={o.align} label={o.label} Icon={o.Icon} active={(attrs.align ?? "center") === o.align} onClick={() => update({ align: o.align })} />
          ))}
          <span className="rich-toolbar-divider" aria-hidden />
          <ToolButton label={attrs.href ? "Edit image link" : "Link image"} Icon={Link2} active={Boolean(attrs.href)} onClick={() => setField("link")} />
          <ToolButton label="Alt text" Icon={Captions} active={Boolean(attrs.alt)} onClick={() => setField("alt")} />
          <span className="rich-toolbar-divider" aria-hidden />
          <ToolButton label="Delete image" Icon={Trash2} onClick={() => editor.chain().focus().deleteSelection().run()} />
        </div>
      )}
    </BubbleMenu>
  );
}
