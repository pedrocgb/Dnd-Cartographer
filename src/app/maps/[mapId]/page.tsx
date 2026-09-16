import MapViewer from "@/components/MapViewer";

export default async function MapPage({ params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  return <MapViewer mapId={mapId} />;
}
