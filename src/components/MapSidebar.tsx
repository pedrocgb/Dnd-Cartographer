"use client";

import { Settings, MapPinned, Grid3x3, Shapes, Filter, ImageUp, Trash2 } from "lucide-react";

export default function MapSidebar({
  hasImage,
  uploading,
  markersDisabled,
  gridDisabled,
  zonesDisabled,
  iconFilterDisabled,
  onOpenSettings,
  onOpenMarkers,
  onOpenGrid,
  onOpenZones,
  onOpenIconFilter,
  onUploadImage,
  onDeleteMap,
}: {
  hasImage: boolean;
  uploading: boolean;
  markersDisabled: boolean;
  gridDisabled: boolean;
  zonesDisabled: boolean;
  iconFilterDisabled: boolean;
  onOpenSettings: () => void;
  onOpenMarkers: () => void;
  onOpenGrid: () => void;
  onOpenZones: () => void;
  onOpenIconFilter: () => void;
  onUploadImage: (file: File) => void;
  onDeleteMap: () => void;
}) {
  return (
    <div className="map-sidebar">
      <button
        className="map-sidebar-btn"
        onClick={onOpenSettings}
        title="Map settings"
        aria-label="Map settings"
      >
        <Settings size={19} strokeWidth={2.25} />
      </button>

      <button
        className="map-sidebar-btn"
        onClick={onOpenMarkers}
        disabled={markersDisabled}
        title={markersDisabled ? "Upload an image first" : "Markers on this map"}
        aria-label="Markers on this map"
      >
        <MapPinned size={19} strokeWidth={2.25} />
      </button>

      <button
        className="map-sidebar-btn"
        onClick={onOpenGrid}
        disabled={gridDisabled}
        title={gridDisabled ? "Upload an image first" : "Grid overlay"}
        aria-label="Grid overlay"
      >
        <Grid3x3 size={19} strokeWidth={2.25} />
      </button>

      <button
        className="map-sidebar-btn"
        onClick={onOpenZones}
        disabled={zonesDisabled}
        title={zonesDisabled ? "Upload an image first" : "Zones"}
        aria-label="Zones"
      >
        <Shapes size={19} strokeWidth={2.25} />
      </button>

      <button
        className="map-sidebar-btn"
        onClick={onOpenIconFilter}
        disabled={iconFilterDisabled}
        title={iconFilterDisabled ? "Upload an image first" : "Filter markers by icon"}
        aria-label="Filter markers by icon"
      >
        <Filter size={19} strokeWidth={2.25} />
      </button>

      <label
        className="map-sidebar-btn"
        title={hasImage ? "Replace image" : "Upload image"}
        aria-label={hasImage ? "Replace image" : "Upload image"}
        style={{ cursor: uploading ? "default" : "pointer" }}
      >
        <ImageUp size={19} strokeWidth={2.25} />
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }}
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onUploadImage(file);
          }}
        />
      </label>

      <button
        className="map-sidebar-btn danger"
        onClick={onDeleteMap}
        title="Delete map"
        aria-label="Delete map"
      >
        <Trash2 size={19} strokeWidth={2.25} />
      </button>
    </div>
  );
}
