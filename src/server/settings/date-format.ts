import { DEFAULT_SETTINGS, type RealDateFormat, type WorldDateFormat } from "./settings";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface DateParts {
  day: number;
  /** 1-based. */
  month: number;
  monthName: string;
  /** Already formatted, e.g. "2026" or "1024 AR". */
  year: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Fills a layout's tokens (YYYY, MMMM, MM, DD, D) in one pass, so a month name's letters are never re-read as tokens. */
export function applyDateFormat(format: RealDateFormat | WorldDateFormat, parts: DateParts): string {
  return format.replace(/YYYY|MMMM|MM|DD|D/g, (token) => {
    switch (token) {
      case "YYYY":
        return parts.year;
      case "MMMM":
        return parts.monthName;
      case "MM":
        return pad(parts.month);
      case "DD":
        return pad(parts.day);
      default:
        return String(parts.day);
    }
  });
}

/**
 * A real-world date in the chosen layout. Takes a Date, a timestamp, or an
 * ISO string; a bare "YYYY-MM-DD" is a calendar day (no timezone shift).
 * `withTime` appends the local 24h time ("14:05").
 */
export function formatRealDate(
  input: Date | number | string | null | undefined,
  format: RealDateFormat = DEFAULT_SETTINGS.realDateFormat,
  { withTime = false } = {},
): string {
  if (input === null || input === undefined || input === "") return "";
  const bare = typeof input === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(input) : null;
  const date = bare ? new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3])) : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const text = applyDateFormat(format, {
    day: date.getDate(),
    month: date.getMonth() + 1,
    monthName: MONTH_NAMES[date.getMonth()],
    year: String(date.getFullYear()),
  });
  return withTime && !bare ? `${text} ${pad(date.getHours())}:${pad(date.getMinutes())}` : text;
}
