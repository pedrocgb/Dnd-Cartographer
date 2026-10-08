"use client";

import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Move, RotateCcw, RotateCw, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import Modal from "./Modal";
import type { PortraitCrop, PortraitRotation } from "@/server/assets/portrait-crop";
import { useT } from "@/i18n/useT";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

/**
 * Chooses the part of an image the artboard shows: drag to position,
 * scroll / pinch / slider to zoom, quarter-turn rotation, arrow keys to
 * nudge. The frame is locked to the artboard's `aspect`, and the image
 * always covers it (no empty edges). Mount it only while open — the
 * cropper reads `initial` once.
 */
export default function ImageCropDialog({
  src,
  title,
  aspect = 1,
  initial,
  confirmLabel,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  src: string;
  title: string;
  aspect?: number;
  /** A previously saved crop to reopen at. */
  initial?: PortraitCrop | null;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: (crop: PortraitCrop) => void;
  onCancel: () => void;
}) {
  const t = useT("common");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [rotation, setRotation] = useState<PortraitRotation>(initial?.rotation ?? 0);
  const [area, setArea] = useState<Area | null>(null);

  const rotate = (by: 90 | -90) => setRotation((r) => ((r + by + 360) % 360) as PortraitRotation);
  const zoomBy = (by: number) => setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + by)));

  function reset() {
    setPosition({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);
    setRotation(0);
  }

  return (
    <Modal open onClose={() => !busy && onCancel()} title={title} size="wide">
      <div className="image-crop-stage">
        <Cropper
          image={src}
          crop={position}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          showGrid
          keyboardStep={4}
          initialCroppedAreaPercentages={initial ?? undefined}
          onCropChange={setPosition}
          onZoomChange={setZoom}
          onCropComplete={setArea}
          classes={{ cropAreaClassName: "image-crop-area" }}
        />
      </div>
      <p className="field-label image-crop-hint">
        <Move size={13} strokeWidth={2.25} aria-hidden />
        {t("crop.hint")}
      </p>
      <div className="image-crop-controls">
        <div className="image-crop-zoom">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} aria-label={t("crop.zoomOut")} data-tooltip={t("crop.zoomOut")}>
            <ZoomOut size={15} strokeWidth={2.25} />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            aria-label={t("crop.zoom")}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} aria-label={t("crop.zoomIn")} data-tooltip={t("crop.zoomIn")}>
            <ZoomIn size={15} strokeWidth={2.25} />
          </button>
        </div>
        <div className="image-crop-tools">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => rotate(-90)} aria-label={t("crop.rotateLeft")} data-tooltip={t("crop.rotateLeft")}>
            <RotateCcw size={15} strokeWidth={2.25} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => rotate(90)} aria-label={t("crop.rotateRight")} data-tooltip={t("crop.rotateRight")}>
            <RotateCw size={15} strokeWidth={2.25} />
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={reset} data-tooltip={t("crop.resetHint")}>
            <Undo2 size={13} strokeWidth={2.25} />
            {t("crop.reset")}
          </button>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="confirm-dialog-actions">
        <button type="button" className="btn btn-sm" onClick={onCancel} disabled={busy}>
          {t("cancel")}
        </button>
        <button type="button" className="btn btn-sm btn-primary" disabled={busy || !area} onClick={() => area && onConfirm({ ...area, rotation })}>
          {busy ? t("saving") : (confirmLabel ?? t("crop.save"))}
        </button>
      </div>
    </Modal>
  );
}
