"use client";

import { ChevronDown, ChevronRight, CirclePlus, type LucideIcon } from "lucide-react";
import { ARTICLE_TEMPLATE_GROUPS, personTemplate, type ArticleTemplateKey } from "@/server/articles/templates";
import { ARTICLE_TEMPLATES, templateOf, type ArticleTemplate } from "./templates";
import { PickRow, sortByName } from "./shared";
import { SkeletonList } from "@/components/Skeleton";
import SegmentedControl from "@/components/marker-panel/SegmentedControl";
import { isArticleDrag } from "./article-drag";
import { TerritoryFolder } from "./TerritoryArticle";
import { CharacterFolder } from "./CharacterArticle";
import { OrganizationFolder } from "./OrganizationArticle";
import type { GenericArticle, Organization, OpenArticle, Person, Territory } from "./types";
import { useT } from "@/i18n/useT";
import { organizationKindLabel, territoryTypeLabel } from "@/server/politics/hierarchy-config";

export interface ArticleLists {
  territories: Territory[];
  people: Person[];
  organizations: Organization[];
  articles: GenericArticle[];
}

/** Every article of one template as `{ id, name, detail? }`, for counts and search. */
function itemsOf(key: ArticleTemplateKey, lists: ArticleLists): { id: string; name: string; detail?: string }[] {
  if (key === "territory") return lists.territories.map((t) => ({ id: t.id, name: t.name, detail: territoryTypeLabel(t.type) }));
  if (key === "character" || key === "playerCharacter") return lists.people.filter((p) => personTemplate(p.kind) === key);
  if (key === "organization") return lists.organizations.map((o) => ({ id: o.id, name: o.name, detail: organizationKindLabel(o.kind) }));
  return lists.articles.filter((a) => a.template === key).map((a) => ({ id: a.id, name: a.title }));
}

