"use client";

import { useEffect, useRef, useState } from "react";
import { Crop, ImagePlus, Trash2 } from "lucide-react";
import ImageCropDialog from "./ImageCropDialog";
import Modal from "./Modal";
import { PORTRAIT_TYPES, portraitFileError, type PortraitCrop } from "@/server/assets/portrait-crop";

const portraitUrl = (key: string, version: string | number) => `/api/politics/portraits/${key}?v=${encodeURIComponent(version)}`;

/** What the crop dialog is working on: a freshly picked file, or the kept original of the current image. */
type Cropping = { kind: "new"; file: File; src: string } | { kind: "adjust"; src: string; initial: PortraitCrop | null };

/**
 * Square image upload/preview (see .politics-portrait in globals.css).
 * Reused for every article's image — a territory's Coat of arms, a
 * character's Image, an organization's Crest, a generic article's Image —
 * only the label and the portrait endpoint differ.
 *
 * Empty: clicking, dropping or pasting an image opens the crop dialog to
 * choose what the square shows. With an image: clicking shows the full
 * original in a viewer, "Adjust" reopens the crop dialog, and a new image
 * needs "Remove" first.
 */
export default function PortraitUploader({
  endpoint,
  portraitKey,
  updatedAt,
  label,
  onChanged,
}: {
  /** The owner's portrait route (GET source, POST upload, PUT re-crop, DELETE remove), e.g. `/api/articles/<id>/portrait`. */
  endpoint: string;
  portraitKey: string | null;
  updatedAt: string | Date;
  label: string;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropping, setCropping] = useState<Cropping | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  /** The full image shown in the viewer, when open. */
  const [viewing, setViewing] = useState<string | null>(null);
  const lower = label.toLowerCase();

  // A picked file is shown through an object URL; free it once the dialog closes.
  const objectUrl = cropping?.kind === "new" ? cropping.src : null;
  useEffect(() => (objectUrl ? () => URL.revokeObjectURL(objectUrl) : undefined), [objectUrl]);

  function pickFile(file: File | undefined) {
    if (!file) return;
    const problem = portraitFileError(file);
    setError(problem);
    if (problem) return;
    setDialogError(null);
    setCropping({ kind: "new", file, src: URL.createObjectURL(file) });
  }

  /** The kept original (or, for older uploads, the portrait itself) and its last crop. */
  async function loadSource(failure: string): Promise<{ src: string; crop: PortraitCrop | null } | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint);
      const data: { sourceKey: string | null; crop: PortraitCrop | null } = await res.json();
      if (res.ok && data.sourceKey) return { src: portraitUrl(data.sourceKey, Date.now()), crop: data.crop };
    } catch {
      // reported below
    } finally {
      setBusy(false);
    }
    setError(failure);
    return null;
  }

  async function startAdjusting() {
    const source = await loadSource("Could not load the image to adjust.");
    if (!source) return;
    setDialogError(null);
    setCropping({ kind: "adjust", src: source.src, initial: source.crop });
  }

  async function startViewing() {
    const source = await loadSource("Could not load the full image.");
    if (source) setViewing(source.src);
  }

  async function save(crop: PortraitCrop) {
    if (!cropping) return;
    setSaving(true);
    setDialogError(null);
    try {
      const res =
        cropping.kind === "new"
          ? await fetch(`${endpoint}?crop=${encodeURIComponent(JSON.stringify(crop))}`, {
              method: "POST",
              headers: { "Content-Type": cropping.file.type || "application/octet-stream" },
              body: cropping.file,
            })
          : await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crop }) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDialogError(data.error ?? "Could not save the image.");
        return;
      }
      setCropping(null);
      onChanged();
    } catch {
      setDialogError("Could not reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok) onChanged();
      else setError(`Could not remove the ${lower}.`);
    } finally {
      setBusy(false);
    }
  }

  const src = portraitKey ? portraitUrl(portraitKey, new Date(updatedAt).getTime()) : null;
  // With an image, the frame opens the viewer; uploading a new one needs Remove first.
  const activate = () => {
    if (busy) return;
    if (src) void startViewing();
    else inputRef.current?.click();
  };
  const acceptsFiles = !src;

  return (
    <div className="politics-portrait">
      <input
        ref={inputRef}
        type="file"
        accept={PORTRAIT_TYPES.join(",")}
        style={{ display: "none" }}
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div
        className={["politics-portrait-frame", src && "has-image", dragging && "dragging"].filter(Boolean).join(" ")}
        role="button"
        tabIndex={0}
        aria-label={src ? `View the full ${lower}` : `Upload ${lower} (or drop / paste an image)`}
        title={src ? `View the full ${lower}` : `Upload ${lower} — click, drop or paste an image`}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            activate();
          }
        }}
        onPaste={(e) => {
          if (!acceptsFiles) return;
          const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
          if (file) {
            e.preventDefault();
            pickFile(file);
          }
        }}
        onDragOver={(e) => {
          if (!acceptsFiles || ![...e.dataTransfer.types].includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (!acceptsFiles) return;
          e.preventDefault();
          setDragging(false);
          pickFile(e.dataTransfer.files[0]);
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- small local portrait, not worth next/image's remote-optimization machinery
          <img src={src} alt={label} />
        ) : (
          <div className="politics-portrait-placeholder">
            <ImagePlus size={28} strokeWidth={2} />
            <span>{label}</span>
            <span className="politics-portrait-drop-hint">Click, drop or paste</span>
          </div>
        )}
        {dragging && <div className="politics-portrait-drop">Drop to upload</div>}
      </div>
      {src && (
        <div className="politics-portrait-actions">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => void startAdjusting()}
            disabled={busy}
            title={`Adjust ${lower} — reposition, zoom or rotate`}
          >
            <Crop size={13} strokeWidth={2.25} />
            Adjust
          </button>
          <button type="button" className="btn btn-sm btn-ghost politics-portrait-remove" onClick={remove} disabled={busy} title={`Remove ${lower}`}>
            <Trash2 size={13} strokeWidth={2.25} />
            Remove
          </button>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={label} size="wide">
          {/* eslint-disable-next-line @next/next/no-img-element -- local original, shown as-is */}
          <img className="portrait-viewer-image" src={viewing} alt={label} />
        </Modal>
      )}
      {cropping && (
        <ImageCropDialog
          key={cropping.src}
          src={cropping.src}
          title={cropping.kind === "new" ? `Position the ${lower}` : `Adjust the ${lower}`}
          initial={cropping.kind === "adjust" ? cropping.initial : null}
          confirmLabel={cropping.kind === "new" ? `Upload ${lower}` : "Save"}
          busy={saving}
          error={dialogError}
          onConfirm={save}
          onCancel={() => setCropping(null)}
        />
      )}
    </div>
  );
}
