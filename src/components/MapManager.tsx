"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Compass, Plus } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { folderMoveError, MAX_FOLDER_NAME_LENGTH } from "@/server/maps/folders";
import MapsSidebar, { type DragItem, type DropTarget, type MapsSidebarActions } from "./maps/MapsSidebar";
import FolderSettingsPanel from "./maps/FolderSettingsPanel";
import MapSettingsPanel from "./maps/MapSettingsPanel";
import MapPreview from "./maps/MapPreview";
import NewMapModal from "./maps/NewMapModal";
import NameDialog from "./maps/NameDialog";
import DeleteMapDialog from "./maps/DeleteMapDialog";
import { buildMapTree, countMaps, type TreeEntry } from "./maps/map-tree";
import type { FolderSummary, MapSummary } from "./maps/types";
import { SkeletonList } from "@/components/Skeleton";
import { parseIdList, readStored, subscribeToStorage, writeStored } from "./stored";

type Entry = TreeEntry<MapSummary, FolderSummary>;
/** Which settings panel is open. */
type Panel = { kind: "folder"; id: string } | { kind: "map"; id: string };
/** A drop that changes the map hierarchy, waiting for confirmation. */
type HierarchyChange = { kind: "detach"; map: MapSummary; parentName: string; folderId: string | null } | { kind: "nest"; map: MapSummary; parent: MapSummary };

const OPEN_FOLDERS_KEY = "maps-open-folders";

// Open folders are remembered in localStorage (see ./stored).
const readStoredOpenFolders = () => readStored(OPEN_FOLDERS_KEY);
const saveOpenFolders = (open: Set<string>) => writeStored(OPEN_FOLDERS_KEY, JSON.stringify([...open]));

async function sendJson(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return res.ok ? null : ((await res.json().catch(() => ({}))).error ?? "Something went wrong.");
}

/** "Parent / Child" path of a folder, for the New Map folder picker. */
function folderPath(folders: FolderSummary[], folder: FolderSummary): string {
  const names = [folder.name];
  const seen = new Set([folder.id]);
  let cursor = folders.find((f) => f.id === folder.parentId);
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    names.unshift(cursor.name);
    cursor = folders.find((f) => f.id === cursor!.parentId);
  }
  return names.join(" / ");
}

/** `mapId` and every map under it in the parent-map hierarchy (can't become its parent). */
function mapSubtree(maps: MapSummary[], mapId: string): Set<string> {
  const ids = new Set([mapId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const m of maps) {
      if (m.parentId && ids.has(m.parentId) && !ids.has(m.id)) {
        ids.add(m.id);
        grew = true;
      }
    }
  }
  return ids;
}

/**
 * The Maps page: maps and folders in the left bar (search, drag to file,
 * hover actions, New Map / Create folder), and in the middle a read-only
 * preview of the map the pointer rests on.
 */
