"use client";

import { createElement } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";
import { ICONS, DEFAULT_ICON_KEY } from "@/server/markers/icon-registry";

type IconComponent = React.ComponentType<LucideProps>;

const iconByKey = new Map(ICONS.map((i) => [i.key, i.lucide]));

function resolveIcon(iconKey: string): IconComponent {
  const lucideName = iconByKey.get(iconKey) ?? iconByKey.get(DEFAULT_ICON_KEY)!;
  return (LucideIcons as unknown as Record<string, IconComponent>)[lucideName];
}

/** The bare glyph, for pickers/lists — no backing, no positioning. */
export function RawIcon({ iconKey, ...props }: { iconKey: string } & LucideProps) {
  return createElement(resolveIcon(iconKey), props);
}

/**
 * The full on-map marker visual: a colored backing shape behind a
 * single-color glyph. The backing shape's border uses the outline color;
 * the glyph itself is only ever the icon color. The box is always the same
 * size regardless of shape (only circle/square/none exist, and both circle
 * and square use the same box — just a different border-radius — so the
 * glyph is centered identically for either), and the glyph is a single,
 * unwrapped, unrotated child of the flex-centered box: no transforms, no
 * per-shape offsets, nothing that could pull it off-center. Shape "none"
 * renders the bare glyph with no backing at all.
 */
export default function MarkerIcon({
  iconKey,
  color,
  backgroundColor,
  outlineColor,
  backgroundShape,
  size = 22,
}: {
  iconKey: string;
  color: string;
  backgroundColor: string;
  outlineColor: string;
  backgroundShape: string;
  size?: number;
}) {
  const icon = createElement(resolveIcon(iconKey), { color, size, strokeWidth: 2.25 });

  if (backgroundShape === "none") {
    return icon;
  }

  const boxSize = size + 12;

  return (
    <div
      className="marker-icon-backing"
      style={{
        width: boxSize,
        height: boxSize,
        background: backgroundColor,
        borderColor: outlineColor,
        borderRadius: backgroundShape === "square" ? "20%" : "50%",
      }}
    >
      {icon}
    </div>
  );
}
