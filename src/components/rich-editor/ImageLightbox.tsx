"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { useModalKeyboard } from "@/components/Modal";

export type ZoomedImage = { src: string; alt: string | null; caption: string | null };

/**
 * A reader's click on an image: a linked one opens its link in a new tab,
 * any other one opens full size (`zoom`). False for anything but an image.
 */
export function openReaderImage(node: PMNode, zoom: (image: ZoomedImage) => void): boolean {
  if (node.type.name !== "image") return false;
  if (node.attrs.href) window.open(node.attrs.href, "_blank", "noopener,noreferrer");
  else zoom({ src: node.attrs.src, alt: node.attrs.alt ?? null, caption: node.attrs.caption?.trim() || null });
  return true;
}

/** The whole image over a dimmed page, with its caption. Click anywhere or press Esc to close. */
export default function ImageLightbox({ image, onClose }: { image: ZoomedImage | null; onClose: () => void }) {
  useModalKeyboard(image !== null, onClose);
  if (!image) return null;

  return createPortal(
    <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={image.caption ?? image.alt ?? "Image"} onClick={onClose}>
      <button className="btn btn-ghost btn-icon image-lightbox-close" onClick={onClose} aria-label="Close image" autoFocus>
        <X size={18} strokeWidth={2.25} />
      </button>
      <figure className="image-lightbox-figure">
        {/* eslint-disable-next-line @next/next/no-img-element -- an uploaded article image at its own size, like the editor's <img>. */}
        <img src={image.src} alt={image.alt ?? ""} />
        {image.caption && <figcaption className="image-lightbox-caption">{image.caption}</figcaption>}
      </figure>
    </div>,
    document.body
  );
}
