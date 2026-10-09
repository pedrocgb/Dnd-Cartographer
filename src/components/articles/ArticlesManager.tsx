"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CirclePlus, GitFork, Network, Waypoints } from "lucide-react";
import { ancestorsOf } from "@/components/TerritoryTree";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import { parseIdList, readStored, subscribeToStorage, writeStored } from "@/components/stored";
import {
  ARTICLE_TEMPLATE_KEYS,
  isArticleTemplate,
  isPersonTemplate,
  personTemplate,
  type ArticleTemplateKey,
} from "@/server/articles/templates";
import { templateOf } from "./templates";
import { json, toggleInSet } from "./shared";
import ArticlesSidebar, { type SidebarTab } from "./ArticlesSidebar";
import ArticleFoldersTree from "./ArticleFoldersTree";
import ArticleFolderView from "./ArticleFolderView";
import NameDialog from "@/components/maps/NameDialog";
import { MAX_FOLDER_NAME_LENGTH } from "@/server/maps/folders";
import { ArticleFoldersContext, useArticleFolderStore } from "./article-folders";
import { articleCatalog, buildArticleFolderTree, findNode, folderPath } from "./folder-tree";
import CreateArticleFlow, { buildInfoLookups } from "./CreateArticleFlow";
import GenericArticle from "./GenericArticle";
import HierarchyProfiles from "./HierarchyProfiles";
import { TerritoryArticle } from "./TerritoryArticle";
import { CharacterArticle } from "./CharacterArticle";
import { CreateArticleContext } from "./create-context";
import { OrganizationArticle } from "./OrganizationArticle";
import { loadSeasonProfileLookup } from "@/components/calendars/profile-lookup";
import { ArticleSkeleton } from "@/components/Skeleton";
import { RelationsContext, type RelationsState } from "@/components/relations/relations-context";
import { useRelationsData } from "@/components/relations/use-relations-data";
import RelationsPage from "@/components/relations/RelationsPage";
import FamilyTreePage from "@/components/relations/FamilyTreePage";
import type { HierarchyProfile } from "./types";
import { useT } from "@/i18n/useT";

/** What the middle pane shows. */
type View =
  | { kind: "template"; template: ArticleTemplateKey }
  | { kind: "article"; template: ArticleTemplateKey; id: string }
  | { kind: "profiles"; id: string | null }
  | { kind: "relationships"; focus: string | null }
  | { kind: "family"; id: string | null; bloodline: boolean }
  /** One of the user's folders (the sidebar's Folders tab). */
  | { kind: "folder"; id: string };

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
  if (type === "folder" && id) return { kind: "folder", id };
  if (isArticleTemplate(type)) return id ? { kind: "article", template: type, id } : { kind: "template", template: type };
  return { kind: "template", template: "generic" };
}

