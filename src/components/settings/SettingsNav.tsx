"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, Globe, Keyboard, Ruler, Settings, Trash2, type LucideIcon } from "lucide-react";
import { useT } from "@/i18n/useT";

interface Section {
  /** Its `settings` messages: `nav.${id}.label`, `nav.${id}.description`. */
  id: "general" | "formats" | "shortcuts" | "data" | "trash";
  href: string;
  icon: LucideIcon;
}

export const SETTINGS_SECTIONS: Section[] = [
  { id: "general", href: "/settings", icon: Globe },
  { id: "formats", href: "/settings/formats", icon: Ruler },
  { id: "shortcuts", href: "/settings/shortcuts", icon: Keyboard },
  { id: "data", href: "/settings/data", icon: Database },
  { id: "trash", href: "/settings/trash", icon: Trash2 },
];

/** The Settings page's section list (left column). */
export default function SettingsNav() {
  const pathname = usePathname();
  const t = useT("settings");
  return (
    <nav className="articles-sidebar settings-nav" aria-label={t("nav.label")}>
      <div className="settings-nav-title">
        <Settings size={16} strokeWidth={2.25} aria-hidden />
        {t("nav.title")}
      </div>
      {SETTINGS_SECTIONS.map(({ id, href, icon: Icon }) => {
        const current = href === "/settings" ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={current ? "settings-nav-link active" : "settings-nav-link"} aria-current={current ? "page" : undefined}>
            <Icon size={16} strokeWidth={2.25} aria-hidden />
            <span className="settings-nav-text">
              <span>{t(`nav.${id}.label`)}</span>
              <span className="settings-nav-desc">{t(`nav.${id}.description`)}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
