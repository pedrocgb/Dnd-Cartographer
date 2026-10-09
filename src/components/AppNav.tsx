"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Book, CalendarDays, Check, Swords, ChevronDown, Settings, Waypoints, GitFork, LayoutDashboard, Globe2, Wrench, ScrollText, PenLine, type LucideIcon } from "lucide-react";
import SearchBox from "./SearchBox";
import WorldDateLabel from "./WorldDateLabel";
import { LANGUAGE_OPTIONS } from "./settings/languages";
import { useSettings } from "./settings/SettingsProvider";
import { TOOLS } from "./tools/tools";
import { useT } from "@/i18n/useT";
import type { MessageKey } from "@/i18n/messages";

interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Articles and the views built from them (pinned pseudo-views of /articles). */
const ARTICLE_VIEWS: { href: string; labelKey: MessageKey<"nav">; icon: LucideIcon }[] = [
  { href: "/articles", labelKey: "articles", icon: Book },
  { href: "/articles?type=relationships", labelKey: "relationships", icon: Waypoints },
  { href: "/articles?type=family", labelKey: "familyTrees", icon: GitFork },
];

/** The active campaign's two areas. */
const CAMPAIGN_VIEWS: { href: string; labelKey: MessageKey<"nav">; icon: LucideIcon }[] = [
  { href: "/writer", labelKey: "writer", icon: PenLine },
  { href: "/sessions", labelKey: "sessions", icon: ScrollText },
  { href: "/boards", labelKey: "boards", icon: LayoutDashboard },
];

/** A small dropdown of links: click to open, Esc or a click outside closes it. */
/** A top bar dropdown: opens on click; closes on Esc, a click outside, or a page change. */
function TopMenu({ label, triggerClass, trigger, align = "left", children }: { label: string; triggerClass: string; trigger: React.ReactNode; align?: "left" | "right"; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div
      className="app-nav-menu"
      ref={rootRef}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button type="button" className={triggerClass} aria-haspopup="true" aria-expanded={open} aria-label={label} data-tooltip={open ? undefined : label} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && (
        <div className={align === "right" ? "app-nav-menu-popup app-nav-menu-popup-end" : "app-nav-menu-popup"} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function NavMenu({ label, items, triggerClass, children }: { label: string; items: MenuItem[]; triggerClass: string; children: React.ReactNode }) {
  return (
    <TopMenu label={label} triggerClass={triggerClass} trigger={children}>
      {(close) =>
        items.map(({ href, label: itemLabel, icon: Icon }) => (
          <Link key={href} href={href} role="menuitem" className="app-nav-menu-item" onClick={close}>
            <Icon size={15} strokeWidth={2.25} aria-hidden />
            {itemLabel}
          </Link>
        ))
      }
    </TopMenu>
  );
}

/** The app's language, switched from the top bar (also in Settings > General). */
function LanguageMenu() {
  const t = useT("nav");
  const { settings, updateSetting } = useSettings();
  const current = LANGUAGE_OPTIONS.find((o) => o.key === settings.language) ?? LANGUAGE_OPTIONS[0];
  return (
    <TopMenu
      label={t("languageMenu")}
      triggerClass="app-nav-link app-nav-language"
      align="right"
      trigger={
        <>
          <current.Flag className="app-nav-flag" />
          {current.key}
          <ChevronDown size={14} strokeWidth={2.25} aria-hidden />
        </>
      }
    >
      {(close) =>
        LANGUAGE_OPTIONS.map(({ key, label, region, Flag }) => (
          <button
            key={key}
            type="button"
            role="menuitemradio"
            aria-checked={key === settings.language}
            className="app-nav-menu-item"
            onClick={() => {
              close();
              void updateSetting("language", key);
            }}
          >
            <Flag className="app-nav-flag" />
            <span className="app-nav-language-text">
              <strong>{label}</strong>
              <span>{region}</span>
            </span>
            {key === settings.language && <Check size={15} strokeWidth={2.5} aria-hidden />}
          </button>
        ))
      }
    </TopMenu>
  );
}

/**
 * The top bar: Maps, Articles (and its views), the Campaign area (Writer,
 * Sessions, Boards), Calendars and Settings (which also holds Trash, Import and
 * Export); on the right, search, the language and optionally the in-world date. The brand is the open
 * world's name and leads to the worlds screen, where the bar shows nothing else.
 */
export default function AppNav({ world }: { world: { id: string; name: string } | null }) {
  const pathname = usePathname();
  const t = useT("nav");
  const tTools = useT("tools");
  const linkClass = (current: boolean) => (current ? "app-nav-link current" : "app-nav-link");

  // A shared page is for someone outside the app: no way into it from there.
  if (pathname.startsWith("/share/")) return null;

  if (pathname === "/worlds" || pathname.startsWith("/worlds/") || !world) {
    return (
      <nav className="app-nav app-nav-bare">
        <Link href="/worlds" className="app-nav-brand">
          <Compass size={20} strokeWidth={2.25} />
          World Wiki
        </Link>
      </nav>
    );
  }

  return (
    <nav className="app-nav">
      <div className="app-nav-start">
        <Link href="/worlds" className="app-nav-brand app-nav-world" data-tooltip={t("switchWorld")}>
          <Globe2 size={20} strokeWidth={2.25} />
          <span className="app-nav-world-name">{world.name}</span>
        </Link>
        <Link href="/maps" className={linkClass(pathname === "/maps" || pathname.startsWith("/maps/"))}>
          <Compass size={16} strokeWidth={2.25} />
          {t("maps")}
        </Link>
        <NavMenu label={t("articlesMenu")} items={ARTICLE_VIEWS.map(({ labelKey, ...v }) => ({ ...v, label: t(labelKey) }))} triggerClass={linkClass(pathname.startsWith("/articles"))}>
          <Book size={16} strokeWidth={2.25} />
          {t("articles")}
          <ChevronDown size={14} strokeWidth={2.25} aria-hidden />
        </NavMenu>
        <NavMenu label={t("campaignMenu")} items={CAMPAIGN_VIEWS.map(({ labelKey, ...v }) => ({ ...v, label: t(labelKey) }))} triggerClass={linkClass(pathname.startsWith("/sessions") || pathname.startsWith("/writer") || pathname.startsWith("/boards"))}>
          <Swords size={16} strokeWidth={2.25} />
          {t("campaign")}
          <ChevronDown size={14} strokeWidth={2.25} aria-hidden />
        </NavMenu>
        <Link href="/calendars" className={linkClass(pathname.startsWith("/calendars"))}>
          <CalendarDays size={16} strokeWidth={2.25} />
          {t("calendars")}
        </Link>
        <NavMenu label={t("advancedToolsMenu")} items={TOOLS.map((tool) => ({ ...tool, label: tTools(`${tool.id}.label`) }))} triggerClass={linkClass(pathname.startsWith("/tools"))}>
          <Wrench size={16} strokeWidth={2.25} />
          {t("advancedTools")}
          <ChevronDown size={14} strokeWidth={2.25} aria-hidden />
        </NavMenu>
        <Link href="/settings" className={linkClass(pathname.startsWith("/settings"))} data-tooltip={t("settingsHint")}>
          <Settings size={16} strokeWidth={2.25} />
          {t("settings")}
        </Link>
      </div>
      <div className="app-nav-end">
        <SearchBox />
        <LanguageMenu />
        <WorldDateLabel />
      </div>
    </nav>
  );
}
