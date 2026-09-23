"use client";

import { useState } from "react";
import { X, Layers, Plus, Eye, EyeOff, Trash2, GripVertical, ImageUp, ImageOff, RefreshCw, Check } from "lucide-react";
import { moveLayer, type AlwaysDrawFlag, type LayerPatch, type MapLayerData } from "./layer-images";

const ALWAYS_DRAW_OPTIONS: { flag: AlwaysDrawFlag; noun: string }[] = [
  { flag: "zonesAlwaysVisible", noun: "zones" },
  { flag: "markersAlwaysVisible", noun: "markers" },
  { flag: "textsAlwaysVisible", noun: "texts" },
  { flag: "linesAlwaysVisible", noun: "lines" },
];

function LayerRow({
  layer,
  isActive,
  isOnly,
  isDragOver,
  armed,
  onArm,
  onSetActive,
  onUpdate,
  onDelete,
  onUpload,
  onRemoveImage,
  onRetry,
  onMoveBy,
  dragHandlers,
}: {
  layer: MapLayerData;
  isActive: boolean;
  isOnly: boolean;
  isDragOver: boolean;
  armed: boolean;
  onArm: (armed: boolean) => void;
  onSetActive: () => void;
  onUpdate: (patch: LayerPatch) => void;
  onDelete: () => void;
  onUpload: (file: File) => Promise<string | null>;
  onRemoveImage: () => void;
  onRetry: (assetId: string) => void;
  onMoveBy: (delta: -1 | 1) => void;
  dragHandlers: Pick<React.HTMLAttributes<HTMLLIElement>, "onDragStart" | "onDragOver" | "onDrop" | "onDragEnd">;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(layer.name);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pending = layer.pendingAsset;
  const processing = pending && pending.state !== "failed";

  function commitName() {
    setRenaming(false);
    const name = draftName.trim();
    if (name && name !== layer.name) onUpdate({ name });
    else setDraftName(layer.name);
  }

  async function pickFile(file: File) {
    if (layer.asset && !window.confirm(`Replace the image of "${layer.name}"? It will be stretched to the map's frame.`)) return;
    setUploadError(null);
    setUploadError(await onUpload(file));
  }

  const rowClass = ["layer-row", isActive && "active", isDragOver && "drag-over", !layer.visible && "hidden-layer"].filter(Boolean).join(" ");

  return (
    // Only draggable while the grip is held, so sliders/inputs inside the row keep working.
    <li className={rowClass} draggable={armed} {...dragHandlers}>
      <div className="layer-row-header">
        <button
          type="button"
          className="layer-drag-handle"
          title="Drag to reorder (or focus and use ↑/↓)"
          aria-label={`Reorder ${layer.name}`}
          onMouseDown={() => onArm(true)}
          onMouseUp={() => onArm(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              onMoveBy(e.key === "ArrowUp" ? -1 : 1);
            }
          }}
        >
          <GripVertical size={14} strokeWidth={2.25} />
        </button>
        {renaming ? (
          <input
            type="text"
            className="layer-name-input"
            value={draftName}
            autoFocus
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraftName(layer.name);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="layer-name"
            onClick={onSetActive}
            onDoubleClick={() => setRenaming(true)}
            title="Click to make active, double-click to rename"
          >
            {isActive && <Check size={13} strokeWidth={2.5} />}
            {layer.name}
          </button>
        )}
        <div className="zone-row-actions">
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => onUpdate({ visible: !layer.visible })}
            title={layer.visible ? "Hide layer" : "Show layer"}
            aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
          >
            {layer.visible ? <Eye size={14} strokeWidth={2.25} /> : <EyeOff size={14} strokeWidth={2.25} />}
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={onDelete}
            disabled={isOnly}
            title={isOnly ? "A map needs at least one layer" : "Delete layer"}
            aria-label={`Delete ${layer.name}`}
          >
            <Trash2 size={14} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <div className="layer-image">
        {layer.asset ? (
          // eslint-disable-next-line @next/next/no-img-element -- small local thumbnail, not worth next/image's remote-optimization machinery
          <img className="layer-thumb" src={`/api/thumbnails/${layer.asset.id}`} alt="" />
        ) : (
          <div className="layer-thumb layer-thumb-empty">No image</div>
        )}
        <div className="layer-image-actions">
          <label className={processing ? "btn btn-sm disabled" : "btn btn-sm"}>
            <ImageUp size={13} strokeWidth={2.25} />
            {layer.asset ? "Replace" : "Add image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              disabled={Boolean(processing)}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void pickFile(file);
              }}
            />
          </label>
          {layer.asset && !processing && (
            <button type="button" className="btn btn-sm" onClick={onRemoveImage} title="Remove this layer's image">
              <ImageOff size={13} strokeWidth={2.25} />
              Remove
            </button>
          )}
        </div>
      </div>
      {processing && <p className="field-label zone-tool-hint">Processing image…</p>}
      {pending?.state === "failed" && (
        <p className="form-error layer-error">
          Image processing failed.{" "}
          <button type="button" className="btn btn-sm" onClick={() => onRetry(pending.id)}>
            <RefreshCw size={12} strokeWidth={2.25} />
            Retry
          </button>
        </p>
      )}
      {uploadError && <p className="form-error layer-error">{uploadError}</p>}

      {layer.asset && (
        <>
          <label className="grid-field">
            <div className="grid-field-header">
              <span className="field-label">Image opacity</span>
              <span className="grid-field-value">{Math.round(layer.imageOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(layer.imageOpacity * 100)}
              onChange={(e) => onUpdate({ imageOpacity: Number(e.target.value) / 100 })}
            />
          </label>
          <label className="layer-checkbox" title="Draw this image under every layer, not only when this layer is active">
            <input type="checkbox" checked={layer.imageAlwaysVisible} onChange={(e) => onUpdate({ imageAlwaysVisible: e.target.checked })} />
            <span className="field-label">Always draw this image</span>
          </label>
        </>
      )}

      {ALWAYS_DRAW_OPTIONS.map((o) => (
        <label key={o.flag} className="layer-checkbox" title={`Draw this layer's ${o.noun} even while another layer is active (display only)`}>
          <input type="checkbox" checked={layer[o.flag]} onChange={(e) => onUpdate({ [o.flag]: e.target.checked })} />
          <span className="field-label">Always draw {o.noun}</span>
        </label>
      ))}
    </li>
  );
}

