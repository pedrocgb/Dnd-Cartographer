import type { HierarchyLevel } from "@/server/politics/hierarchy-config";
import type { ArticleTemplateKey, GenericTemplateKey } from "@/server/articles/templates";

/**
 * Record articles (territory / character / organization) as the politics
 * APIs return them: `tags` is the stored JSON text (see parseTags).
 */
interface RecordArticleFields {
  tags: string;
  sidebarDocumentId: string | null;
  footerDocumentId: string | null;
  /** JSON of the added Info Bar fields (see src/server/articles/info-fields.ts). */
  info: string;
}

export interface Territory extends RecordArticleFields {
  id: string;
  name: string;
  type: string;
  descriptionDocumentId: string | null;
  parentId: string | null;
  hierarchyProfileId: string;
  governmentForm: string | null;
  powerHolders: string | null;
  leadershipSelection: string | null;
  autonomy: string | null;
  situation: string | null;
  portraitKey: string | null;
  updatedAt: string;
}

export interface Person extends RecordArticleFields {
  id: string;
  name: string;
  descriptionDocumentId: string | null;
  houseId: string | null;
  portraitKey: string | null;
  status: string | null;
  updatedAt: string;
}

export interface PersonAuthority {
  territoryId: string;
  territoryName: string;
  role: string;
  title: string;
}

export interface Organization extends RecordArticleFields {
  id: string;
  name: string;
  kind: string;
  descriptionDocumentId: string | null;
  portraitKey: string | null;
  updatedAt: string;
}

export interface AffiliatedMarker {
  id: string;
  name: string;
  mapId: string;
  mapName: string;
  viaTerritoryId: string;
  viaTerritoryName: string;
}

export interface HierarchyProfile {
  id: string;
  name: string;
  descriptionDocumentId: string | null;
  levels: HierarchyLevel[];
}

export interface Authority {
  id: string;
  territoryId: string;
  holderType: "person" | "organization";
  holderId: string;
  role: string;
  title: string;
  notes: string;
  /** Resolved server-side; rows arrive sorted root → leaf, then by holder name. */
  holderName: string;
}

/** A generic-template article (GET /api/articles). */
export interface GenericArticle {
  id: string;
  template: GenericTemplateKey;
  title: string;
  tags: string[];
  bodyDocumentId: string | null;
  sidebarDocumentId: string | null;
  footerDocumentId: string | null;
  portraitKey: string | null;
  /** JSON of the added Info Bar fields (see src/server/articles/info-fields.ts). */
  info: string;
  updatedAt: string;
}

/** Opens any article from anywhere on the page (authority holders, breadcrumbs, the sidebar). */
export type OpenArticle = (template: ArticleTemplateKey, id: string) => void;
