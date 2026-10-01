import { activeSettings } from "./active";
import type { NumberFormat } from "./settings";

/** Thousands and decimal separators of each format (a no-break space so a number never wraps). */
const SEPARATORS: Record<NumberFormat, { group: string; decimal: string }> = {
  comma: { group: ",", decimal: "." },
  point: { group: ".", decimal: "," },
  space: { group: " ", decimal: "," },
};

export interface NumberOptions {
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  /** Thousands separators (default on). */
  grouping?: boolean;
  /** Defaults to the user's setting. */
  format?: NumberFormat;
}

/**
 * A number the app writes (an area, a total, a count) in the user's number
 * format. Never for what the user typed: that stays as written.
 */
export function formatDecimal(value: number, { maximumFractionDigits = 2, minimumFractionDigits = 0, grouping = true, format = activeSettings().numberFormat }: NumberOptions = {}): string {
  const { group, decimal } = SEPARATORS[format];
  const min = Math.min(minimumFractionDigits, maximumFractionDigits);
  const en = value.toLocaleString("en-US", { maximumFractionDigits, minimumFractionDigits: min, useGrouping: grouping });
  // en-US writes "," then "."; swap through a placeholder so the two never collide.
  return en.replace(/,/g, "\u0000").replace(/\./g, decimal).replace(/\u0000/g, group);
}

/** A whole number in the user's format ("12,000 XP"). */
export const formatInteger = (value: number, format?: NumberFormat) => formatDecimal(Math.round(value), { maximumFractionDigits: 0, format });
