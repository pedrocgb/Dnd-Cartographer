import { Suspense } from "react";
import PoliticsManager from "@/components/PoliticsManager";

export default function PoliticsPage() {
  return (
    <Suspense fallback={null}>
      <PoliticsManager />
    </Suspense>
  );
}
