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
  PawPrint,
  Scale,
  Skull,
  Sprout,
  Shield,
  Sword,
  Swords,
  UserRound,
  UserRoundGroup,
  UserStar,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { ARTICLE_TEMPLATE_KEYS, type ArticleTemplateKey } from "@/server/articles/templates";
import { activeT } from "@/i18n/active";

export interface ArticleTemplate {
  key: ArticleTemplateKey;
  /** Singular name — also the article's fixed tag. In the user's language (worded on read). */
  readonly label: string;
  /** Sidebar folder name. */
  readonly plural: string;
  Icon: LucideIcon;
  readonly description: string;
}

const ICONS: Record<ArticleTemplateKey, LucideIcon> = {
  generic: FileText,
  character: UserRound,
  playerCharacter: UserStar,
  organization: UserRoundGroup,
  territory: MapPinned,
  settlement: Landmark,
  building: Building,
  geography: MapIcon,
  military: Shield,
  conflict: Swords,
  technology: Cog,
  title: ChessQueen,
  law: Scale,
  tradition: HandHelping,
  culture: BookOpen,
  species: Dna,
  fauna: PawPrint,
  flora: Sprout,
  monster: Skull,
  religion: Church,
  item: Sword,
  magic: WandSparkles,
  document: File,
  language: Languages,
};

/** Every template, in sidebar and "Create new article" order. */
export const ARTICLE_TEMPLATES: ArticleTemplate[] = ARTICLE_TEMPLATE_KEYS.map((key) => ({
  key,
  Icon: ICONS[key],
  get label() {
    return activeT("articles")(`template.${key}.label`);
  },
  get plural() {
    return activeT("articles")(`template.${key}.plural`);
  },
  get description() {
    return activeT("articles")(`template.${key}.description`);
  },
}));

export function templateOf(key: ArticleTemplateKey): ArticleTemplate {
  return ARTICLE_TEMPLATES.find((t) => t.key === key)!;
}
