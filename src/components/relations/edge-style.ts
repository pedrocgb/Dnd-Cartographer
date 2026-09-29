/** −3 red … 0 grey … +3 green; no attitude is a dim grey. */
export function attitudeColor(attitude: number | null): string {
  if (attitude === null) return "#6B7280";
  if (attitude === 0) return "#9CA3AF";
  const t = Math.min(1, Math.abs(attitude) / 3);
  const [r, g, b] = attitude > 0 ? [34, 197, 94] : [239, 68, 68];
  const mix = (c: number) => Math.round(156 + (c - 156) * t);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/** A card's accent when it has no house color: one hue per kind of article. */
const TINTS: Record<string, string> = {
  character: "#47bfab",
  playerCharacter: "#d29c53",
  organization: "#6f9fe0",
  territory: "#7fbf6a",
  settlement: "#7fbf6a",
  building: "#7fbf6a",
  geography: "#7fbf6a",
  religion: "#c9a7f0",
  culture: "#c9a7f0",
  tradition: "#c9a7f0",
  species: "#c9a7f0",
};

export const templateTint = (template: string) => TINTS[template] ?? "#8b9199";

export const portraitSrc = (key: string) => `/api/politics/portraits/${key}`;
