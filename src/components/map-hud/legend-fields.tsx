"use client";

import { useRef, useState } from "react";
import { ImageUp } from "lucide-react";
import { isAcceptedImage, uploadArticleImage } from "@/components/rich-editor/images";
import type { LegendImage } from "@/server/legends/legend-config";
import { LegendSwatch } from "./MapLegend";
import { useT } from "@/i18n/useT";

/** A legend item's settings that need more than a button: shared by the legend bar. */

export type IconImage = Extract<LegendImage, { kind: "icon" }>;

/** Click or drop a PNG/JPEG/WebP; it becomes the item's rectangle, cropped to fill it. */
export function UploadField({ image, onChange }: { image: LegendImage; onChange: (image: LegendImage) => void }) {
  const t = useT("maps");
  const tc = useT("common");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!isAcceptedImage(file)) return setError(tc("imageTypes"));
    setUploading(true);
    setError(null);
    try {
      onChange({ kind: "upload", src: await uploadArticleImage(file) });
    } catch (e) {
      setError(e instanceof Error ? e.message : tc("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={over ? "legend-dropzone over" : "legend-dropzone"}
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void upload(file);
        }}
      >
        {image.kind === "upload" ? <LegendSwatch image={image} size="large" /> : <ImageUp size={22} strokeWidth={1.75} aria-hidden />}
        <span>{uploading ? tc("uploading") : image.kind === "upload" ? t("legend.replaceImage") : t("legend.dropImage")}</span>
        <span className="field-label">{t("legend.imageHint")}</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      {error && <p className="form-error">{error}</p>}
    </>
  );
}
