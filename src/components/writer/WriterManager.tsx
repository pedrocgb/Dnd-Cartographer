"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PenLine } from "lucide-react";
import { PageSkeleton } from "@/components/Skeleton";
import { CAMPAIGNS_CHANGED, readActiveCampaign, rememberActiveCampaign } from "@/components/campaign/active-campaign";
import CampaignWriter from "./CampaignWriter";
import { useCampaigns } from "./useWriterData";
import { useT } from "@/i18n/useT";

/**
 * The Writer page: the active campaign's story (see CampaignWriter). The
 * campaign is picked in the Campaign area's header; campaigns themselves
 * are created on the Sessions page.
 */
export default function WriterManager() {
  const t = useT("writer");
  const params = useSearchParams();
  const { campaigns, error, replace, reload } = useCampaigns();
  const urlCampaign = params.get("campaign");
  const [campaignId, setCampaignId] = useState<string | null>(() => urlCampaign ?? readActiveCampaign());
  // The header's picker changes the address: follow it.
  const [lastUrlCampaign, setLastUrlCampaign] = useState(urlCampaign);
  if (urlCampaign !== lastUrlCampaign) {
    setLastUrlCampaign(urlCampaign);
    if (urlCampaign) setCampaignId(urlCampaign);
  }
  useEffect(() => {
    window.addEventListener(CAMPAIGNS_CHANGED, reload);
    return () => window.removeEventListener(CAMPAIGNS_CHANGED, reload);
  }, [reload]);
  // No (valid) campaign picked: the first live one.
  const resolvedId = campaigns ? ((campaigns.find((c) => c.id === campaignId) ?? campaigns.find((c) => !c.archived))?.id ?? null) : null;
  useEffect(() => rememberActiveCampaign(resolvedId), [resolvedId]);

  if (error) return <p className="form-error ss-page-error">{error}</p>;
  if (!campaigns) return <PageSkeleton label={t("manager.loading")} main="cards" />;

  const live = campaigns.filter((c) => !c.archived || c.id === campaignId);
  const campaign = campaigns.find((c) => c.id === campaignId) ?? live[0] ?? null;

  if (!campaign) {
    return (
      <div className="articles-page">
        <main className="articles-main">
          <div className="articles-landing">
            <PenLine size={40} strokeWidth={1.5} aria-hidden />
            <h1>{t("manager.title")}</h1>
            <p className="cal-help">{t("manager.intro")}</p>
            <Link className="btn btn-primary" href="/sessions">
              {t("manager.createCampaign")}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return <CampaignWriter key={campaign.id} campaign={campaign} initialNode={params.get("node")} initialTab={params.get("tab")} initialMode={params.get("mode")} onCampaignChanged={replace} />;
}
