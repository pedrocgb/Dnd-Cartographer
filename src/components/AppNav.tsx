"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Book, CalendarDays, Swords, ChevronDown, Settings, Waypoints, GitFork, LayoutDashboard, Globe2, Wrench, type LucideIcon } from "lucide-react";
import SearchBox from "./SearchBox";
import WorldDateLabel from "./WorldDateLabel";
import { TOOLS } from "./tools/tools";

interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Articles and the views built from them (pinned pseudo-views of /articles). */
const ARTICLE_VIEWS: MenuItem[] = [
  { href: "/articles", label: "Articles", icon: Book },
  { href: "/articles?type=relationships", label: "Relationships", icon: Waypoints },
  { href: "/articles?type=family", label: "Family trees", icon: GitFork },
  { href: "/articles?type=boards", label: "Boards", icon: LayoutDashboard },
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
        <Link href="/worlds" className="app-nav-brand app-nav-world" data-tooltip="Switch world">
          <Globe2 size={20} strokeWidth={2.25} />
          <span className="app-nav-world-name">{world.name}</span>
        </Link>
        <Link href="/maps" className={linkClass(pathname === "/maps" || pathname.startsWith("/maps/"))}>
          <Compass size={16} strokeWidth={2.25} />
          Maps
        </Link>
        <span className={pathname.startsWith("/articles") ? "app-nav-split current" : "app-nav-split"}>
          <Link href="/articles" className={linkClass(pathname.startsWith("/articles"))}>
            <Book size={16} strokeWidth={2.25} />
            Articles
          </Link>
          <NavMenu label="Articles, relationships, family trees and boards" items={ARTICLE_VIEWS} triggerClass="app-nav-link app-nav-split-toggle">
            <ChevronDown size={14} strokeWidth={2.25} aria-hidden />
          </NavMenu>
        </span>
        <Link href="/sessions" className={linkClass(pathname.startsWith("/sessions") || pathname.startsWith("/writer"))} data-tooltip="Sessions and Writer of the active campaign">
          <Swords size={16} strokeWidth={2.25} />
          Campaign
        </Link>
        <Link href="/calendars" className={linkClass(pathname.startsWith("/calendars"))}>
          <CalendarDays size={16} strokeWidth={2.25} />
          Calendars
        </Link>
        <NavMenu label="Advanced tools" items={TOOLS} triggerClass={linkClass(pathname.startsWith("/tools"))}>
          <Wrench size={16} strokeWidth={2.25} />
          Advanced Tools
          <ChevronDown size={14} strokeWidth={2.25} aria-hidden />
        </NavMenu>
        <Link href="/settings" className={linkClass(pathname.startsWith("/settings"))} data-tooltip="Settings, data and trash">
          <Settings size={16} strokeWidth={2.25} />
          Settings
        </Link>
      </div>
      <WorldDateLabel />
      <div className="app-nav-end">
        <SearchBox />
      </div>
    </nav>
  );
}
