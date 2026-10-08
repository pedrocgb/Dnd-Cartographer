"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wrench } from "lucide-react";
import { TOOLS } from "./tools";
import { useT } from "@/i18n/useT";

/** The Advanced Tools list (left column), drawn like the Settings sections. */
export default function ToolsNav() {
  const t = useT("tools");
  const pathname = usePathname();
  return (
    <nav className="articles-sidebar settings-nav" aria-label={t("nav.title")}>
      <div className="settings-nav-title">
        <Wrench size={16} strokeWidth={2.25} aria-hidden />
        {t("nav.title")}
      </div>
      {TOOLS.map(({ id, href, icon: Icon }) => {
        const current = pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={current ? "settings-nav-link active" : "settings-nav-link"} aria-current={current ? "page" : undefined}>
            <Icon size={16} strokeWidth={2.25} aria-hidden />
            <span className="settings-nav-text">
              <span>{t(`${id}.label`)}</span>
              <span className="settings-nav-desc">{t(`${id}.description`)}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
