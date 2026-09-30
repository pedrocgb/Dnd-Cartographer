/**
 * The text colors the editor offers (no free color wheel). "White" is the
 * default: it clears the color mark, so the text follows the theme's text
 * color. The hexes are tuned to read on the dark card background.
 */
export interface TextColor {
  label: string;
  /** null for the default (no color mark). */
  hex: string | null;
}

export const TEXT_COLORS: readonly TextColor[] = [
  { label: "White", hex: null },
  { label: "Gray", hex: "#9CA3AF" },
  { label: "Brown", hex: "#C8A27A" },
  { label: "Red", hex: "#F87171" },
  { label: "Orange", hex: "#FB923C" },
  { label: "Gold", hex: "#FACC15" },
  { label: "Green", hex: "#4ADE80" },
  { label: "Teal", hex: "#2DD4BF" },
  { label: "Blue", hex: "#60A5FA" },
  { label: "Purple", hex: "#C084FC" },
  { label: "Pink", hex: "#F472B6" },
];

/** Swatch shown for the default color (the theme's primary text). */
export const DEFAULT_SWATCH = "var(--text-primary)";

/** The palette entry matching a stored color (case-insensitive); undefined for a custom one from older documents. */
export function textColorOf(hex: string | null | undefined): TextColor | undefined {
  if (!hex) return TEXT_COLORS[0];
  return TEXT_COLORS.find((c) => c.hex?.toLowerCase() === hex.toLowerCase());
}
