"use client";

import { ChevronDown, ChevronRight, CirclePlus, Network } from "lucide-react";
import { ARTICLE_TEMPLATE_GROUPS, type ArticleTemplateKey } from "@/server/articles/templates";
import { ARTICLE_TEMPLATES, templateOf, type ArticleTemplate } from "./templates";
import { PickRow, sortByName } from "./shared";
import { TerritoryFolder } from "./TerritoryArticle";
import { CharacterFolder } from "./CharacterArticle";
import { OrganizationFolder } from "./OrganizationArticle";
import type { GenericArticle, Organization, OpenArticle, Person, Territory } from "./types";

export interface ArticleLists {
  territories: Territory[];
  people: Person[];
  organizations: Organization[];
  articles: GenericArticle[];
}

/** Every article of one template as `{ id, name, detail? }`, for counts and search. */
function itemsOf(key: ArticleTemplateKey, lists: ArticleLists): { id: string; name: string; detail?: string }[] {
  if (key === "territory") return lists.territories.map((t) => ({ id: t.id, name: t.name, detail: t.type }));
  if (key === "character") return lists.people;
  if (key === "organization") return lists.organizations.map((o) => ({ id: o.id, name: o.name, detail: o.kind }));
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
  if (template === "character") {
    return (
      <CharacterFolder people={lists.people} houses={lists.organizations} territories={lists.territories} selectedId={selectedId} onSelect={onSelect} />
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

/**
 * The Articles left bar: "Create new article", a search box, one folder per
 * template (click to expand/collapse, showing its own grouping), and the
 * Hierarchy profiles entry pinned at the bottom. While searching, every
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
  profilesActive,
  onOpenProfiles,
  territoryExpanded,
  onToggleTerritory,
}: {
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
  profilesActive: boolean;
  onOpenProfiles: () => void;
  territoryExpanded: Set<string>;
  onToggleTerritory: (id: string) => void;
}) {
  const needle = query.trim().toLowerCase();

  function renderFolder(template: ArticleTemplate) {
    const items = itemsOf(template.key, lists);
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
            {!matches && items.length === 0 && <li className="field-label articles-folder-empty">No {template.plural.toLowerCase()} yet.</li>}
          </ul>
        )}
      </section>
    );
  }

  return (
    <aside className="articles-sidebar" aria-label="Articles">
      <button type="button" className="articles-folder articles-create" onClick={onCreate}>
        <CirclePlus size={16} strokeWidth={2.25} aria-hidden />
        <span className="articles-folder-name">Create new article</span>
      </button>
      <input type="search" placeholder="Search articles…" aria-label="Search articles" value={query} onChange={(e) => onQueryChange(e.target.value)} />

      <nav className="articles-folders">
        {ARTICLE_TEMPLATE_GROUPS.map((group) => {
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
          <p className="field-label">No articles match &ldquo;{query.trim()}&rdquo;.</p>
        )}
      </nav>

      <button type="button" className={profilesActive ? "articles-folder articles-profiles active" : "articles-folder articles-profiles"} onClick={onOpenProfiles}>
        <Network size={16} strokeWidth={2.25} aria-hidden />
        <span className="articles-folder-name">Hierarchy profiles</span>
      </button>
    </aside>
  );
}