export default function MapManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [maps, setMaps] = useState<MapSummary[] | null>(null);
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [query, setQuery] = useState("");
  const storedOpenFolders = useSyncExternalStore(subscribeToStorage, readStoredOpenFolders, () => null);
  const [changedOpenFolders, setOpenFolders] = useState<Set<string> | null>(null);
  const openFolders = useMemo(() => changedOpenFolders ?? parseIdList(storedOpenFolders), [changedOpenFolders, storedOpenFolders]);
  const [collapsedMaps, setCollapsedMaps] = useState<Set<string>>(new Set());
  // `/maps?new=1` (the old /maps/new page redirects here) opens New Map straight away.
  const [newMap, setNewMap] = useState<{ folderId: string | null } | null>(() => (searchParams.get("new") ? { folderId: null } : null));
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [hierarchyChange, setHierarchyChange] = useState<HierarchyChange | null>(null);
  const [hierarchyBusy, setHierarchyBusy] = useState(false);
  const [deletingMap, setDeletingMap] = useState<MapSummary | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Entry | null>(null);
  const [folderDeleteBusy, setFolderDeleteBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const refresh = useCallback(() => {
    return Promise.all([fetch("/api/maps").then((r) => r.json()), fetch("/api/map-folders").then((r) => r.json())]).then(([m, f]) => {
      setMaps(m.maps);
      setFolders(f.folders);
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const needle = query.trim().toLowerCase();
  const tree = useMemo(() => buildMapTree(folders, maps ?? [], needle), [folders, maps, needle]);

  function toggleFolder(id: string) {
    const next = new Set(openFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenFolders(next);
    saveOpenFolders(next);
  }

  function hoverMap(id: string | null) {
    // Fades in at once; on leave it fades out, keeping the content until the next preview.
    if (id) setPreviewId(id);
    setPreviewVisible(Boolean(id));
  }

  async function run(action: Promise<string | null>) {
    setActionError(null);
    const problem = await action.catch(() => "Could not reach the server. Try again.");
    if (problem) setActionError(problem);
    await refresh();
  }

  function move(item: DragItem, target: DropTarget) {
    const folderId = target.kind === "folder" ? target.id : null;
    if (item.kind === "folder") {
      if (target.kind === "map") return;
      const folder = folders.find((f) => f.id === item.id);
      if (!folder || folder.parentId === folderId) return;
      const problem = folderMoveError(folders, item.id, folderId);
      if (problem) return setActionError(problem);
      void run(sendJson(`/api/map-folders/${item.id}`, "PATCH", { parentId: folderId }));
      if (folderId && !openFolders.has(folderId)) toggleFolder(folderId);
      return;
    }
    const map = maps?.find((m) => m.id === item.id);
    if (!map) return;
    if (target.kind === "map") {
      const parent = maps?.find((m) => m.id === target.id);
      if (!parent || (map.parentId === parent.id && !map.folderId)) return;
      if (mapSubtree(maps ?? [], map.id).has(parent.id)) return setActionError("A map can't go inside itself or one of its child maps.");
      setHierarchyChange({ kind: "nest", map, parent });
      return;
    }
    // Shown under its parent map (no folder): moving it out of there drops the hierarchy, so ask first.
    const parent = map.parentId && !map.folderId ? maps?.find((m) => m.id === map.parentId) : undefined;
    if (parent) {
      setHierarchyChange({ kind: "detach", map, parentName: parent.name, folderId });
      return;
    }
    if (map.folderId === folderId) return;
    void run(sendJson(`/api/maps/${item.id}`, "PATCH", { folderId }));
    if (folderId && !openFolders.has(folderId)) toggleFolder(folderId);
  }

  async function applyHierarchyChange(change: HierarchyChange) {
    setHierarchyBusy(true);
    const body = change.kind === "nest" ? { parentId: change.parent.id, folderId: null } : { parentId: null, folderId: change.folderId };
    await run(sendJson(`/api/maps/${change.map.id}`, "PATCH", body));
    setHierarchyBusy(false);
    setHierarchyChange(null);
    if (change.kind === "nest") setCollapsedMaps((prev) => new Set([...prev].filter((id) => id !== change.parent.id)));
    else if (change.folderId && !openFolders.has(change.folderId)) toggleFolder(change.folderId);
  }

  /** An empty folder goes at once; one holding maps or folders asks first. */
  function requestDeleteFolder(entry: Entry) {
    if (entry.children.length > 0) return setDeletingFolder(entry);
    setPanel(null);
    void run(sendJson(`/api/map-folders/${entry.item.id}`, "DELETE"));
  }

  async function deleteFolder(entry: Entry) {
    setFolderDeleteBusy(true);
    await run(sendJson(`/api/map-folders/${entry.item.id}`, "DELETE"));
    setFolderDeleteBusy(false);
    setDeletingFolder(null);
    setPanel(null);
  }

  const actions: MapsSidebarActions = {
    onNewMap: () => setNewMap({ folderId: null }),
    onNewFolder: () => setCreatingFolder(true),
    onFolderSettings: (entry) => setPanel({ kind: "folder", id: entry.item.id }),
    onMapSettings: (map) => setPanel({ kind: "map", id: map.id }),
    onMove: move,
    onHoverMap: hoverMap,
    onToggleFolder: toggleFolder,
    onToggleMap: (id) =>
      setCollapsedMaps((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
  };

  function createFolder(name: string): Promise<string | null> {
    return sendJson("/api/map-folders", "POST", { name }).then(async (problem) => {
      if (!problem) {
        setCreatingFolder(false);
        await refresh();
      }
      return problem;
    });
  }

  /** A settings-panel save: PATCH, then reload the lists. */
  function patchAndRefresh(url: string) {
    return async (body: Record<string, unknown>) => {
      const problem = await sendJson(url, "PATCH", body).catch(() => "Could not reach the server. Try again.");
      await refresh();
      return problem;
    };
  }

  function findEntry(entries: Entry[], id: string): Entry | null {
    for (const e of entries) {
      if (e.item.id === id) return e;
      const inner = findEntry(e.children, id);
      if (inner) return inner;
    }
    return null;
  }

  const previewMap = maps?.find((m) => m.id === previewId) ?? null;
  const previewParent = previewMap?.parentId ? (maps?.find((m) => m.id === previewMap.parentId)?.name ?? null) : null;
  const folderOptions = useMemo(
    () => folders.map((f) => ({ value: f.id, label: folderPath(folders, f) })).sort((a, b) => a.label.localeCompare(b.label)),
    [folders]
  );
  const mapOptions = useMemo(() => (maps ?? []).map((m) => ({ value: m.id, label: m.name })).sort((a, b) => a.label.localeCompare(b.label)), [maps]);
  // The open panel's subject; a panel whose folder or map is gone just doesn't render.
  const fullTree = useMemo(() => buildMapTree(folders, maps ?? []), [folders, maps]);
  const panelFolder = panel?.kind === "folder" ? findEntry(fullTree, panel.id) : null;
  const panelMap = panel?.kind === "map" ? (maps?.find((m) => m.id === panel.id) ?? null) : null;
  const parentOptions = useMemo(() => {
    if (!panelMap) return [];
    const excluded = mapSubtree(maps ?? [], panelMap.id);
    return mapOptions.filter((o) => !excluded.has(o.value));
  }, [panelMap, maps, mapOptions]);

  function closeNewMap() {
    setNewMap(null);
    if (searchParams.get("new")) router.replace("/maps");
  }

  return (
    <div className="articles-page maps-page">
      <MapsSidebar
        tree={tree}
        searching={Boolean(needle)}
        query={query}
        onQueryChange={setQuery}
        openFolders={openFolders}
        collapsedMaps={collapsedMaps}
        settingsFor={panel?.id ?? null}
        actions={actions}
      />

      <div className="articles-main maps-main">
        {panelFolder && panelFolder.kind === "folder" && (
          <FolderSettingsPanel
            key={panelFolder.item.id}
            folder={panelFolder.item}
            itemCount={panelFolder.children.length}
            onPatch={patchAndRefresh(`/api/map-folders/${panelFolder.item.id}`)}
            onCreateMap={() => setNewMap({ folderId: panelFolder.item.id })}
            onDelete={() => requestDeleteFolder(panelFolder)}
            onClose={() => setPanel(null)}
          />
        )}
        {panelMap && (
          <MapSettingsPanel
            key={panelMap.id}
            map={panelMap}
            mapOptions={parentOptions}
            folderOptions={folderOptions}
            onPatch={patchAndRefresh(`/api/maps/${panelMap.id}`)}
            onUploaded={() => void refresh()}
            onDelete={() => setDeletingMap(panelMap)}
            onClose={() => setPanel(null)}
          />
        )}
        {actionError && (
          <p className="form-error maps-action-error" role="alert">
            {actionError}
          </p>
        )}
        {maps === null ? (
          <SkeletonList rows={6} label="Loading maps…" />
        ) : maps.length === 0 ? (
          <div className="articles-landing">
            <Compass size={44} strokeWidth={1.5} aria-hidden />
            <h1>Maps</h1>
            <p>No maps yet — create one to start placing markers on it.</p>
            <button type="button" className="btn btn-primary" onClick={() => setNewMap({ folderId: null })}>
              <Plus size={16} strokeWidth={2.25} />
              New Map
            </button>
          </div>
        ) : (
          <>
            <p className={previewVisible ? "maps-idle-hint hidden" : "maps-idle-hint"}>
              <Compass size={16} strokeWidth={2} aria-hidden />
              Rest the pointer on a map to preview it, or click it to open.
            </p>
            <MapPreview map={previewMap} parentName={previewParent} visible={previewVisible} />
          </>
        )}
      </div>

      {newMap && (
        <NewMapModal
          folderOptions={folderOptions}
          mapOptions={mapOptions}
          initialFolderId={newMap.folderId}
          onClose={closeNewMap}
          onCreated={(id) => router.push(`/maps/${id}`)}
        />
      )}

      {creatingFolder && (
        <NameDialog
          title="Create folder"
          label="Folder name"
          saveLabel="Create folder"
          maxLength={MAX_FOLDER_NAME_LENGTH}
          onSave={createFolder}
          onCancel={() => setCreatingFolder(false)}
        />
      )}

      {hierarchyChange && (
        <ConfirmDialog
          open
          danger={false}
          title={hierarchyChange.kind === "nest" ? "Make it a child map?" : "Remove it from the hierarchy?"}
          confirmLabel={hierarchyChange.kind === "nest" ? "Yes" : "Remove hierarchy"}
          busyLabel="Saving…"
          busy={hierarchyBusy}
          onConfirm={() => void applyHierarchyChange(hierarchyChange)}
          onCancel={() => setHierarchyChange(null)}
        >
          {hierarchyChange.kind === "nest" ? (
            <p>
              Dragging <strong>{hierarchyChange.map.name}</strong> inside <strong>{hierarchyChange.parent.name}</strong> will make it a child of it
              {hierarchyChange.map.folderId ? " (and take it out of its folder)" : ""}. Want to proceed?
            </p>
          ) : (
            <p>
              Dragging <strong>{hierarchyChange.map.name}</strong> here will remove it as child of <strong>{hierarchyChange.parentName}</strong>.
            </p>
          )}
        </ConfirmDialog>
      )}

      {deletingMap && (
        <DeleteMapDialog
          map={deletingMap}
          childCount={deletingMap.childCount}
          onCancel={() => setDeletingMap(null)}
          onDeleted={() => {
            setDeletingMap(null);
            setPanel(null);
            void refresh();
          }}
        />
      )}

      {deletingFolder && (
        <ConfirmDialog
          open
          title={`Delete the folder "${deletingFolder.item.name}"?`}
          confirmLabel="Delete folder"
          busyLabel="Deleting…"
          busy={folderDeleteBusy}
          onConfirm={() => void deleteFolder(deletingFolder)}
          onCancel={() => setDeletingFolder(null)}
        >
          <p>The folder and every folder inside it will be deleted.</p>
          <ul>
            {countMaps(deletingFolder) > 0 && (
              <li>
                Its {countMaps(deletingFolder)} map{countMaps(deletingFolder) === 1 ? "" : "s"} will return to the root (no folder).
              </li>
            )}
            <li>No map is ever deleted with a folder.</li>
          </ul>
        </ConfirmDialog>
      )}
    </div>
  );
}
