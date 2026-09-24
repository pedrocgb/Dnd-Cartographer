import {
  BookOpen,
  Building,
  ChessQueen,
  Church,
  Cog,
  Dna,
  File,
  FileText,
  HandHelping,
  Landmark,
  Languages,
  Map as MapIcon,
  MapPinned,
  Scale,
  Shield,
  Sword,
  Swords,
  UserRound,
  UserRoundGroup,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { ARTICLE_TEMPLATE_KEYS, TEMPLATE_LABELS, type ArticleTemplateKey } from "@/server/articles/templates";

export interface ArticleTemplate {
  key: ArticleTemplateKey;
  /** Singular name — also the article's fixed tag. */
  label: string;
  /** Sidebar folder name. */
  plural: string;
  Icon: LucideIcon;
  description: string;
}

const DETAILS: Record<ArticleTemplateKey, Omit<ArticleTemplate, "key" | "label">> = {
  generic: {
    plural: "Generic",
    Icon: FileText,
    description: "A blank page for anything that doesn't fit elsewhere: lore notes, session recaps, loose ideas.",
  },
  character: {
    plural: "Characters",
    Icon: UserRound,
    description: "Heroes, villains, rulers and wandering bards. Track their house, status and the seats they hold.",
  },
  organization: {
    plural: "Organizations",
    Icon: UserRoundGroup,
    description: "Noble houses, guilds, councils and secret orders, and the people who swear by them.",
  },
  territory: {
    plural: "Territories",
    Icon: MapPinned,
    description: "Empires, kingdoms, duchies and marches, arranged into the hierarchy that rules your world.",
  },
  settlement: {
    plural: "Settlements",
    Icon: Landmark,
    description: "Cities, towns, villages and outposts: who lives there, what they trade, what they fear.",
  },
  building: {
    plural: "Buildings",
    Icon: Building,
    description: "Castles, taverns, temples and ruins worth a detailed floor plan and a whispered rumor.",
  },
  geography: {
    plural: "Geography",
    Icon: MapIcon,
    description: "Mountains, rivers, forests and seas: the land itself, its dangers and its secrets.",
  },
  military: {
    plural: "Military",
    Icon: Shield,
    description: "Armies, fleets, legions and warbands: who commands them, how they fight, and where they march.",
  },
  conflict: {
    plural: "Conflicts",
    Icon: Swords,
    description: "Wars, sieges, rebellions and feuds: their causes, their battles and the scars they leave.",
  },
  technology: {
    plural: "Technology",
    Icon: Cog,
    description: "Machines, techniques and inventions, how they work, and who would kill to control them.",
  },
  title: {
    plural: "Titles",
    Icon: ChessQueen,
    description: "Crowns, ranks and honors: how they are earned, inherited, and stolen.",
  },
  law: {
    plural: "Laws",
    Icon: Scale,
    description: "Edicts, codes and customs of justice, and the price of breaking them.",
  },
  tradition: {
    plural: "Traditions",
    Icon: HandHelping,
    description: "Festivals, rites of passage and old habits that bind a people together.",
  },
  culture: {
    plural: "Culture",
    Icon: BookOpen,
    description: "Art, language, cuisine and values: what makes a people who they are.",
  },
  species: {
    plural: "Species",
    Icon: Dna,
    description: "Peoples, beasts and monsters: their origins, their nature, and how to survive them.",
  },
  religion: {
    plural: "Religion",
    Icon: Church,
    description: "Gods, pantheons, cults and faiths, with their tenets, clergy and holy sites.",
  },
  item: {
    plural: "Items",
    Icon: Sword,
    description: "Legendary blades, cursed relics and humble heirlooms with a story to tell.",
  },
  magic: {
    plural: "Magic & Spells",
    Icon: WandSparkles,
    description: "Spells, rituals, schools and traditions of magic: how they're cast, and what they cost.",
  },
  document: {
    plural: "Document",
    Icon: File,
    description: "Letters, prophecies, treaties and in-world texts your players can find and read.",
  },
  language: {
    plural: "Languages",
    Icon: Languages,
    description: "Tongues, dialects, scripts and secret cants: who speaks them, and what they unlock.",
  },
};

/** Every template, in sidebar and "Create new article" order. */
export const ARTICLE_TEMPLATES: ArticleTemplate[] = ARTICLE_TEMPLATE_KEYS.map((key) => ({
  key,
  label: TEMPLATE_LABELS[key],
  ...DETAILS[key],
}));

export function templateOf(key: ArticleTemplateKey): ArticleTemplate {
  return ARTICLE_TEMPLATES.find((t) => t.key === key)!;
}
