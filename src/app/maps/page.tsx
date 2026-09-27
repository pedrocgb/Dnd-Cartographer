import { Suspense } from "react";
import MapManager from "@/components/MapManager";

export default function MapsPage() {
  return (
    <Suspense fallback={null}>
      <MapManager />
    </Suspense>
  );
}
