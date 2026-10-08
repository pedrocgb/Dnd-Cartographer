import type { CoinLine, Currency, LootLine, SessionNotes } from "@/server/sessions/types";
import type { ArticleRef } from "@/components/calendars/types";
import type { QuestLogLine } from "@/server/quests/types";
import type { CampaignSetup, SessionPrep } from "@/server/writer/types";
import { activeT } from "@/i18n/active";

export interface RosterMember {
  /** The roster row id (for PATCH/DELETE). */
  id: string;
  personId: string;
  playerName: string;
  status: "active" | "retired" | "dead";
  /** Null when the Character article was deleted. */
  name: string | null;
  portraitKey: string | null;
}

export interface ClientCampaign {
  id: string;
  name: string;
  description: string;
  calendarId: string;
  currencies: Currency[];
  status: "active" | "finished";
  archived: boolean;
  /** The Campaign Writer's one-page setup. */
  setup: CampaignSetup;
  roster: RosterMember[];
}

export interface ClientSession {
  id: string;
  campaignId: string;
  number: number;
  title: string;
  playedOn: string | null;
  startDay: number | null;
  endDay: number | null;
  recapDocumentId: string | null;
  notes: SessionNotes;
  articleLinks: ArticleRef[];
  attendance: string[];
  xpTotal: number | null;
  xpOverrides: Record<string, number>;
  loot: LootLine[];
  coins: CoinLine[];
  /** What happened to the campaign's quests this session. */
  questLog: QuestLogLine[];
  /** The Lazy DM prep for this session. */
  prep: SessionPrep;
  version: number;
}

/** A session as the calendar and backlinks list it. */
export interface BriefSession {
  id: string;
  campaignId: string;
  campaignName: string;
  number: number;
  title: string;
  startDay: number | null;
  endDay: number | null;
}

/** "/sessions?campaign=…&session=…": opens that session. */
export const sessionHref = (s: { campaignId: string; id: string }) => `/sessions?campaign=${encodeURIComponent(s.campaignId)}&session=${encodeURIComponent(s.id)}`;

/** "Session 3 · The Ambush", in the active language. */
export const sessionLabel = (s: { number: number; title: string }) => (s.title ? activeT("campaign")("session.labelNamed", { n: s.number, title: s.title }) : activeT("campaign")("session.label", { n: s.number }));

export const portraitSrc = (key: string) => `/api/politics/portraits/${key}?v=${encodeURIComponent(key)}`;
