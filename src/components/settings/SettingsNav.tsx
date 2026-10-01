"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, Globe, Keyboard, Ruler, Settings, Trash2, type LucideIcon } from "lucide-react";

interface Section {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const SETTINGS_SECTIONS: Section[] = [
  { href: "/settings", label: "General", description: "Language", icon: Globe },
  { href: "/settings/formats", label: "Units & formats", description: "Weights, distances, dates", icon: Ruler },
  { href: "/settings/shortcuts", label: "Shortcuts", description: "Every hotkey in the app", icon: Keyboard },
  { href: "/settings/data", label: "Data", description: "Import and export", icon: Database },
  { href: "/settings/trash", label: "Trash", description: "Restore or delete for good", icon: Trash2 },
];

/** The Settings page's section list (left column). */
export default function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="articles-sidebar settings-nav" aria-label="Settings sections">
      <div className="settings-nav-title">
        <Settings size={16} strokeWidth={2.25} aria-hidden />
        Settings
      </div>
      {SETTINGS_SECTIONS.map(({ href, label, description, icon: Icon }) => {
        const current = href === "/settings" ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={current ? "settings-nav-link active" : "settings-nav-link"} aria-current={current ? "page" : undefined}>
            <Icon size={16} strokeWidth={2.25} aria-hidden />
            <span className="settings-nav-text">
              <span>{label}</span>
              <span className="settings-nav-desc">{description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
