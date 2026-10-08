"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Book, CalendarDays, Swords, ChevronDown, Settings, Waypoints, GitFork, LayoutDashboard, Globe2, Wrench, ScrollText, PenLine, type LucideIcon } from "lucide-react";
import SearchBox from "./SearchBox";
import WorldDateLabel from "./WorldDateLabel";
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
  { href: "/articles?type=boards", labelKey: "boards", icon: LayoutDashboard },
];

/** The active campaign's two areas. */
const CAMPAIGN_VIEWS: { href: string; labelKey: MessageKey<"nav">; icon: LucideIcon }[] = [
  { href: "/sessions", labelKey: "sessions", icon: ScrollText },
  { href: "/writer", labelKey: "writer", icon: PenLine },
];

/** A small dropdown of links: click to open, Esc or a click outside closes it. */
function NavMenu({ label, items, triggerClass, children }: { label: string; items: MenuItem[]; triggerClass: string; children: React.ReactNode }) {
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
        {children}
      </button>
      {open && (
        <div className="app-nav-menu-popup" role="menu">
          {items.map(({ href, label: itemLabel, icon: Icon }) => (
            <Link key={href} href={href} role="menuitem" className="app-nav-menu-item" onClick={() => setOpen(false)}>
              <Icon size={15} strokeWidth={2.25} aria-hidden />
              {itemLabel}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The top bar: Maps, Articles (and its views), the Campaign area (Sessions,
 * Writer), Calendars and Settings (which also holds Trash, Import and Export);
 * optionally the current in-world date in the middle. The brand is the open
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
        <NavMenu label={t("campaignMenu")} items={CAMPAIGN_VIEWS.map(({ labelKey, ...v }) => ({ ...v, label: t(labelKey) }))} triggerClass={linkClass(pathname.startsWith("/sessions") || pathname.startsWith("/writer"))}>
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
      <WorldDateLabel />
      <div className="app-nav-end">
        <SearchBox />
      </div>
    </nav>
  );
}
