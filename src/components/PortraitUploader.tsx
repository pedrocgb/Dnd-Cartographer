"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

/**
 * Square image upload/preview pinned to a card's top-right corner (see
 * .politics-portrait in globals.css — the card gets padding-right to make
 * room for it). Reused for a territory's Coat of arms, a person's Image,
 * and an organization's Crest — only the label and API path segment differ.
 */
export default function PortraitUploader({
  ownerPath,
  ownerId,
  portraitKey,
  updatedAt,
  label,
  onChanged,
}: {
  /** API path segment for this owner type: "territories" | "people" | "organizations". */
  ownerPath: "territories" | "people" | "organizations";
  ownerId: string;
  portraitKey: string | null;
  updatedAt: string | Date;
  label: string;
  onChanged: (portraitKey: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`/api/politics/${ownerPath}/${ownerId}/portrait`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not upload image.");
        return;
      }
      const updated = data.territory ?? data.person ?? data.organization;
      onChanged(updated.portraitKey);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`/api/politics/${ownerPath}/${ownerId}/portrait`, { method: "DELETE" });
      if (res.ok) onChanged(null);
    } finally {
      setUploading(false);
    }
  }

  const src = portraitKey ? `/api/politics/portraits/${portraitKey}?v=${encodeURIComponent(new Date(updatedAt).getTime())}` : null;

  return (
    <div className="politics-portrait">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      <div
        className="politics-portrait-frame"
        onClick={() => inputRef.current?.click()}
        title={src ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- small local portrait, not worth next/image's remote-optimization machinery
          <img src={src} alt={label} />
        ) : (
          <div className="politics-portrait-placeholder">
            <ImagePlus size={28} strokeWidth={2} />
            <span>{uploading ? "Uploading…" : label}</span>
          </div>
        )}
        {src && (
          <button
            type="button"
            className="politics-portrait-remove"
            onClick={remove}
            aria-label={`Remove ${label.toLowerCase()}`}
            title={`Remove ${label.toLowerCase()}`}
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>
      {error && <p className="form-error" style={{ fontSize: "0.625rem" }}>{error}</p>}
    </div>
  );
}