function urlOf(view: View): string {
  const params = new URLSearchParams();
  if (view.kind === "profiles" || view.kind === "folder") {
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
const SIDEBAR_TAB_KEY = "articles-sidebar-tab";
const OPEN_USER_FOLDERS_KEY = "article-folders-open";

function parseOpenFolders(raw: string | null): Set<ArticleTemplateKey> {
  const ids = parseIdList(raw);
  return new Set(ARTICLE_TEMPLATE_KEYS.filter((k) => ids.has(k)));
}

const saveOpenFolders = (open: Set<ArticleTemplateKey>) => writeStored(OPEN_FOLDERS_KEY, JSON.stringify([...open]));
const readStoredOpenFolders = () => readStored(OPEN_FOLDERS_KEY);
const readStoredTab = () => readStored(SIDEBAR_TAB_KEY);
const readStoredUserFolders = () => readStored(OPEN_USER_FOLDERS_KEY);

export default function ArticlesManager() {
  const t = useT("articles");
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
  const { lists, relations, catalog, derived: derivedRelationEdges, loaded, refresh: refreshRelationsData } = useRelationsData();
  const [profiles, setProfiles] = useState<HierarchyProfile[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  // Calendars season profiles, for the Season Profile info field (with each one's current season).
  const [seasonProfiles, setSeasonProfiles] = useState<{ id: string; name: string; detail: string }[]>([]);
  const [query, setQuery] = useState("");
  // The scrolling main pane, for the floating "back to top" button.
  const [mainEl, setMainEl] = useState<HTMLDivElement | null>(null);
  const storedOpenFolders = useSyncExternalStore(subscribeToStorage, readStoredOpenFolders, () => null);
  // Null until the user (or a deep link) changes which folders are open.
  const [changedOpenFolders, setOpenFolders] = useState<Set<ArticleTemplateKey> | null>(null);
  const openFolders = useMemo(() => changedOpenFolders ?? parseOpenFolders(storedOpenFolders), [changedOpenFolders, storedOpenFolders]);
  const [territoryExpanded, setTerritoryExpanded] = useState<Set<string>>(new Set());
  /** The create chooser; `folderId`: the new article is also filed in that folder. */
  const [creating, setCreating] = useState<{ template: ArticleTemplateKey | null; folderId?: string } | null>(null);
  const folderStore = useArticleFolderStore();
  const storedTab = useSyncExternalStore(subscribeToStorage, readStoredTab, () => null);
  const [changedTab, setChangedTab] = useState<SidebarTab | null>(null);
  const sidebarTab: SidebarTab = changedTab ?? (storedTab === "folders" ? "folders" : "type");
  const storedUserFolders = useSyncExternalStore(subscribeToStorage, readStoredUserFolders, () => null);
  const [changedUserFolders, setChangedUserFolders] = useState<Set<string> | null>(null);
  const openUserFolders = useMemo(() => changedUserFolders ?? parseIdList(storedUserFolders), [changedUserFolders, storedUserFolders]);
  /** "New folder" / "New subfolder": the parent (null: top level). */
  const [namingFolder, setNamingFolder] = useState<{ parentId: string | null } | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  // Characters and player characters share one table: an older link (or one saved before a
  // character became a player character) opens under the template its record has now.
  const view = useMemo<View>(() => {
    if (requestedView.kind !== "article" || !isPersonTemplate(requestedView.template)) return requestedView;
    const person = lists.people.find((p) => p.id === requestedView.id);
    return person ? { ...requestedView, template: personTemplate(person.kind) } : requestedView;
  }, [requestedView, lists.people]);

  const refreshLists = useCallback(() => {
    return Promise.all([
      fetch("/api/articles/tags").then((r) => json<{ tags: string[] }>(r)),
      loadSeasonProfileLookup().catch(() => []),
      refreshRelationsData(),
    ]).then(([tags, seasonProfiles]) => {
      setSeasonProfiles(seasonProfiles);
      setTagSuggestions(tags.tags);
    });
  }, [refreshRelationsData]);

  const refreshProfiles = useCallback(() => {
    fetch("/api/politics/hierarchy-profiles")
      .then((r) => json<{ profiles: HierarchyProfile[] }>(r))
      .then((d) => setProfiles(d.profiles));
  }, []);

  const refreshFolders = folderStore.refresh;
  useEffect(() => {
    void refreshLists();
    void refreshFolders();
    refreshProfiles();
  }, [refreshLists, refreshFolders, refreshProfiles]);

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

  /** A new article made from a folder's "Create article here" is filed in it too. */
  async function fileInCreatingFolder(id: string) {
    const folderId = creating?.folderId;
    if (folderId) setFolderError(await folderStore.addArticles(folderId, [id]));
  }

  /** An article was just created (in the create modal). */
  function recordCreated(template: ArticleTemplateKey, id: string) {
    setCreating(null);
    void fileInCreatingFolder(id)
      .then(refreshLists)
      .then(() => openArticle(template, id));
  }

  // ---- The Folders tab ----

  const folderCatalog = useMemo(() => articleCatalog(lists), [lists]);
  const fullFolderTree = useMemo(() => buildArticleFolderTree(folderStore.folders, folderStore.items, folderCatalog), [folderStore.folders, folderStore.items, folderCatalog]);
  const needle = query.trim().toLowerCase();
  const shownFolderTree = useMemo(
    () => (needle ? buildArticleFolderTree(folderStore.folders, folderStore.items, folderCatalog, needle) : fullFolderTree),
    [needle, folderStore.folders, folderStore.items, folderCatalog, fullFolderTree],
  );

  function changeTab(tab: SidebarTab) {
    setChangedTab(tab);
    writeStored(SIDEBAR_TAB_KEY, tab);
  }

  function saveUserFolders(next: Set<string>) {
    setChangedUserFolders(next);
    writeStored(OPEN_USER_FOLDERS_KEY, JSON.stringify([...next]));
  }

  function setUserFolderOpen(id: string, open: boolean) {
    if (openUserFolders.has(id) === open) return;
    const next = new Set(openUserFolders);
    if (open) next.add(id);
    else next.delete(id);
    saveUserFolders(next);
  }

  /** Shows a folder's page, with the folder (and its parents) open in the tree. */
  function openUserFolder(id: string) {
    saveUserFolders(new Set([...openUserFolders, ...folderPath(folderStore.folders, id).map((f) => f.id), id]));
    go({ kind: "folder", id });
  }

  async function createUserFolder(name: string, parentId: string | null): Promise<string | null> {
    const { error, folder } = await folderStore.createFolder(name, parentId);
    if (error || !folder) return error ?? t("folders.createFailed");
    setNamingFolder(null);
    changeTab("folders");
    if (parentId) setUserFolderOpen(parentId, true);
    go({ kind: "folder", id: folder.id });
    return null;
  }

  async function dropArticle(articleId: string, from: string | null, to: string, copy: boolean) {
    const problem = from && !copy ? await folderStore.moveArticle(articleId, from, to) : await folderStore.addArticles(to, [articleId]);
    setFolderError(problem);
    if (!problem) setUserFolderOpen(to, true);
  }

  async function moveUserFolder(id: string, parentId: string | null) {
    setFolderError(await folderStore.patchFolder(id, { parentId }));
  }

  // What a character's link info fields can point at.
  const infoLookups = useMemo(() => buildInfoLookups(lists, seasonProfiles), [lists, seasonProfiles]);



  const activeTemplate = isToolView(view) ? null : view.template;
  const tools = [
    { key: "relationships", label: t("tools.relationships"), Icon: Waypoints, active: view.kind === "relationships", onOpen: () => go({ kind: "relationships", focus: null }) },
    { key: "family", label: t("tools.family"), Icon: GitFork, active: view.kind === "family", onOpen: () => go({ kind: "family", id: null, bloodline: false }) },
    { key: "profiles", label: t("tools.profiles"), Icon: Network, active: view.kind === "profiles", onOpen: () => go({ kind: "profiles", id: null }) },
  ];
  const refresh = () => void refreshLists();
  const relationsState: RelationsState = {
    relations,
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

  function renderMiddle() {
    if (view.kind === "profiles") {
      return (
        <HierarchyProfiles selectedId={view.id} onSelect={(id) => go({ kind: "profiles", id })} onChanged={refreshProfiles} />
      );
    }
    if (view.kind === "relationships") return <RelationsPage focusId={view.focus} onFocus={(focus) => go({ kind: "relationships", focus })} />;
    if (view.kind === "family") return <FamilyTreePage personId={view.id} bloodline={view.bloodline} onChange={(id, bloodline) => go({ kind: "family", id, bloodline })} />;
    if (view.kind === "folder") {
      const node = findNode(fullFolderTree, view.id);
      if (!node) return loaded ? <p className="field-label">{t("manager.folderGone")}</p> : <ArticleSkeleton />;
      const path = folderPath(folderStore.folders, view.id);
      return (
        <ArticleFolderView
          key={view.id}
          node={node}
          path={path}
          folders={folderStore.folders}
          catalog={folderCatalog}
          store={folderStore}
          onOpenFolder={openUserFolder}
          onOpenArticle={openArticle}
          onCreateArticle={() => setCreating({ template: null, folderId: view.id })}
          onNewSubfolder={() => setNamingFolder({ parentId: view.id })}
          onDeleted={() => (path.length > 0 ? openUserFolder(path[path.length - 1].id) : go({ kind: "template", template: "generic" }))}
        />
      );
    }
    if (view.kind === "article") {
      const content = renderArticle(view.template, view.id);
      if (content) return content;
      if (!loaded) return <ArticleSkeleton />;
      return <p className="field-label">{t("manager.articleGone")}</p>;
    }
    const { Icon, label, plural, description } = templateOf(view.template);
    return (
      <div className="articles-landing">
        <Icon size={44} strokeWidth={1.5} aria-hidden />
        <h1>{plural}</h1>
        <p>{description}</p>
        <button className="btn btn-primary" onClick={() => setCreating({ template: view.template })}>
          <CirclePlus size={16} strokeWidth={2.25} />
          {t("manager.createNew", { label })}
        </button>
      </div>
    );
  }

  const userFolders = (
    <>
      <ArticleFoldersTree
        tree={shownFolderTree}
        searching={needle.length > 0}
        query={query}
        openFolders={openUserFolders}
        selectedArticleId={view.kind === "article" ? view.id : null}
        selectedFolderId={view.kind === "folder" ? view.id : null}
        actions={{
          onToggleFolder: (id) => setUserFolderOpen(id, !openUserFolders.has(id)),
          onOpenFolder: openUserFolder,
          onOpenArticle: openArticle,
          onNewFolder: () => setNamingFolder({ parentId: null }),
          onMoveFolder: (id, parentId) => void moveUserFolder(id, parentId),
          onDropArticle: (articleId, from, to, copy) => void dropArticle(articleId, from, to, copy),
        }}
      />
      {folderError && (
        <p className="form-error" role="alert">
          {folderError}
        </p>
      )}
    </>
  );

  return (
    <RelationsContext.Provider value={relationsState}>
    <ArticleFoldersContext.Provider value={folderStore}>
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
        tab={sidebarTab}
        onTabChange={changeTab}
        userFolders={userFolders}
      />
      <div ref={setMainEl} className={view.kind === "relationships" || view.kind === "family" ? "articles-main articles-main-tool" : "articles-main articles-main-centered"}>
        <CreateArticleContext.Provider value={openCreate}>{renderMiddle()}</CreateArticleContext.Provider>
      </div>
      <ScrollToTopButton container={mainEl} />
      {creating && (
        <CreateArticleFlow
          initialTemplate={creating.template}
          territories={lists.territories}
          profiles={profiles}
          lookups={infoLookups}
          onClose={() => setCreating(null)}
          onCreated={recordCreated}
        />
      )}
      {namingFolder && (
        <NameDialog
          title={namingFolder.parentId ? t("folders.newSub") : t("folders.new")}
          label={t("folders.nameLabel")}
          saveLabel={t("folders.create")}
          maxLength={MAX_FOLDER_NAME_LENGTH}
          onSave={(name) => createUserFolder(name, namingFolder.parentId)}
          onCancel={() => setNamingFolder(null)}
        />
      )}
    </div>
    </ArticleFoldersContext.Provider>
    </RelationsContext.Provider>
  );
}