export default function LayersPanel({
  layers,
  activeLayerId,
  onSetActive,
  onCreate,
  onUpdate,
  onReorder,
  onDelete,
  onUpload,
  onRemoveImage,
  onRetry,
  onClose,
}: {
  /** Already in list order (top first). */
  layers: MapLayerData[];
  activeLayerId: string | null;
  onSetActive: (id: string) => void;
  onCreate: () => void;
  onUpdate: (id: string, patch: LayerPatch) => void;
  onReorder: (orderedIds: string[]) => void;
  onDelete: (id: string) => void;
  onUpload: (id: string, file: File) => Promise<string | null>;
  onRemoveImage: (id: string) => void;
  onRetry: (assetId: string) => void;
  onClose: () => void;
}) {
  const [armedId, setArmedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const ids = layers.map((l) => l.id);

  function endDrag() {
    setArmedId(null);
    setDragId(null);
    setOverId(null);
  }

  function moveBy(id: string, delta: -1 | 1) {
    const idx = ids.indexOf(id);
    const target = ids[idx + delta];
    if (target) onReorder(moveLayer(ids, id, target));
  }

  return (
    <div className="layers-panel">
      <div className="marker-side-panel-header">
        <h2>
          <Layers size={16} strokeWidth={2.25} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          Layers
        </h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close layers panel">
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>
      <p className="field-label zone-tool-hint">Top of the list is drawn on top. Markers, zones and the grid belong to the active layer.</p>

      <ul className="layer-list">
        {layers.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            isActive={layer.id === activeLayerId}
            isOnly={layers.length <= 1}
            isDragOver={overId === layer.id && dragId !== layer.id}
            armed={armedId === layer.id}
            onArm={(armed) => setArmedId(armed ? layer.id : null)}
            onSetActive={() => onSetActive(layer.id)}
            onUpdate={(patch) => onUpdate(layer.id, patch)}
            onDelete={() => onDelete(layer.id)}
            onUpload={(file) => onUpload(layer.id, file)}
            onRemoveImage={() => onRemoveImage(layer.id)}
            onRetry={onRetry}
            onMoveBy={(delta) => moveBy(layer.id, delta)}
            dragHandlers={{
              onDragStart: (e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", layer.id); // Firefox won't start a drag without data
                setDragId(layer.id);
              },
              onDragOver: (e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overId !== layer.id) setOverId(layer.id);
              },
              onDrop: (e) => {
                e.preventDefault();
                if (dragId) onReorder(moveLayer(ids, dragId, layer.id));
                endDrag();
              },
              onDragEnd: endDrag,
            }}
          />
        ))}
      </ul>

      <button className="btn btn-sm" onClick={onCreate}>
        <Plus size={14} strokeWidth={2.25} />
        Create new layer
      </button>
    </div>
  );
}
