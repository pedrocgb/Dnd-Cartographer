"use client";

import { createElement } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";
import { ICONS, DEFAULT_ICON_KEY, PIN_ASPECT } from "@/server/markers/icon-registry";

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
 * Backing shapes, drawn in a 36-unit-wide viewBox (the pin is 46 tall; see
 * PIN_ASPECT). `glyphScale` shrinks the glyph for shapes with less room
 * inside, and `glyphCy` is the glyph's vertical center in viewBox units —
 * the pin's round head, the shield's upper body.
 */
const SHAPES: Record<string, { d: string; viewH: number; glyphScale: number; glyphCy: number }> = {
  circle: { d: "M18 1.5a16.5 16.5 0 1 1 0 33a16.5 16.5 0 1 1 0-33z", viewH: 36, glyphScale: 1, glyphCy: 18 },
  square: {
    d: "M8 1.5h20a6.5 6.5 0 0 1 6.5 6.5v20a6.5 6.5 0 0 1-6.5 6.5h-20a6.5 6.5 0 0 1-6.5-6.5v-20a6.5 6.5 0 0 1 6.5-6.5z",
    viewH: 36,
    glyphScale: 1,
    glyphCy: 18,
  },
  diamond: { d: "M18 1.5L34.5 18L18 34.5L1.5 18Z", viewH: 36, glyphScale: 0.74, glyphCy: 18 },
  shield: { d: "M18 1.5L33 6.5V17C33 25.5 26.8 31.8 18 34.5C9.2 31.8 3 25.5 3 17V6.5Z", viewH: 36, glyphScale: 0.84, glyphCy: 16.5 },
  pin: { d: "M18 44.5C13 38.5 2 28.5 2 18A16 16 0 1 1 34 18C34 28.5 23 38.5 18 44.5Z", viewH: 46, glyphScale: 0.92, glyphCy: 18 },
};

/**
 * The full on-map marker visual: a colored backing shape (an SVG path with
 * the outline color as its stroke) behind a single-color glyph. `size` is
 * the glyph size; the backing is `size + 12` wide, and the pin is taller
 * (PIN_ASPECT) with its tip as the anchor — MarkerLayer positions it so.
 * Shape "none" renders the bare glyph, with a halo so it still reads on
 * any map.
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
  const Icon = resolveIcon(iconKey);

  if (backgroundShape === "none") {
    return <span className="marker-icon marker-icon-bare">{createElement(Icon, { color, size, strokeWidth: 2.25 })}</span>;
  }

  const shape = SHAPES[backgroundShape] ?? SHAPES.circle;
  const box = size + 12;
  const height = shape.viewH === 36 ? box : Math.round(box * PIN_ASPECT);

  return (
    <span className="marker-icon" style={{ width: box, height }}>
      <svg className="marker-shape" viewBox={`0 0 36 ${shape.viewH}`} width={box} height={height} aria-hidden="true">
        <path d={shape.d} fill={backgroundColor} stroke={outlineColor} strokeWidth={2} strokeLinejoin="round" />
      </svg>
      <span className="marker-glyph" style={{ top: (shape.glyphCy / shape.viewH) * height }}>
        {createElement(Icon, { color, size: Math.round(size * shape.glyphScale), strokeWidth: 2.25 })}
      </span>
    </span>
  );
}
