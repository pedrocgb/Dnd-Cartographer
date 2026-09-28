/** −3 red … 0 grey … +3 green; no attitude is a dim grey. */
export function attitudeColor(attitude: number | null): string {
  if (attitude === null) return "#6B7280";
  if (attitude === 0) return "#9CA3AF";
  const t = Math.min(1, Math.abs(attitude) / 3);
  const [r, g, b] = attitude > 0 ? [34, 197, 94] : [239, 68, 68];
  const mix = (c: number) => Math.round(156 + (c - 156) * t);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
