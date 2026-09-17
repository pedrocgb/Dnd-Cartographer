"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, MapPlus, Trash2, Download, Upload, Crown } from "lucide-react";
import SearchBox from "./SearchBox";

const LINKS = [
  { href: "/maps", label: "Maps", icon: Compass },
  { href: "/maps/new", label: "Create map", icon: MapPlus },
  { href: "/politics", label: "Politics", icon: Crown },
  { href: "/maps/trash", label: "Trash", icon: Trash2 },
  { href: "/import", label: "Import", icon: Upload },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="app-nav">
      <Link href="/maps" className="app-nav-brand">
        <Compass size={20} strokeWidth={2.25} />
        World Wiki
      </Link>
      {LINKS.map(({ href, label, icon: Icon }) => {
        const current = href === "/maps" ? pathname === "/maps" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={current ? "app-nav-link current" : "app-nav-link"}>
            <Icon size={16} strokeWidth={2.25} />
            {label}
          </Link>
        );
      })}
      <a href="/api/export" className="app-nav-link">
        <Download size={16} strokeWidth={2.25} />
        Export
      </a>
      <SearchBox />
    </nav>
  );
}
