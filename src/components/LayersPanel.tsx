"use client";

import { useState } from "react";
import { X, Layers, Plus, Eye, EyeOff, Trash2, GripVertical, RefreshCw, Check, Settings } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import LayerImageDialog, { type Frame } from "./LayerImageDialog";
import { ALWAYS_DRAW_OPTIONS, moveLayer, type LayerPatch, type MapLayerData } from "./layer-images";
import { useT } from "@/i18n/useT";

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
  frame,
  onImageDialogClose,
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
  frame: Frame;
  onImageDialogClose: () => void;
}) {
  const t = useT("maps");
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

  const [replacing, setReplacing] = useState<File | null>(null);
  // The image dialog: opened to adjust, and after every upload to line the new image up.
  const [imageDialog, setImageDialog] = useState(false);

  async function upload(file: File) {
    setReplacing(null);
    setUploadError(null);
    const error = await onUpload(file);
    setUploadError(error);
    if (!error) setImageDialog(true);
  }

  /** A new image for a layer that has one asks first (its position and scale start over). */
  function pickFile(file: File) {
    if (layer.asset) setReplacing(file);
    else void upload(file);
  }

  // What the layer draws even while another one is active, shown on the row (set in the layer's settings).
  const alwaysDrawn = [
    ...(layer.asset && layer.imageAlwaysVisible ? [{ key: "Image" as const, hint: t("layerImage.alwaysImageHint") }] : []),
    ...ALWAYS_DRAW_OPTIONS.filter((o) => layer[o.flag]).map((o) => ({ key: o.key, hint: t(`layerImage.always${o.key}Hint`) })),
  ];
  const rowClass = ["layer-row", isActive && "active", isDragOver && "drag-over", !layer.visible && "hidden-layer"].filter(Boolean).join(" ");

  return (
    // Only draggable while the grip is held, so sliders/inputs inside the row keep working.
    <li className={rowClass} draggable={armed} {...dragHandlers}>
      <div className="layer-row-header">
        <button
          type="button"
          className="layer-drag-handle"
          data-tooltip={t("layers.reorderHint")}
          aria-label={t("layers.reorder", { name: layer.name })}
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
            data-tooltip={t("layers.activateHint")}
          >
            {isActive && <Check size={13} strokeWidth={2.5} />}
            {layer.name}
          </button>
        )}
        <div className="zone-row-actions">
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => onUpdate({ visible: !layer.visible })}
            data-tooltip={layer.visible ? t("layers.hideHint") : t("layers.showHint")}
            aria-label={layer.visible ? t("layers.hide", { name: layer.name }) : t("layers.show", { name: layer.name })}
          >
            {layer.visible ? <Eye size={14} strokeWidth={2.25} /> : <EyeOff size={14} strokeWidth={2.25} />}
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            onClick={onDelete}
            disabled={isOnly}
            data-tooltip={isOnly ? t("layers.onlyOne") : t("layers.deleteHint")}
            aria-label={t("layers.delete", { name: layer.name })}
          >
            <Trash2 size={14} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {alwaysDrawn.length > 0 && (
        <div className="layer-tags" role="group" aria-label={t("layers.tagsLabel")}>
          <span className="layer-tags-lead">{t("layers.tagsLead")}</span>
          {alwaysDrawn.map(({ key, hint }) => (
            <span key={key} className="layer-tag" data-tooltip={hint}>
              {t(`layers.tag.${key}`)}
            </span>
          ))}
        </div>
      )}

      {/* Only the active layer shows its options; the others stay collapsed to the header.
          Kept mounted (inert while collapsed) so the height can animate both ways. */}
      <div className={isActive ? "layer-options open" : "layer-options"} inert={!isActive}>
        <div className="layer-options-inner">
          <LayerOptions
            layer={layer}
            processing={Boolean(processing)}
            uploadError={uploadError}
            onOpenSettings={() => setImageDialog(true)}
            onRetry={onRetry}
          />
        </div>
      </div>
      {imageDialog && (
        <LayerImageDialog
          layer={layer}
          frame={frame}
          processing={Boolean(processing)}
          uploadError={uploadError}
          onUpdate={onUpdate}
          onReplace={pickFile}
          onRemoveImage={onRemoveImage}
          onClose={() => {
            setImageDialog(false);
            onImageDialogClose();
          }}
        />
      )}
      <ConfirmDialog open={replacing !== null} danger={false} title={t("layers.replaceTitle", { name: layer.name })} confirmLabel={t("layers.replaceConfirm")} onConfirm={() => replacing && void upload(replacing)} onCancel={() => setReplacing(null)}>
        {t("layers.replaceBody")}
      </ConfirmDialog>
    </li>
  );
}

/** The active layer's thumbnail and status; everything else lives in LayerImageDialog. */
function LayerOptions({
  layer,
  processing,
  uploadError,
  onOpenSettings,
  onRetry,
}: {
  layer: MapLayerData;
  processing: boolean;
  uploadError: string | null;
  onOpenSettings: () => void;
  onRetry: (assetId: string) => void;
}) {
  const t = useT("maps");
  const pending = layer.pendingAsset;
  return (
    <>
      <div className="layer-image">
        {layer.asset ? (
          // eslint-disable-next-line @next/next/no-img-element -- small local thumbnail, not worth next/image's remote-optimization machinery
          <img className="layer-thumb" src={`/api/thumbnails/${layer.asset.id}`} alt="" />
        ) : (
          <div className="layer-thumb layer-thumb-empty">{t("layers.noImage")}</div>
        )}
        <div className="layer-image-actions">
          <button type="button" className="btn btn-sm" onClick={onOpenSettings} data-tooltip={t("layers.settingsHint")}>
            <Settings size={13} strokeWidth={2.25} />
            {t("layers.settings")}
          </button>
        </div>
      </div>
      {processing && <p className="field-label zone-tool-hint">{t("layers.processing")}</p>}
      {pending?.state === "failed" && (
        <p className="form-error layer-error">
          {t("layers.processingFailed")}{" "}
          <button type="button" className="btn btn-sm" onClick={() => onRetry(pending.id)}>
            <RefreshCw size={12} strokeWidth={2.25} />
            {t("layers.retry")}
          </button>
        </p>
      )}
      {uploadError && <p className="form-error layer-error">{uploadError}</p>}
    </>
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
  onImageDialogClose,
  frame,
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
  /** A layer's image settings closed: its placement is final, so the map frame can grow to cover it. */
  onImageDialogClose: () => void;
  /** The map's frame in pixels (what markers, zones and the grid are placed on). */
  frame: Frame;
}) {
  const t = useT("maps");
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
          {t("layers.title")}
        </h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t("layers.close")}>
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>
      <p className="field-label zone-tool-hint">{t("layers.hint")}</p>

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
            frame={frame}
            onImageDialogClose={onImageDialogClose}
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
        {t("layers.create")}
      </button>
    </div>
  );
}
