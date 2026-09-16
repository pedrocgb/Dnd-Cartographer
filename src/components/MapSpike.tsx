"use client";

import { useEffect, useRef, useState } from "react";
import type OpenSeadragonType from "openseadragon";

type MarkerCount = 0 | 1000 | 5000;

interface Marker {
  id: number;
  u: number;
  v: number;
  color: string;
}

// Deterministic PRNG so marker layout is reproducible across runs.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLORS = ["#3B82F6", "#EF4444", "#22C55E", "#F59E0B", "#A855F7", "#14B8A6"];

function buildMarkers(count: number): Marker[] {
  const rand = mulberry32(42);
  const markers: Marker[] = [];
  for (let i = 0; i < count; i++) {
    markers.push({
      id: i,
      u: rand(),
      v: rand(),
      color: COLORS[i % COLORS.length],
    });
  }
  // Deliberately cluster a batch at one point to exercise overlap handling.
  for (let i = 0; i < Math.min(20, count); i++) {
    markers.push({
      id: count + i,
      u: 0.5 + (rand() - 0.5) * 0.01,
      v: 0.5 + (rand() - 0.5) * 0.01,
      color: "#FFFFFF",
    });
  }
  return markers;
}

export default function MapSpike() {
  const viewerElRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<OpenSeadragonType.Viewer | null>(null);
  const osdRef = useRef<typeof OpenSeadragonType | null>(null);
  const overlaysRef = useRef<HTMLDivElement[]>([]);
  const [markerCount, setMarkerCount] = useState<MarkerCount>(1000);
  const [fps, setFps] = useState(0);
  const [memoryMb, setMemoryMb] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    import("openseadragon").then((OpenSeadragonModule) => {
      if (cancelled || !viewerElRef.current) return;
      const OSD = OpenSeadragonModule.default;
      osdRef.current = OSD;

      const viewer = OSD({
        element: viewerElRef.current,
        prefixUrl: "/osd-images/",
        tileSources: "/tiles/sample-map.dzi",
        showNavigator: true,
        maxZoomPixelRatio: 8,
        gestureSettingsMouse: { clickToZoom: false },
      });

      viewerRef.current = viewer;
      viewer.addHandler("open", () => setReady(true));
    });

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    const OSD = osdRef.current;
    if (!viewer || !OSD || !ready) return;

    for (const el of overlaysRef.current) {
      viewer.removeOverlay(el);
    }
    overlaysRef.current = [];

    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;

    const markers = buildMarkers(markerCount);
    const imageSize = tiledImage.getContentSize();

    for (const marker of markers) {
      const el = document.createElement("div");
      el.className = "spike-marker";
      el.style.background = marker.color;
      el.title = `Marker ${marker.id}`;

      const viewportPoint = tiledImage.imageToViewportCoordinates(
        marker.u * imageSize.x,
        marker.v * imageSize.y
      );

      viewer.addOverlay({
        element: el,
        location: viewportPoint,
        placement: OSD.Placement.CENTER,
        checkResize: false,
      });
      overlaysRef.current.push(el);
    }
  }, [markerCount, ready]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let raf = 0;
    const samples: number[] = [];

    const tick = () => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      samples.push(1000 / delta);
      if (samples.length > 30) samples.shift();
      frame++;
      if (frame % 10 === 0) {
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        setFps(Math.round(avg));
        const perf = performance as Performance & {
          memory?: { usedJSHeapSize: number };
        };
        if (perf.memory) {
          setMemoryMb(Math.round(perf.memory.usedJSHeapSize / 1024 / 1024));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="spike-root">
      <div className="spike-hud">
        <div className="spike-hud-row">
          <span className="spike-label">Markers</span>
          {[0, 1000, 5000].map((count) => (
            <button
              key={count}
              className={markerCount === count ? "spike-btn active" : "spike-btn"}
              onClick={() => setMarkerCount(count as MarkerCount)}
            >
              {count === 0 ? "None" : count.toLocaleString()}
            </button>
          ))}
        </div>
        <div className="spike-hud-row">
          <span className="spike-stat">FPS: {fps}</span>
          {memoryMb !== null && (
            <span className="spike-stat">JS heap: {memoryMb} MB</span>
          )}
          <span className="spike-stat">{ready ? "Image loaded" : "Loading…"}</span>
        </div>
      </div>
      <div ref={viewerElRef} className="spike-viewer" />
      <style jsx global>{`
        .spike-marker {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid #1a1a1a;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