function FolderContents({
  template,
  lists,
  selectedId,
  onSelect,
  territoryExpanded,
  onToggleTerritory,
}: {
  template: ArticleTemplateKey;
  lists: ArticleLists;
  selectedId: string | null;
  onSelect: (id: string) => void;
  territoryExpanded: Set<string>;
  onToggleTerritory: (id: string) => void;
}) {
  if (template === "territory") {
    return (
      <TerritoryFolder
        territories={lists.territories}
        selectedId={selectedId}
        onSelect={onSelect}
        expanded={territoryExpanded}
        onToggleExpand={onToggleTerritory}
      />
    );
  }
  // Player characters are few: a plain list, no Group by.
  if (template === "character") {
    return (
      <CharacterFolder people={lists.people.filter((p) => personTemplate(p.kind) === template)} houses={lists.organizations} territories={lists.territories} selectedId={selectedId} onSelect={onSelect} />
    );
  }
  if (template === "organization") {
    return <OrganizationFolder organizations={lists.organizations} selectedId={selectedId} onSelect={onSelect} />;
  }
  return (
    <>
      {sortByName(itemsOf(template, lists)).map((item) => (
        <PickRow key={item.id} item={item} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}

function FolderHeader({ template, count, open, active, onToggle }: { template: ArticleTemplate; count: number; open: boolean; active: boolean; onToggle: () => void }) {
  const { Icon, plural } = template;
  return (
    <button type="button" className={active ? "articles-folder active" : "articles-folder"} aria-expanded={open} onClick={onToggle}>
      {open ? <ChevronDown size={13} strokeWidth={2.25} aria-hidden /> : <ChevronRight size={13} strokeWidth={2.25} aria-hidden />}
      <Icon size={16} strokeWidth={2.25} aria-hidden />
      <span className="articles-folder-name">{plural}</span>
      <span className="articles-folder-count">({count})</span>
    </button>
  );
}

export type SidebarTab = "type" | "folders";

const TAB_SEGMENTS = ["type", "folders"] as const;

/**
 * The Articles left bar: "Create new article", the By type / Folders tabs,
 * a search box, then either one folder per template (click to
 * expand/collapse, showing its own grouping) or the user's own folders, and
 * the tool entries (Relationships, Family trees, Boards, Hierarchy profiles)
 * pinned at the bottom. While searching, every
 * folder with a match is shown open as a flat list of matches.
 */
export default function ArticlesSidebar({
  lists,
  query,
  onQueryChange,
  openFolders,
  activeTemplate,
  selectedId,
  onToggleFolder,
  onOpenArticle,
  onCreate,
  tools,
  territoryExpanded,
  onToggleTerritory,
  loading = false,
  tab,
  onTabChange,
  userFolders,
}: {
  /** Which tab shows: articles by template, or the user's folders. */
  tab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  /** The Folders tab's content (tree and New folder). */
  userFolders: React.ReactNode;
  /** The lists haven't arrived yet: folders show as skeleton rows. */
  loading?: boolean;
  lists: ArticleLists;
  query: string;
  onQueryChange: (q: string) => void;
  openFolders: Set<ArticleTemplateKey>;
  /** Template of what the middle pane shows (highlights its folder). */
  activeTemplate: ArticleTemplateKey | null;
  selectedId: string | null;
  onToggleFolder: (template: ArticleTemplateKey) => void;
  onOpenArticle: OpenArticle;
  onCreate: () => void;
  /** Pages beside the article folders, pinned at the bottom. */
  tools: readonly { key: string; label: string; Icon: LucideIcon; active: boolean; onOpen: () => void }[];
  territoryExpanded: Set<string>;
  onToggleTerritory: (id: string) => void;
}) {
  const t = useT("articles");
  const needle = query.trim().toLowerCase();

  function renderFolder(template: ArticleTemplate) {
    const items = itemsOf(template.key, lists);
    // Only folders with articles are listed (plus the one being viewed, e.g. its "Create a new X" page).
    if (items.length === 0 && activeTemplate !== template.key) return null;
    const matches = needle ? sortByName(items.filter((i) => i.name.toLowerCase().includes(needle))) : null;
    if (matches && matches.length === 0) return null;
    const open = matches !== null || openFolders.has(template.key);
    const selected = activeTemplate === template.key ? selectedId : null;
    const select = (id: string) => onOpenArticle(template.key, id);
    return (
      <section key={template.key} className="articles-folder-section">
        <FolderHeader
          template={template}
          count={items.length}
          open={open}
          active={activeTemplate === template.key}
          onToggle={() => onToggleFolder(template.key)}
        />
        {open && (
          <ul className="politics-list politics-tree articles-folder-list">
            {matches
              ? matches.map((item) => (
                  <PickRow key={item.id} item={item} selectedId={selected} onSelect={select}>
                    {item.detail && <span className="field-label"> ({item.detail})</span>}
                  </PickRow>
                ))
              : (
                  <FolderContents
                    template={template.key}
                    lists={lists}
                    selectedId={selected}
                    onSelect={select}
                    territoryExpanded={territoryExpanded}
                    onToggleTerritory={onToggleTerritory}
                  />
                )}
            {!matches && items.length === 0 && <li className="field-label articles-folder-empty">{t("sidebar.empty", { plural: template.plural.toLowerCase() })}</li>}
          </ul>
        )}
      </section>
    );
  }

  return (
    <aside className="articles-sidebar" aria-label={t("sidebar.label")}>
      <button type="button" className="articles-folder articles-create" onClick={onCreate}>
        <CirclePlus size={16} strokeWidth={2.25} aria-hidden />
        <span className="articles-folder-name">{t("sidebar.create")}</span>
      </button>
      {/* Dragging an article over the tabs opens Folders, to drop it on one. */}
      <div className="articles-tabs" onDragEnter={(e) => tab === "type" && isArticleDrag(e) && onTabChange("folders")}>
        <SegmentedControl<SidebarTab> ariaLabel={t("tab.label")} value={tab} segments={TAB_SEGMENTS.map((key) => ({ key, label: t(`tab.${key}`) }))} onChange={onTabChange} />
      </div>
      <input
        type="search"
        placeholder={tab === "folders" ? t("sidebar.searchFolders") : t("sidebar.search")}
        aria-label={tab === "folders" ? t("sidebar.searchFoldersLabel") : t("sidebar.searchLabel")}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />

      {tab === "folders" ? (
        <div className="articles-folders">{loading ? <SkeletonList rows={6} label={t("sidebar.loadingFolders")} /> : userFolders}</div>
      ) : (
      <nav className="articles-folders">
        {loading && <SkeletonList rows={8} label={t("sidebar.loading")} />}
        {!loading && ARTICLE_TEMPLATE_GROUPS.map((group) => {
          // A group with no folder left to show (search) collapses away with its gap.
          const sections = group.map((key) => renderFolder(templateOf(key))).filter(Boolean);
          return (
            sections.length > 0 && (
              <div key={group[0]} className="articles-folder-group">
                {sections}
              </div>
            )
          );
        })}
        {needle && ARTICLE_TEMPLATES.every((t) => !itemsOf(t.key, lists).some((i) => i.name.toLowerCase().includes(needle))) && (
          <p className="field-label">{t("sidebar.noMatch", { query: query.trim() })}</p>
        )}
      </nav>
      )}

      <div className="articles-tools">
        {tools.map(({ key, label, Icon, active, onOpen }) => (
          <button key={key} type="button" className={active ? "articles-folder active" : "articles-folder"} onClick={onOpen}>
            <Icon size={16} strokeWidth={2.25} aria-hidden />
            <span className="articles-folder-name">{label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
