"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CirclePlus } from "lucide-react";
import { ancestorsOf } from "@/components/TerritoryTree";
import {
  ARTICLE_TEMPLATE_KEYS,
  isArticleTemplate,
  type ArticleTemplateKey,
  type GenericTemplateKey,
  type RecordTemplateKey,
} from "@/server/articles/templates";
import { templateOf } from "./templates";
import { json, toggleInSet } from "./shared";
import ArticlesSidebar, { type ArticleLists } from "./ArticlesSidebar";
import CreateArticleModal from "./CreateArticleModal";
import GenericArticle from "./GenericArticle";
import HierarchyProfiles from "./HierarchyProfiles";
import { TerritoryArticle, TerritoryForm } from "./TerritoryArticle";
import { CharacterArticle, PersonForm } from "./CharacterArticle";
import type { InfoLookups } from "./InfoBar";
import { CreateArticleContext } from "./create-context";
import { OrganizationArticle, OrganizationForm } from "./OrganizationArticle";
import type { GenericArticle as GenericArticleData, HierarchyProfile, Organization, Person, Territory } from "./types";

/** What the middle pane shows. */
type View =
  | { kind: "template"; template: ArticleTemplateKey }
  | { kind: "article"; template: ArticleTemplateKey; id: string }
  | { kind: "create-record"; template: RecordTemplateKey }
  | { kind: "profiles"; id: string | null };

/** `?type=&id=`; also accepts the old /politics keys (person, profile). */
function viewFromParams(params: URLSearchParams): View {
  const raw = params.get("type");
  const id = params.get("id");
  const type = raw === "person" ? "character" : raw;
  if (type === "profile" || type === "profiles") return { kind: "profiles", id };
  if (isArticleTemplate(type)) return id ? { kind: "article", template: type, id } : { kind: "template", template: type };
  return { kind: "template", template: "generic" };
}

function urlOf(view: View): string {
  const params = new URLSearchParams();
  if (view.kind === "profiles") {
    params.set("type", "profiles");
    if (view.id) params.set("id", view.id);
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
  const [view, setView] = useState<View>(() => viewFromParams(searchParams));
  const [lists, setLists] = useState<ArticleLists>(EMPTY_LISTS);
  const [loaded, setLoaded] = useState(false);
  const [profiles, setProfiles] = useState<HierarchyProfile[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const storedOpenFolders = useSyncExternalStore(subscribeToStorage, readStoredOpenFolders, () => null);
  // Null until the user (or a deep link) changes which folders are open.
  const [changedOpenFolders, setOpenFolders] = useState<Set<ArticleTemplateKey> | null>(null);
  const openFolders = useMemo(() => changedOpenFolders ?? parseOpenFolders(storedOpenFolders), [changedOpenFolders, storedOpenFolders]);
  const [territoryExpanded, setTerritoryExpanded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<{ template: ArticleTemplateKey | null } | null>(null);

  const refreshLists = useCallback(() => {
    return Promise.all([
      fetch("/api/politics/territories").then((r) => json<{ territories: Territory[] }>(r)),
      fetch("/api/politics/people").then((r) => json<{ people: Person[] }>(r)),
      fetch("/api/politics/organizations").then((r) => json<{ organizations: Organization[] }>(r)),
      fetch("/api/articles").then((r) => json<{ articles: GenericArticleData[] }>(r)),
      fetch("/api/articles/tags").then((r) => json<{ tags: string[] }>(r)),
    ]).then(([t, p, o, a, tags]) => {
      setLists({ territories: t.territories, people: p.people, organizations: o.organizations, articles: a.articles });
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

  function openArticle(template: ArticleTemplateKey, id: string) {
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

  /** A record article was just saved from its create form. */
  function recordCreated(template: RecordTemplateKey, id: string) {
    void refreshLists().then(() => openArticle(template, id));
  }

  // What a character's link info fields can point at.
  const infoLookups = useMemo<InfoLookups>(() => {
    const lookups: InfoLookups = { character: lists.people, organization: lists.organizations, territory: lists.territories };
    for (const a of lists.articles) (lookups[a.template] ??= []).push({ id: a.id, name: a.title });
    return lookups;
  }, [lists]);

  const activeTemplate = view.kind === "profiles" ? null : view.template;
  const refresh = () => void refreshLists();
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
    if (template === "character") {
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

  function renderMiddle() {
    if (view.kind === "profiles") {
      return (
        <HierarchyProfiles selectedId={view.id} onSelect={(id) => go({ kind: "profiles", id })} onChanged={refreshProfiles} />
      );
    }
    if (view.kind === "create-record") {
      const { label } = templateOf(view.template);
      const cancel = () => go({ kind: "template", template: view.template });
      return (
        <div className="articles-create-record">
          <h1>New {label.toLowerCase()}</h1>
          {view.template === "territory" && (
            <TerritoryForm profiles={profiles} territories={lists.territories} onSaved={(t) => recordCreated("territory", t.id)} onCancel={cancel} />
          )}
          {view.template === "character" && <PersonForm onSaved={(p) => recordCreated("character", p.id)} onCancel={cancel} />}
          {view.template === "organization" && <OrganizationForm onSaved={(o) => recordCreated("organization", o.id)} onCancel={cancel} />}
        </div>
      );
    }
    if (view.kind === "article") {
      const content = renderArticle(view.template, view.id);
      if (content) return content;
      if (!loaded) return <p className="field-label">Loading…</p>;
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
        profilesActive={view.kind === "profiles"}
        onOpenProfiles={() => go({ kind: "profiles", id: null })}
        territoryExpanded={territoryExpanded}
        onToggleTerritory={toggleTerritory}
      />
      <div className="articles-main">
        <CreateArticleContext.Provider value={openCreate}>{renderMiddle()}</CreateArticleContext.Provider>
      </div>
      {creating && (
        <CreateArticleModal
          initialTemplate={creating.template}
          onClose={() => setCreating(null)}
          onCreate={createGeneric}
          onStartRecord={(template) => {
            setCreating(null);
            openFolder(template);
            go({ kind: "create-record", template });
          }}
        />
      )}
    </div>
  );
}
