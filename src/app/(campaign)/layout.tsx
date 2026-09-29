import { Suspense } from "react";
import CampaignHeader from "@/components/campaign/CampaignHeader";

/** The Campaign area (Sessions, Writer): one header with its tabs and the active campaign. */
export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="campaign-area">
      <Suspense fallback={<div className="campaign-header" />}>
        <CampaignHeader />
      </Suspense>
      {children}
    </div>
  );
}
