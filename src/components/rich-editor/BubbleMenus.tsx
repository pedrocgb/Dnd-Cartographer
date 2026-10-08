"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu, type BubbleMenuProps } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import {
  AtSign,
  Baseline,
  Bold,
  CalendarDays,
  Captions,
  ScanText,
  ChevronDown,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Italic,
  Link2,
  List,
  Lock,
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
import { MAP_FONTS, mapFontFamily, type MapFontKey } from "@/server/texts/fonts";
import type { ImageAlign } from "./extensions";
import { DEFAULT_SWATCH, TEXT_COLORS, textColorOf } from "./colors";
import { useT } from "@/i18n/useT";
import type { Translator } from "@/i18n/translate";

/** Marks editor UI rendered outside the card, so the card's "click outside" check ignores it. */
const FLOATING_CLASS = "rich-floating";
/** The UI font; picking it clears the font mark instead of storing a family. */
const DEFAULT_FONT: MapFontKey = "inter";

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
  editor.isEditable && from !== to && !(state.selection instanceof NodeSelection) && !(state.selection instanceof CellSelection) && hasFocus(editor, element);

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
    <button type="button" className={active ? "active" : ""} aria-label={label} aria-pressed={active} data-tooltip={label} onMouseDown={keepSelection} onClick={onClick}>
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
  const t = useT("editor");
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
        {t("apply")}
      </button>
      {error && <span className="form-error">{error}</span>}
    </form>
  );
}

const BLOCK_STYLES: { key: string; label: (t: Translator<"editor">) => string; Icon: LucideIcon; isActive: (e: Editor) => boolean; apply: (e: Editor) => void }[] = [
  { key: "paragraph", label: (t) => t("style.paragraph"), Icon: Pilcrow, isActive: (e) => e.isActive("paragraph") && !e.isActive("bulletList") && !e.isActive("orderedList"), apply: (e) => e.chain().focus().clearNodes().setParagraph().run() },
  { key: "title", label: (t) => t("style.title"), Icon: Type, isActive: (e) => e.isActive("title"), apply: (e) => e.chain().focus().clearNodes().setTitle().run() },
  ...([1, 2, 3, 4, 5] as const).map((level) => ({
    key: `h${level}`,
    label: (t: Translator<"editor">) => t("style.heading", { level }),
    Icon: [Heading1, Heading2, Heading3, Heading4, Heading5][level - 1],
    isActive: (e: Editor) => e.isActive("heading", { level }),
    apply: (e: Editor) => e.chain().focus().clearNodes().setHeading({ level }).run(),
  })),
  { key: "bullet", label: (t) => t("style.bullet"), Icon: List, isActive: (e) => e.isActive("bulletList"), apply: (e) => e.chain().focus().toggleBulletList().run() },
  { key: "ordered", label: (t) => t("style.ordered"), Icon: ListOrdered, isActive: (e) => e.isActive("orderedList"), apply: (e) => e.chain().focus().toggleOrderedList().run() },
];

