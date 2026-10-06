"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wrench } from "lucide-react";
import { TOOLS } from "./tools";

/** The Advanced Tools list (left column), drawn like the Settings sections. */
export default function ToolsNav() {
  const pathname = usePathname();
  return (
    <nav className="articles-sidebar settings-nav" aria-label="Advanced tools">
      <div className="settings-nav-title">
        <Wrench size={16} strokeWidth={2.25} aria-hidden />
        Advanced Tools
      </div>
      {TOOLS.map(({ href, label, description, icon: Icon }) => {
        const current = pathname.startsWith(href);
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
