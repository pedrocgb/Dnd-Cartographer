"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CirclePlus, GitFork, LayoutDashboard, Network, Waypoints } from "lucide-react";
import { ancestorsOf } from "@/components/TerritoryTree";
import {
  ARTICLE_TEMPLATE_KEYS,
  isArticleTemplate,
  isPersonTemplate,
  personTemplate,
  type ArticleTemplateKey,
  type GenericTemplateKey,
} from "@/server/articles/templates";
import { emptyRequiredInfo } from "@/server/articles/info-fields";
import { INFO_FIELD_SETS } from "@/server/articles/info-sets";
import { templateOf } from "./templates";
import { json, toggleInSet } from "./shared";
import ArticlesSidebar, { type ArticleLists } from "./ArticlesSidebar";
import CreateArticleModal from "./CreateArticleModal";
import GenericArticle from "./GenericArticle";
import HierarchyProfiles from "./HierarchyProfiles";
import { TerritoryArticle, TerritoryForm } from "./TerritoryArticle";
import { CharacterArticle, PersonForm } from "./CharacterArticle";
import { InfoForm, type InfoLookups } from "./InfoBar";
import { CreateArticleContext } from "./create-context";
import { OrganizationArticle, OrganizationForm } from "./OrganizationArticle";
import { loadSeasonProfileLookup } from "@/components/calendars/profile-lookup";
import { ArticleSkeleton } from "@/components/Skeleton";
import { RelationsContext, type Relation, type RelationsState, type ServerDerived } from "@/components/relations/relations-context";
import { buildCatalog, derivedEdges } from "@/server/relations/graph";
import RelationsPage from "@/components/relations/RelationsPage";
import FamilyTreePage from "@/components/relations/FamilyTreePage";
import BoardsPage from "@/components/relations/BoardsPage";
import type { GenericArticle as GenericArticleData, HierarchyProfile, Organization, Person, Territory } from "./types";

/** What the middle pane shows. */
type View =
  | { kind: "template"; template: ArticleTemplateKey }
  | { kind: "article"; template: ArticleTemplateKey; id: string }
  | { kind: "profiles"; id: string | null }
  | { kind: "relationships"; focus: string | null }
  | { kind: "family"; id: string | null; bloodline: boolean }
  | { kind: "boards"; id: string | null };

/** Views that aren't an article folder (their sidebar entries are pinned tools). */
const isToolView = (view: View): view is Exclude<View, { kind: "template" | "article" }> => view.kind !== "template" && view.kind !== "article";

/** `?type=&id=`; also accepts the old /politics keys (person, profile). */
function viewFromParams(params: URLSearchParams): View {
  const raw = params.get("type");
  const id = params.get("id");
  const type = raw === "person" ? "character" : raw;
  if (type === "profile" || type === "profiles") return { kind: "profiles", id };
  if (type === "relationships") return { kind: "relationships", focus: params.get("focus") };
  if (type === "family") return { kind: "family", id, bloodline: params.get("mode") === "bloodline" };
  if (type === "boards") return { kind: "boards", id };
  if (isArticleTemplate(type)) return id ? { kind: "article", template: type, id } : { kind: "template", template: type };
  return { kind: "template", template: "generic" };
}

function urlOf(view: View): string {
  const params = new URLSearchParams();
  if (view.kind === "profiles" || view.kind === "boards") {
    params.set("type", view.kind);
    if (view.id) params.set("id", view.id);
  } else if (view.kind === "relationships") {
    params.set("type", "relationships");
    if (view.focus) params.set("focus", view.focus);
  } else if (view.kind === "family") {
    params.set("type", "family");
    if (view.id) params.set("id", view.id);
    if (view.bloodline) params.set("mode", "bloodline");
  } else {
    params.set("type", view.template);
    if (view.kind === "article") params.set("id", view.id);
  }
  return `/articles?${params}`;
}

const OPEN_FOLDERS_KEY = "articles-open-folders";

/*
 * The remembered open folders are read through useSyncExternalStore: the
 * server (and hydration) render sees none, then React re-renders with the
 * stored value. Reading localStorage in a useState initializer instead makes
 * the first client render differ from the server HTML (hydration error).
 */
function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readStoredOpenFolders(): string | null {
  try {
    return window.localStorage.getItem(OPEN_FOLDERS_KEY);
  } catch {
    return null; // storage unavailable: start collapsed
  }
}

function parseOpenFolders(raw: string | null): Set<ArticleTemplateKey> {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) return new Set(ARTICLE_TEMPLATE_KEYS.filter((k) => parsed.includes(k)));
  } catch {
    // corrupt: start collapsed
  }
  return new Set();
}

