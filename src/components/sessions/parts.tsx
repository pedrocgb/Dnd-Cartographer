"use client";

import { inCoins } from "@/server/sessions/totals";
import { PARTY, type Currency } from "@/server/sessions/types";
import { portraitSrc, type RosterMember } from "./types";

/** A PC's round avatar: portrait, else initials. Dimmed when not active. */
export function Avatar({ member, size = 28 }: { member: RosterMember; size?: number }) {
  const name = member.name ?? "?";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={member.status === "active" ? "ss-avatar" : "ss-avatar inactive"} style={{ width: size, height: size }} role="img" aria-label={name} data-tooltip={name}>
      {member.portraitKey ? (
        // eslint-disable-next-line @next/next/no-img-element -- small local portrait, not worth next/image's remote-optimization machinery
        <img src={portraitSrc(member.portraitKey)} alt="" />
      ) : (
        initials
      )}
    </span>
  );
}

/** "12 gp 5 sp" for a per-coin map, largest coin first; "—" when empty. */
export function formatCoins(amounts: Readonly<Record<string, number>>, currencies: readonly Currency[]): string {
  const parts = [...currencies]
    .sort((a, b) => b.value - a.value)
    .filter((c) => amounts[c.id])
    .map((c) => `${amounts[c.id].toLocaleString()} ${c.short}`);
  return parts.length ? parts.join(" ") : "—";
}

/** A smallest-unit total in the fewest coins ("≈ 1 pp 2 gp"). */
export function formatBase(base: number, currencies: readonly Currency[]): string {
  const parts = inCoins(base, currencies).map((c) => `${c.count.toLocaleString()} ${c.currency.short}`);
  return parts.length ? parts.join(" ") : "0";
}

/** Display name of a recipient (a PC or the party stash). */
export function recipientName(id: string, roster: readonly RosterMember[]): string {
  if (id === PARTY) return "Party stash";
  return roster.find((m) => m.personId === id)?.name ?? "(removed character)";
}

export const STATUS_LABELS: Record<RosterMember["status"], string> = { active: "Active", retired: "Retired", dead: "Dead" };
