import { activeT } from "@/i18n/active";

const REASONS = {
  "Definition change": "reason.definition",
  "Definition change (named dates kept)": "reason.definitionNamed",
  "Cycle change": "reason.cycle",
  "Schedule change": "reason.schedule",
} as const;

/** A revision's stored reason (the server writes it in English) in the active language; any other text shows as stored. */
export function revisionReason(reason: string): string {
  const t = activeT("calendars");
  if (reason in REASONS) return t(REASONS[reason as keyof typeof REASONS]);
  const restore = /^Before restoring version (\d+)$/.exec(reason);
  return restore ? t("reason.beforeRestore", { version: restore[1] }) : reason;
}