function saveOpenFolders(open: Set<ArticleTemplateKey>) {
  try {
    window.localStorage.setItem(OPEN_FOLDERS_KEY, JSON.stringify([...open]));
  } catch {
    // storage unavailable: the choice just isn't remembered
  }
}

const EMPTY_LISTS: ArticleLists = { territories: [], people: [], organizations: [], articles: [] };

export default function ArticlesManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [requestedView, setView] = useState<View>(() => viewFromParams(searchParams));
  // A link to another view (the top bar's Articles menu) changes only the address: follow it.
  const search = searchParams.toString();
  const [lastSearch, setLastSearch] = useState(search);
  if (search !== lastSearch) {
    setLastSearch(search);
    const linked = viewFromParams(searchParams);
    if (JSON.stringify(linked) !== JSON.stringify(requestedView)) setView(linked);
  }
  const [lists, setLists] = useState<ArticleLists>(EMPTY_LISTS);
  const [loaded, setLoaded] = useState(false);
  const [profiles, setProfiles] = useState<HierarchyProfile[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  // Calendars season profiles, for the Season Profile info field (with each one's current season).
  const [seasonProfiles, setSeasonProfiles] = useState<{ id: string; name: string; detail: string }[]>([]);
  const [relationData, setRelationData] = useState<{ relations: Relation[]; derived: ServerDerived[] }>({ relations: [], derived: [] });
  const [query, setQuery] = useState("");
  const storedOpenFolders = useSyncExternalStore(subscribeToStorage, readStoredOpenFolders, () => null);
  // Null until the user (or a deep link) changes which folders are open.
  const [changedOpenFolders, setOpenFolders] = useState<Set<ArticleTemplateKey> | null>(null);
  const openFolders = useMemo(() => changedOpenFolders ?? parseOpenFolders(storedOpenFolders), [changedOpenFolders, storedOpenFolders]);
  const [territoryExpanded, setTerritoryExpanded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<{ template: ArticleTemplateKey | null } | null>(null);
  // Characters and player characters share one table: an older link (or one saved before a
  // character became a player character) opens under the template its record has now.
  const view = useMemo<View>(() => {
    if (requestedView.kind !== "article" || !isPersonTemplate(requestedView.template)) return requestedView;
    const person = lists.people.find((p) => p.id === requestedView.id);
    return person ? { ...requestedView, template: personTemplate(person.kind) } : requestedView;
  }, [requestedView, lists.people]);

  const refreshLists = useCallback(() => {
    return Promise.all([
      fetch("/api/politics/territories").then((r) => json<{ territories: Territory[] }>(r)),
      fetch("/api/politics/people").then((r) => json<{ people: Person[] }>(r)),
      fetch("/api/politics/organizations").then((r) => json<{ organizations: Organization[] }>(r)),
      fetch("/api/articles").then((r) => json<{ articles: GenericArticleData[] }>(r)),
      fetch("/api/articles/tags").then((r) => json<{ tags: string[] }>(r)),
      loadSeasonProfileLookup().catch(() => []),
      fetch("/api/relations").then((r) => json<{ relations: Relation[]; derived: ServerDerived[] }>(r)),
    ]).then(([t, p, o, a, tags, seasonProfiles, rel]) => {
      setLists({ territories: t.territories, people: p.people, organizations: o.organizations, articles: a.articles });
      setRelationData(rel);
      setSeasonProfiles(seasonProfiles);
      setTagSuggestions(tags.tags);
      setLoaded(true);
    });
  }, []);

  const refreshProfiles = useCallback(() => {
    fetch("/api/politics/hierarchy-profiles")
      .then((r) => json<{ profiles: HierarchyProfile[] }>(r))
      .then((d) => setProfiles(d.profiles));
  }, []);

  useEffect(() => {
    void refreshLists();
    refreshProfiles();
  }, [refreshLists, refreshProfiles]);

  function go(next: View) {
    setView(next);
    router.replace(urlOf(next), { scroll: false });
  }

  function openFolder(template: ArticleTemplateKey, { persist = true } = {}) {
    if (openFolders.has(template)) return;
    const next = new Set(openFolders).add(template);
    setOpenFolders(next);
    if (persist) saveOpenFolders(next);
  }

  /** Makes an article visible in the sidebar: its folder opens, and a territory's ancestors expand. */
  function reveal(template: ArticleTemplateKey, id: string, { persist = true } = {}) {
    openFolder(template, { persist });
    if (template !== "territory") return;
    const territory = lists.territories.find((t) => t.id === id);
    if (!territory) return;
    const ancestorIds = ancestorsOf(territory, lists.territories).map((a) => a.id);
    setTerritoryExpanded((prev) => new Set([...prev, ...ancestorIds]));
  }

  // A deep link (?type=&id=) is revealed once the lists first arrive
  // (render-time adjustment; nothing is persisted from here).
  const [revealedDeepLink, setRevealedDeepLink] = useState(false);
  if (loaded && !revealedDeepLink) {
    setRevealedDeepLink(true);
    if (view.kind === "article") reveal(view.template, view.id, { persist: false });
  }

  function toggleFolder(template: ArticleTemplateKey) {
    const next = new Set(openFolders);
    if (next.has(template)) {
      next.delete(template);
    } else {
      next.add(template);
      // Opening a folder shows its "Create a new X" page unless one of its articles is already open.
      if (!(view.kind === "article" && view.template === template)) go({ kind: "template", template });
    }
    setOpenFolders(next);
    saveOpenFolders(next);
  }

  function openArticle(requested: ArticleTemplateKey, id: string) {
    const person = isPersonTemplate(requested) ? lists.people.find((p) => p.id === id) : undefined;
    const template = person ? personTemplate(person.kind) : requested;
    reveal(template, id);
    go({ kind: "article", template, id });
  }

  function toggleTerritory(id: string) {
    setTerritoryExpanded((prev) => toggleInSet(prev, id));
  }

  async function createGeneric(template: GenericTemplateKey, title: string): Promise<string | null> {
    const res = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template, title }),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "Could not create the article.";
    await refreshLists();
    setCreating(null);
    openArticle(template, data.article.id);
    return null;
  }

  /** An article was just saved from its create form (in the create modal). */
  function recordCreated(template: ArticleTemplateKey, id: string) {
    setCreating(null);
    void refreshLists().then(() => openArticle(template, id));
  }

  // What a character's link info fields can point at.
  const infoLookups = useMemo<InfoLookups>(() => {
    const lookups: InfoLookups = {
      character: lists.people.filter((p) => p.kind !== "player"),
      playerCharacter: lists.people.filter((p) => p.kind === "player"),
      organization: lists.organizations, territory: lists.territories, seasonProfile: seasonProfiles };
    for (const a of lists.articles) (lookups[a.template] ??= []).push({ id: a.id, name: a.title });
    return lookups;
  }, [lists, seasonProfiles]);

  // Every live record (template, name, house color), for relation-backed Info Bar fields and graphs.
  const catalog = useMemo(() => buildCatalog(lists), [lists]);
  const derivedRelationEdges = useMemo(() => derivedEdges(catalog, relationData.derived, lists), [catalog, relationData.derived, lists]);


  const activeTemplate = isToolView(view) ? null : view.template;
  const tools = [
    { key: "relationships", label: "Relationships", Icon: Waypoints, active: view.kind === "relationships", onOpen: () => go({ kind: "relationships", focus: null }) },
    { key: "family", label: "Family trees", Icon: GitFork, active: view.kind === "family", onOpen: () => go({ kind: "family", id: null, bloodline: false }) },
    { key: "boards", label: "Boards", Icon: LayoutDashboard, active: view.kind === "boards", onOpen: () => go({ kind: "boards", id: null }) },
    { key: "profiles", label: "Hierarchy profiles", Icon: Network, active: view.kind === "profiles", onOpen: () => go({ kind: "profiles", id: null }) },
  ];
  const refresh = () => void refreshLists();
  const relationsState: RelationsState = {
    relations: relationData.relations,
    derived: derivedRelationEdges,
    catalog,
    templateOf: (id) => catalog.get(id)?.template ?? null,
    lookups: infoLookups,
    openArticle,
    openWeb: (focus) => go({ kind: "relationships", focus }),
    openFamily: (id) => go({ kind: "family", id, bloodline: false }),
    refresh,
  };
  const deleted = (template: ArticleTemplateKey) => () => {
    go({ kind: "template", template });
    void refreshLists();
  };

  // "Add new X" on an article opens the chooser preset to X, like the folder's landing page.
  const openCreate = useCallback((template: ArticleTemplateKey) => setCreating({ template }), []);

  function renderArticle(template: ArticleTemplateKey, id: string) {
    const common = { tagSuggestions, lookups: infoLookups, onOpenArticle: openArticle, onChanged: refresh, onDeleted: deleted(template) };
    if (template === "territory") {
      const territory = lists.territories.find((t) => t.id === id);
      return (
        territory && (
          <TerritoryArticle
            key={id}
            territory={territory}
            profiles={profiles}
            territories={lists.territories}
            {...common}
          />
        )
      );
    }
    if (isPersonTemplate(template)) {
      const person = lists.people.find((p) => p.id === id);
      return person && <CharacterArticle key={id} person={person} {...common} />;
    }
    if (template === "organization") {
      const organization = lists.organizations.find((o) => o.id === id);
      return organization && <OrganizationArticle key={id} organization={organization} {...common} />;
    }
    const article = lists.articles.find((a) => a.id === id && a.template === template);
    return article && <GenericArticle key={id} article={article} {...common} />;
  }

  /** A template's create form, shown in the create modal: name plus its required fields. */
  function renderCreateForm(template: ArticleTemplateKey, onBack: () => void) {
    const close = () => setCreating(null);
    if (template === "territory") {
      return <TerritoryForm profiles={profiles} territories={lists.territories} onSaved={(t) => recordCreated("territory", t.id)} onCancel={close} onBack={onBack} />;
    }
    if (isPersonTemplate(template)) {
      return <PersonForm kind={template === "playerCharacter" ? "player" : "npc"} onSaved={(p) => recordCreated(template, p.id)} onCancel={close} onBack={onBack} />;
    }
    if (template === "organization") return <OrganizationForm onSaved={(o) => recordCreated("organization", o.id)} onCancel={close} onBack={onBack} />;
    return renderGenericCreateForm(template, close, onBack);
  }

  /** Title plus the template's required info fields (in their set order); nothing else until created. */
  function renderGenericCreateForm(template: GenericTemplateKey, cancel: () => void, onBack: () => void) {
    const set = INFO_FIELD_SETS[template];
    if (!set) return null;
    return (
      <InfoForm
        key={template}
        set={set}
        name=""
        initialValues={emptyRequiredInfo(set)}
        lookups={infoLookups}
        allowAdding={false}
        saveLabel="Create"
        savingLabel="Creating…"
        onSave={(title, info) =>
          fetch("/api/articles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template, title, info }) })
        }
        onSaved={async (res) => recordCreated(template, (await res.json()).article.id)}
        onCancel={cancel}
        onBack={onBack}
      />
    );
  }

  function renderMiddle() {
    if (view.kind === "profiles") {
      return (
        <HierarchyProfiles selectedId={view.id} onSelect={(id) => go({ kind: "profiles", id })} onChanged={refreshProfiles} />
      );
    }
    if (view.kind === "relationships") return <RelationsPage focusId={view.focus} onFocus={(focus) => go({ kind: "relationships", focus })} />;
    if (view.kind === "family") return <FamilyTreePage personId={view.id} bloodline={view.bloodline} onChange={(id, bloodline) => go({ kind: "family", id, bloodline })} />;
    if (view.kind === "boards") return <BoardsPage boardId={view.id} onOpenBoard={(id) => go({ kind: "boards", id })} />;
    if (view.kind === "article") {
      const content = renderArticle(view.template, view.id);
      if (content) return content;
      if (!loaded) return <ArticleSkeleton />;
      return <p className="field-label">This article doesn&rsquo;t exist anymore.</p>;
    }
    const { Icon, label, plural, description } = templateOf(view.template);
    return (
      <div className="articles-landing">
        <Icon size={44} strokeWidth={1.5} aria-hidden />
        <h1>{plural}</h1>
        <p>{description}</p>
        <button className="btn btn-primary" onClick={() => setCreating({ template: view.template })}>
          <CirclePlus size={16} strokeWidth={2.25} />
          Create a new {label}
        </button>
      </div>
    );
  }

  return (
    <RelationsContext.Provider value={relationsState}>
    <div className="articles-page">
      <ArticlesSidebar
        lists={lists}
        query={query}
        onQueryChange={setQuery}
        openFolders={openFolders}
        activeTemplate={activeTemplate}
        selectedId={view.kind === "article" ? view.id : null}
        onToggleFolder={toggleFolder}
        onOpenArticle={openArticle}
        onCreate={() => setCreating({ template: null })}
        tools={tools}
        territoryExpanded={territoryExpanded}
        onToggleTerritory={toggleTerritory}
        loading={!loaded}
      />
      <div className={view.kind === "relationships" || view.kind === "family" || view.kind === "boards" ? "articles-main articles-main-tool" : "articles-main"}>
        <CreateArticleContext.Provider value={openCreate}>{renderMiddle()}</CreateArticleContext.Provider>
      </div>
      {creating && (
        <CreateArticleModal
          initialTemplate={creating.template}
          onClose={() => setCreating(null)}
          onCreate={createGeneric}
          renderForm={renderCreateForm}
        />
      )}
    </div>
    </RelationsContext.Provider>
  );
}
