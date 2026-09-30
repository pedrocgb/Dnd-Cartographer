const EXCERPT_LENGTH = 180;

/** The first ~180 characters of a text on one line, cut at a word boundary when one is close. */
export function excerptOf(text: string, max: number = EXCERPT_LENGTH): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
