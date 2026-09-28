"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PenLine } from "lucide-react";
import { PageSkeleton } from "@/components/Skeleton";
import CampaignWriter from "./CampaignWriter";
import { useCampaigns } from "./useWriterData";

/**
 * The Writer page: pick a campaign, then write its story (see
 * CampaignWriter). Campaigns themselves are created on the Sessions page.
 */
export default function WriterManager() {
  const params = useSearchParams();
  const { campaigns, error, replace } = useCampaigns();
  const [campaignId, setCampaignId] = useState<string | null>(params.get("campaign"));

  if (error) return <p className="form-error ss-page-error">{error}</p>;
  if (!campaigns) return <PageSkeleton label="Loading the writer…" main="cards" />;

  const live = campaigns.filter((c) => !c.archived || c.id === campaignId);
  const campaign = campaigns.find((c) => c.id === campaignId) ?? live[0] ?? null;

  if (!campaign) {
    return (
      <div className="articles-page">
        <main className="articles-main">
          <div className="articles-landing">
            <PenLine size={40} strokeWidth={1.5} aria-hidden />
            <h1>Campaign Writer</h1>
            <p className="cal-help">Write your campaign&apos;s story: arcs, chapters and scenes, the threads that run through them, and what happened at the table. Start by creating a campaign.</p>
            <Link className="btn btn-primary" href="/sessions">
              Create a campaign
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return <CampaignWriter key={campaign.id} campaign={campaign} campaigns={live} initialNode={params.get("node")} initialTab={params.get("tab")} onPickCampaign={setCampaignId} onCampaignChanged={replace} />;
}