function BlockStyleMenu({ editor }: { editor: Editor }) {
  const t = useT("editor");
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
        aria-label={t("textStyleCurrent", { style: current.label(t) })}
        data-tooltip={t("textStyle")}
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={keepSelection}
        onClick={() => setOpen((o) => !o)}
      >
        <current.Icon size={15} strokeWidth={2.25} />
        <ChevronDown size={12} strokeWidth={2.25} aria-hidden />
      </button>
      {open && (
        <ul className="rich-dropdown-list" role="menu" aria-label={t("textStyle")}>
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
                {s.label(t)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Text color from the preset palette (no free color wheel); White, the default, clears the color. */
function ColorButton({ editor }: { editor: Editor }) {
  const t = useT("editor");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const color: string | undefined = editor.getAttributes("textStyle").color;
  const current = textColorOf(color);

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
        aria-label={t("textColorCurrent", { color: current ? t(`color.${current.label}`) : t("color.custom") })}
        data-tooltip={t("textColor")}
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={keepSelection}
        onClick={() => setOpen((o) => !o)}
      >
        <Baseline size={15} strokeWidth={2.25} style={{ color: color ?? undefined }} />
      </button>
      {open && (
        <div className="rich-dropdown-list rich-color-popover" role="menu" aria-label={t("textColor")}>
          {TEXT_COLORS.map((c) => {
            const selected = c === current;
            const name = c.hex ? t(`color.${c.label}`) : t("color.default", { color: t(`color.${c.label}`) });
            return (
              <button
                key={c.label}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={selected ? "rich-color-swatch active" : "rich-color-swatch"}
                aria-label={name}
                data-tooltip={name}
                onMouseDown={keepSelection}
                onClick={() => {
                  if (c.hex) editor.chain().focus().setColor(c.hex).run();
                  else editor.chain().focus().unsetColor().run();
                  setOpen(false);
                }}
              >
                <span className="rich-swatch" style={{ background: c.hex ?? DEFAULT_SWATCH }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Formatting toolbar shown over a non-empty text selection. */
export function TextBubbleMenu({ editor, onLinkArticle, onLinkDate }: { editor: Editor; onLinkArticle: () => void; onLinkDate: () => void }) {
  const t = useT("editor");
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
          label={t("link.address")}
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
            if (!href) return t("link.invalid");
            editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
            setLinking(false);
            return null;
          }}
        />
      ) : (
        <div className="rich-bubble-row" role="toolbar" aria-label={t("toolbar.formatting")}>
          <BlockStyleMenu editor={editor} />
          <span className="rich-toolbar-divider" aria-hidden />
          <ToolButton label={t("toolbar.bold")} Icon={Bold} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
          <ToolButton label={t("toolbar.italic")} Icon={Italic} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
          <ToolButton label={t("toolbar.underline")} Icon={Underline} active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} />
          <ToolButton label={t("toolbar.strike")} Icon={Strikethrough} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} />
          <span className="rich-toolbar-divider" aria-hidden />
          <FontPicker
            value={fontKey}
            bold={false}
            onChange={(key) =>
              key === DEFAULT_FONT ? editor.chain().focus().unsetFontFamily().run() : editor.chain().focus().setFontFamily(mapFontFamily(key)).run()
            }
          />
          <span className="rich-toolbar-divider" aria-hidden />
          <ToolButton label={t("toolbar.alignLeft")} Icon={TextAlignStart} active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} />
          <ToolButton label={t("toolbar.alignCenter")} Icon={TextAlignCenter} active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
          <ToolButton label={t("toolbar.alignRight")} Icon={TextAlignEnd} active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
          <ToolButton label={t("toolbar.justify")} Icon={TextAlignJustify} active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} />
          <span className="rich-toolbar-divider" aria-hidden />
          <ColorButton editor={editor} />
          <ToolButton label={t("toolbar.linkArticle")} Icon={AtSign} onClick={onLinkArticle} />
          <ToolButton label={t("toolbar.linkDate")} Icon={CalendarDays} onClick={onLinkDate} />
          <ToolButton label={t("toolbar.secret")} Icon={Lock} active={editor.isActive("secret")} onClick={() => editor.chain().focus().toggleSecret().run()} />
          <ToolButton label={t("toolbar.link")} Icon={Link2} active={editor.isActive("link")} onClick={() => setLinking(true)} />
          {editor.isActive("link") && <ToolButton label={t("toolbar.removeLink")} Icon={Unlink} onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()} />}
        </div>
      )}
    </BubbleMenu>
  );
}

const IMAGE_ALIGN_OPTIONS: { align: ImageAlign; label: "image.alignLeft" | "image.alignCenter" | "image.alignRight" | "image.alignFull"; Icon: LucideIcon }[] = [
  { align: "left", label: "image.alignLeft", Icon: TextAlignStart },
  { align: "center", label: "image.alignCenter", Icon: TextAlignCenter },
  { align: "right", label: "image.alignRight", Icon: TextAlignEnd },
  { align: "full", label: "image.alignFull", Icon: Maximize2 },
];

/** Image toolbar: alignment, link, caption, alt text, delete. Resize with the corner handles; drag to move. */
export function ImageBubbleMenu({ editor }: { editor: Editor }) {
  const t = useT("editor");
  const [field, setField] = useState<"link" | "caption" | "alt" | null>(null);
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
          label={t("image.link")}
          placeholder={t("image.linkPlaceholder")}
          initial={attrs.href ?? ""}
          onCancel={() => setField(null)}
          onApply={(raw) => {
            if (!raw.trim()) {
              update({ href: null });
              setField(null);
              return null;
            }
            const href = normalizeHref(raw);
            if (!href) return t("link.invalid");
            update({ href });
            setField(null);
            return null;
          }}
        />
      )}
      {field === "caption" && (
        <InlineField
          label={t("image.caption")}
          placeholder={t("image.captionPlaceholder")}
          initial={attrs.caption ?? ""}
          onCancel={() => setField(null)}
          onApply={(raw) => {
            update({ caption: raw.trim() || null });
            setField(null);
            return null;
          }}
        />
      )}
      {field === "alt" && (
        <InlineField
          label={t("image.alt")}
          placeholder={t("image.altPlaceholder")}
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
        <div className="rich-bubble-row" role="toolbar" aria-label={t("image.toolbar")}>
          {IMAGE_ALIGN_OPTIONS.map((o) => (
            <ToolButton key={o.align} label={t(o.label)} Icon={o.Icon} active={(attrs.align ?? "center") === o.align} onClick={() => update({ align: o.align })} />
          ))}
          <span className="rich-toolbar-divider" aria-hidden />
          <ToolButton label={attrs.href ? t("image.editLink") : t("image.addLink")} Icon={Link2} active={Boolean(attrs.href)} onClick={() => setField("link")} />
          <ToolButton label={attrs.caption ? t("image.editCaption") : t("image.addCaption")} Icon={Captions} active={Boolean(attrs.caption)} onClick={() => setField("caption")} />
          <ToolButton label={t("image.alt")} Icon={ScanText} active={Boolean(attrs.alt)} onClick={() => setField("alt")} />
          <span className="rich-toolbar-divider" aria-hidden />
          <ToolButton label={t("image.delete")} Icon={Trash2} onClick={() => editor.chain().focus().deleteSelection().run()} />
        </div>
      )}
    </BubbleMenu>
  );
}
