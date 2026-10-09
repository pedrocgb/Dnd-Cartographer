"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Eye, EyeOff, Lock, LockOpen, Trash2, type LucideIcon } from "lucide-react";
import { formatInteger } from "@/server/settings/number-format";
import { useT } from "@/i18n/useT";
import { useNoun, type FolderNoun } from "../LayerFolders";
import { usePopover } from "../usePopover";

const ICON = { size: 16, strokeWidth: 2.25 } as const;

/** The bar's buttons that take focus, in order. */
const focusables = (bar: HTMLElement) => [...bar.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];

/**
 * A map tool's bar, floating at the bottom of the map (centered on the part
 * the side panel leaves free): its modes first, then what the selected item
 * can change. One Tab stop (WAI-ARIA toolbar): the arrow keys, Home and End
 * move between its buttons. `caption`, above the bar, says what the armed
 * mode will do.
 */
export function ToolBar({ label, inset, caption, children }: { label: string; inset: number; caption?: ReactNode; children: ReactNode }) {
  const bar = useRef<HTMLDivElement>(null);
  const current = useRef<HTMLButtonElement | null>(null);

  // Buttons come and go with the selection: keep exactly one of them tabbable.
  useEffect(() => {
    if (!bar.current) return;
    const items = focusables(bar.current);
    const stop = items.find((b) => b === current.current) ?? items[0];
    for (const b of items) b.tabIndex = b === stop ? 0 : -1;
  });

  function onFocus(e: React.FocusEvent) {
    if (e.target instanceof HTMLButtonElement && bar.current?.contains(e.target)) current.current = e.target;
  }

  function onKeyDown(e: KeyboardEvent) {
    // Keys typed in a popover (portaled, so outside the bar) are its own.
    if (!bar.current?.contains(e.target as Node)) return;
    const items = focusables(bar.current);
    const at = items.indexOf(e.target as HTMLButtonElement);
    if (at < 0) return;
    const next = e.key === "ArrowRight" ? at + 1 : e.key === "ArrowLeft" ? at - 1 : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const target = items[(next + items.length) % items.length];
    for (const b of items) b.tabIndex = b === target ? 0 : -1;
    target.focus();
  }

  return (
    <div className="tool-bar-dock" style={{ left: `calc(${inset}px + (100% - ${inset}px) / 2)`, maxWidth: `calc(100% - ${inset}px - 24px)` }}>
      {caption && <p className="tool-bar-caption">{caption}</p>}
      <div ref={bar} className="tool-bar" role="toolbar" aria-label={label} onFocus={onFocus} onKeyDown={onKeyDown}>
        {children}
      </div>
    </div>
  );
}

export function ToolBarDivider() {
  return <span className="tool-bar-sep" aria-hidden />;
}

/** A mode (`pressed` set) or an action. `hint` is the tooltip when it says more than the label. */
export function ToolBarButton({
  Icon,
  label,
  hint,
  pressed,
  disabled,
  danger,
  onClick,
  children,
}: {
  Icon: LucideIcon;
  label: string;
  hint?: string;
  pressed?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  /** Text shown next to the icon. */
  children?: ReactNode;
}) {
  const className = ["tool-bar-btn", danger && "danger", children !== undefined && "with-text"].filter(Boolean).join(" ");
  return (
    <button type="button" className={className} aria-label={label} data-tooltip={hint ?? label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      <Icon {...ICON} aria-hidden />
      {children}
    </button>
  );
}

/**
 * A button opening a panel of settings above the bar. `face` is what the
 * button shows (an icon, a color dot, a value); `children` can be a function
 * of `close` for choices that close it.
 */
export function ToolBarPopover({
  label,
  hint,
  face,
  disabled,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  face: ReactNode;
  disabled?: boolean;
  /** For long content (lists, pickers): wider, and scrolls past the window height. */
  wide?: boolean;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const { open, setOpen, root, trigger, pop } = usePopover("top");
  const close = () => setOpen(false);
  return (
    <div className="tool-bar-pop-root" ref={root}>
      <button
        ref={trigger}
        type="button"
        className={open ? "tool-bar-btn with-text open" : "tool-bar-btn with-text"}
        aria-label={label}
        data-tooltip={open ? undefined : (hint ?? label)}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {face}
      </button>
      {open &&
        createPortal(
          <div ref={pop} className={wide ? "tool-bar-pop wide" : "tool-bar-pop"} role="dialog" aria-label={label} style={{ visibility: "hidden" }}>
            {typeof children === "function" ? children(close) : children}
          </div>,
          document.body
        )}
    </div>
  );
}

/** A popover button's face for a color: a dot of it. */
export function Swatch({ color, mixed = false }: { color: string; mixed?: boolean }) {
  return <span className={mixed ? "tool-bar-swatch mixed" : "tool-bar-swatch"} style={mixed ? undefined : { background: color }} aria-hidden />;
}

/** "3 zones selected": the label leading several selected items' settings. */
export function SelectedCount({ noun, count }: { noun: FolderNoun; count: number }) {
  const { t, items } = useNoun(noun);
  return <span className="tool-bar-label">{t("layerFolders.selected", { items: items(count) })}</span>;
}

/** What several selected items can do together: show or hide, lock or unlock, delete; and Done. */
export function MultiSelectionGroup({
  noun,
  count,
  lockedCount,
  allVisible,
  allLocked,
  onToggleVisible,
  onToggleLocked,
  onDelete,
  onDone,
}: {
  noun: FolderNoun;
  count: number;
  /** Selected items that are locked (their own lock or their folder's): edits skip them. */
  lockedCount: number;
  allVisible: boolean;
  allLocked: boolean;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const { t, many } = useNoun(noun);
  const editable = count - lockedCount;
  return (
    <>
      <ToolBarButton
        Icon={allVisible ? Eye : EyeOff}
        label={allVisible ? t("layerFolders.hideSelected", { nouns: many }) : t("layerFolders.showSelected", { nouns: many })}
        hint={allVisible ? t("layerFolders.hideAll") : t("layerFolders.showAll")}
        onClick={onToggleVisible}
      />
      <ToolBarButton
        Icon={allLocked ? Lock : LockOpen}
        label={allLocked ? t("layerFolders.unlockSelected", { nouns: many }) : t("layerFolders.lockSelected", { nouns: many })}
        hint={allLocked ? t("layerFolders.unlockAll") : t("layerFolders.lockAll")}
        onClick={onToggleLocked}
      />
      <ToolBarButton
        Icon={Trash2}
        danger
        disabled={editable === 0}
        label={t("layerFolders.deleteSelected", { nouns: many })}
        hint={lockedCount ? t("layerFolders.deleteUnlocked", { n: formatInteger(editable), nouns: many }) : t("layerFolders.deleteAll")}
        onClick={onDelete}
      />
      <DoneButton onClick={onDone} />
    </>
  );
}

/** Ends the editing of the selection (Esc). */
export function DoneButton({ onClick }: { onClick: () => void }) {
  const tc = useT("common");
  const t = useT("maps");
  return (
    <ToolBarButton Icon={Check} label={tc("done")} hint={t("toolBar.doneHint")} onClick={onClick}>
      <span>{tc("done")}</span>
    </ToolBarButton>
  );
}
