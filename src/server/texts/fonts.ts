/**
 * Font keys the map Text tool accepts. `cssVar` is the variable declared by
 * src/app/map-fonts.ts (next/font, self-hosted); `fallback` is the generic
 * family used while it loads.
 */
export const MAP_FONTS = [
  { key: "inter", label: "Inter", cssVar: "--map-font-inter", fallback: "sans-serif" },
  { key: "open-sans", label: "Open Sans", cssVar: "--map-font-open-sans", fallback: "sans-serif" },
  { key: "lato", label: "Lato", cssVar: "--map-font-lato", fallback: "sans-serif" },
  { key: "noto-sans", label: "Noto Sans", cssVar: "--map-font-noto-sans", fallback: "sans-serif" },
  { key: "source-sans", label: "Source Sans 3", cssVar: "--map-font-source-sans", fallback: "sans-serif" },
  { key: "merriweather", label: "Merriweather", cssVar: "--map-font-merriweather", fallback: "serif" },
  { key: "lora", label: "Lora", cssVar: "--map-font-lora", fallback: "serif" },
  { key: "eb-garamond", label: "EB Garamond", cssVar: "--map-font-eb-garamond", fallback: "serif" },
  { key: "crimson-pro", label: "Crimson Pro", cssVar: "--map-font-crimson-pro", fallback: "serif" },
  { key: "cormorant", label: "Cormorant Garamond", cssVar: "--map-font-cormorant", fallback: "serif" },
  { key: "libre-baskerville", label: "Libre Baskerville", cssVar: "--map-font-libre-baskerville", fallback: "serif" },
  { key: "alegreya", label: "Alegreya", cssVar: "--map-font-alegreya", fallback: "serif" },
  { key: "spectral", label: "Spectral", cssVar: "--map-font-spectral", fallback: "serif" },
  { key: "cinzel", label: "Cinzel", cssVar: "--map-font-cinzel", fallback: "serif" },
] as const;

export type MapFontKey = (typeof MAP_FONTS)[number]["key"];

export const DEFAULT_MAP_FONT: MapFontKey = "cinzel";

export function isMapFontKey(value: unknown): value is MapFontKey {
  return typeof value === "string" && MAP_FONTS.some((f) => f.key === value);
}

/** CSS font-family for a font key (unknown keys fall back to the default font). */
export function mapFontFamily(key: string): string {
  const font = MAP_FONTS.find((f) => f.key === key) ?? MAP_FONTS.find((f) => f.key === DEFAULT_MAP_FONT)!;
  return `var(${font.cssVar}), ${font.fallback}`;
}
