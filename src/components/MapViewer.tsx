"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import MapWorkspace from "./MapWorkspace";
import MapSidebar from "./MapSidebar";
import MapSettingsModal from "./MapSettingsModal";
import MarkersListModal from "./MarkersListModal";
import type { Marker } from "./MarkerLayer";
import type { MapGrid } from "./GridLayer";

interface MapAsset {
  id: string;
  state: "uploading" | "queued" | "processing" | "ready" | "failed" | "cancelled";
  width: number | null;
  height: number | null;
  manifestKey: string | null;
}

interface Category {
  id: string;
  label: string;
}

interface ChildMap {
  id: string;
  name: string;
}

interface Breadcrumb {
  id: string;
  name: string;
}

interface MapStatus {
  map: {
    id: string;
    name: string;
    parentId: string | null;
    categoryId: string | null;
    descriptionDocumentId: string | null;
  };
  category: Category | null;
  asset: MapAsset | null;
  job: { lastError: string | null; attempts: number } | null;
  breadcrumbs: Breadcrumb[];
  children: ChildMap[];
}

async function fetchStatus(mapId: string): Promise<MapStatus> {
  const res = await fetch(`/api/maps/${mapId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load map status.");
  return res.json();
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="loading-screen">
      <div className="loading-progress-track">
        <div className="loading-progress-bar" />
      </div>
      <p className="loading-message">{message}</p>
    </div>
  );
}

function assetLoadingMessage(asset: MapAsset, job: MapStatus["job"]): string {
  switch (asset.state) {
    case "uploading":
      return "Uploading image…";
    case "queued":
      return `Queued for processing${job ? ` (attempt ${job.attempts})` : ""}…`;
    case "processing":
      return "Preparing your map…";
    default:
      return "Loading…";
  }
}

function Breadcrumbs({ trail }: { trail: Breadcrumb[] }) {
  return (
    <nav className="map-breadcrumbs">
      <Link href="/maps">Maps</Link>
      {trail.map((entry, i) => (
        <span key={entry.id}>
          {" / "}
          {i === trail.length - 1 ? entry.name : <Link href={`/maps/${entry.id}`}>{entry.name}</Link>}
        </span>
      ))}
    </nav>
  );
}

export default function MapViewer({ mapId }: { mapId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<MapStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [markersListOpen, setMarkersListOpen] = useState(false);
  const [externalFocusMarkerId, setExternalFocusMarkerId] = useState<string | null>(null);
  const [grid, setGrid] = useState<MapGrid | null>(null);
  const [gridPanelOpen, setGridPanelOpen] = useState(false);
  const gridPatchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A ref, not a plain closure variable: `uploadImage`/`retry` need to
  // (re)start this same polling loop after the asset lifecycle restarts
  // (e.g. replacing an already-ready image), not just do a single one-off
  // fetch — a one-off fetch was the actual bug (see schedulePoll below).
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pollCancelledRef = useRef(false);

  function schedulePoll(delayMs: number) {
    clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(async () => {
      try {
        const next = await fetchStatus(mapId);
        if (pollCancelledRef.current) return;
        setStatus(next);
        setError(null);
        const state = next.asset?.state;
        if (state !== "ready" && state !== "failed" && state !== "cancelled") {
          schedulePoll(1200);
        }
      } catch (err) {
        if (!pollCancelledRef.current) setError(err instanceof Error ? err.message : String(err));
      }
    }, delayMs);
  }

  useEffect(() => {
    pollCancelledRef.current = false;
    schedulePoll(0);
    return () => {
      pollCancelledRef.current = true;
      clearTimeout(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- schedulePoll intentionally omitted: it's re-created each render but always closes over the current mapId, and only mapId changing should restart the loop.
  }, [mapId]);

  useEffect(() => {
    fetch(`/api/maps/${mapId}/markers`)
      .then((r) => r.json())
      .then((d) => setMarkers(d.markers));
    fetch(`/api/maps/${mapId}/grid`)
      .then((r) => r.json())
      .then((d) => setGrid(d.grid));
  }, [mapId]);

  async function retry() {
    if (!status?.asset) return;
    await fetch(`/api/assets/${status.asset.id}/retry`, { method: "POST" });
    schedulePoll(0);
  }

  async function refresh() {
    setStatus(await fetchStatus(mapId));
  }

  async function uploadImage(file: File) {
    if (status?.asset) {
      const proceed = window.confirm(
        "Replacing the image keeps existing markers at their current normalized position — if the new artwork isn't the same geography at the same framing, marker placement may no longer line up. Continue?"
      );
      if (!proceed) return;
    }
    setUploading(true);
    const res = await fetch(`/api/maps/${mapId}/assets`, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    setUploading(false);
    if (res.ok) schedulePoll(0);
    else window.alert((await res.json()).error ?? "Upload failed.");
  }

  async function removeMap(strategy?: "cascade" | "orphan") {
    if (!status) return;
    setDeleteError(null);
    const res = await fetch(`/api/maps/${mapId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(strategy ? { strategy } : {}),
    });
    if (res.status === 409) {
      const data = await res.json();
      const choice = window.confirm(
        `"${status.map.name}" has ${data.childCount} child map(s). OK to move them to the root (Cancel to delete the whole subtree instead).`
      );
      await removeMap(choice ? "orphan" : "cascade");
      return;
    }
    if (!res.ok) {
      setDeleteError("Failed to delete map.");
      return;
    }
    router.push("/maps");
  }

  function onDeleteMap() {
    if (window.confirm("Delete this map? This can be undone from the Trash page.")) removeMap();
  }

  async function onOpenGrid() {
    if (!grid) {
      const res = await fetch(`/api/maps/${mapId}/grid`, { method: "POST" });
      const data = await res.json();
      setGrid(data.grid);
    }
    setGridPanelOpen(true);
  }

  function updateGrid(patch: Partial<MapGrid>) {
    setGrid((prev) => (prev ? { ...prev, ...patch } : prev));
    // Sliders fire on every drag tick — updating local state immediately
    // keeps the on-map preview instant, but debounce the actual save so
    // dragging a slider doesn't fire a PATCH per pixel of movement.
    clearTimeout(gridPatchTimerRef.current);
    gridPatchTimerRef.current = setTimeout(() => {
      fetch(`/api/maps/${mapId}/grid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    }, 250);
  }

  function deleteGrid() {
    setGrid(null);
    setGridPanelOpen(false);
    clearTimeout(gridPatchTimerRef.current);
    fetch(`/api/maps/${mapId}/grid`, { method: "DELETE" });
  }

  if (error) return <div className="map-status">Error: {error}</div>;
  if (!status) return <LoadingScreen message="Loading map…" />;

  const { asset, job } = status;

  return (
    <div className="map-page-root">
      <Breadcrumbs trail={status.breadcrumbs} />
      {deleteError && <p className="form-error">{deleteError}</p>}

      {status.children.length > 0 && (
        <div className="map-children-panel">
          {status.children.map((child) => (
            <Link key={child.id} href={`/maps/${child.id}`} className="map-child-card">
              {child.name}
            </Link>
          ))}
        </div>
      )}

      <div className="map-page-body">
        <MapSidebar
          hasImage={Boolean(asset)}
          uploading={uploading}
          markersDisabled={!asset || asset.state !== "ready"}
          gridDisabled={!asset || asset.state !== "ready"}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenMarkers={() => setMarkersListOpen(true)}
          onOpenGrid={onOpenGrid}
          onUploadImage={uploadImage}
          onDeleteMap={onDeleteMap}
        />

        {!asset && (
          <div className="map-status">
            <p>No image uploaded yet for &ldquo;{status.map.name}&rdquo;.</p>
          </div>
        )}

        {asset && asset.state === "ready" && (
          <div className="spike-root">
            <MapWorkspace
              mapId={mapId}
              assetId={asset.id}
              markers={markers}
              setMarkers={setMarkers}
              externalFocusMarkerId={externalFocusMarkerId}
              onExternalFocusHandled={() => setExternalFocusMarkerId(null)}
              grid={grid}
              gridPanelOpen={gridPanelOpen}
              onCloseGridPanel={() => setGridPanelOpen(false)}
              onUpdateGrid={updateGrid}
              onDeleteGrid={deleteGrid}
              imageWidth={asset.width ?? 1}
              imageHeight={asset.height ?? 1}
            />
          </div>
        )}

        {asset && asset.state === "failed" && (
          <div className="map-status">
            <p>Processing failed{job?.lastError ? `: ${job.lastError}` : "."}</p>
            <button className="btn btn-primary" onClick={retry}>
              <RefreshCw size={15} strokeWidth={2.25} />
              Retry
            </button>
          </div>
        )}

        {asset && !["ready", "failed"].includes(asset.state) && (
          <LoadingScreen message={assetLoadingMessage(asset, job)} />
        )}
      </div>

      <MapSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        status={status}
        mapId={mapId}
        onChanged={refresh}
      />
      <MarkersListModal
        open={markersListOpen}
        onClose={() => setMarkersListOpen(false)}
        markers={markers}
        onSelect={(id) => setExternalFocusMarkerId(id)}
      />
    </div>
  );
}
