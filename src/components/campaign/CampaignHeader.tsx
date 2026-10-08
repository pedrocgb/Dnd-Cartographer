"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PenLine, ScrollText, Swords } from "lucide-react";
import { api } from "@/components/calendars/api";
import type { ClientCampaign } from "@/components/sessions/types";
import { CAMPAIGNS_CHANGED, readActiveCampaign, rememberActiveCampaign } from "./active-campaign";
import { useT } from "@/i18n/useT";

const TABS = [
  { href: "/sessions", id: "sessions", icon: ScrollText },
  { href: "/writer", id: "writer", icon: PenLine },
] as const;

/** Address parameters that belong to one campaign's content, dropped when switching campaigns. */
const PER_CAMPAIGN_PARAMS = ["session", "quest", "node"];

/**
 * The Campaign area's header: its tabs and the active campaign, one picker
 * for all of them (see active-campaign.ts). Campaigns are created and
 * managed on the Sessions tab.
 */
export default function CampaignHeader() {
  const t = useT("campaign");
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<ClientCampaign[] | null>(null);
  const [stored] = useState(readActiveCampaign);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      void api<{ campaigns: ClientCampaign[] }>("GET", "/api/campaigns").then((res) => {
        if (!cancelled && res.ok) setCampaigns(res.data.campaigns);
      });
    load();
    window.addEventListener(CAMPAIGNS_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(CAMPAIGNS_CHANGED, load);
    };
  }, []);

  const wanted = params.get("campaign") ?? stored;
  const active = campaigns?.find((c) => c.id === wanted) ?? campaigns?.find((c) => !c.archived) ?? null;
  const listed = campaigns?.filter((c) => !c.archived || c.id === active?.id) ?? [];

  function pick(id: string) {
    rememberActiveCampaign(id);
    const next = new URLSearchParams(params.toString());
    for (const key of PER_CAMPAIGN_PARAMS) next.delete(key);
    next.set("campaign", id);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <header className="campaign-header">
      <span className="campaign-header-title">
        <Swords size={16} strokeWidth={2.25} aria-hidden />
        {t("header.campaign")}
      </span>
      <nav className="campaign-tabs" aria-label={t("header.campaign")}>
        {TABS.map(({ href, id, icon: Icon }) => {
          const current = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={active ? `${href}?campaign=${encodeURIComponent(active.id)}` : href}
              className={current ? "cal-tab active campaign-tab" : "cal-tab campaign-tab"}
              aria-current={current ? "page" : undefined}
              data-tooltip={t(`header.tab.${id}Hint`)}
            >
              <Icon size={14} strokeWidth={2.25} aria-hidden />
              {t(`header.tab.${id}`)}
            </Link>
          );
        })}
      </nav>
      {listed.length > 0 && active && (
        <label className="campaign-picker">
          <span className="field-label">{t("header.activeCampaign")}</span>
          <select value={active.id} onChange={(e) => pick(e.target.value)} aria-label={t("header.activeCampaign")}>
            {listed.map((c) => (
              <option key={c.id} value={c.id}>
                {c.archived ? t("header.archivedName", { name: c.name }) : c.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </header>
  );
}
