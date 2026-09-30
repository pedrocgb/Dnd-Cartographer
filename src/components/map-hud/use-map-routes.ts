"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/components/calendars/api";
import { useFolderSync } from "@/components/use-folder-sync";
import type { FolderPatch, MapFolderData } from "@/components/LayerFolders";
import type { SelectionApi } from "@/components/multi-select";
import type { MapRouteData, RoutePt, RouteStyle } from "@/server/travel/route-config";
import type { TravelSettings } from "@/server/travel/travel";

const SAVE_DELAY_MS = 250;

export type RoutePatch = Partial<Omit<MapRouteData, "id" | "mapId" | "settings">> & { settings?: Partial<TravelSettings> };

const routeGroupUrl = (id: string) => `/api/route-groups/${id}`;

/** The map's saved travel routes and their folders, loaded once and edited optimistically. */
export function useMapRoutes(mapId: string) {
  const [routes, setRoutes] = useState<MapRouteData[]>([]);
  const [groups, setGroups] = useState<MapFolderData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(new Map<string, { patch: RoutePatch; timer: ReturnType<typeof setTimeout> }>());
  const updateGroup = useFolderSync(setGroups, routeGroupUrl);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      api<{ routes: MapRouteData[] }>("GET", `/api/maps/${mapId}/routes`),
      api<{ groups: MapFolderData[] }>("GET", `/api/maps/${mapId}/route-groups`),
    ]).then(([r, g]) => {
      if (cancelled) return;
      if (r.ok) setRoutes(r.data.routes);
      if (g.ok) setGroups(g.data.groups);
    });
    return () => {
      cancelled = true;
    };
  }, [mapId]);

  // Unsaved edits still go out when the map closes.
  useEffect(() => {
    const queue = pending.current;
    return () => {
      for (const [id, { patch, timer }] of queue) {
        clearTimeout(timer);
        void api("PATCH", `/api/routes/${id}`, patch);
      }
      queue.clear();
    };
  }, []);

  const send = useCallback(async (id: string, patch: RoutePatch) => {
    const res = await api<{ route: MapRouteData }>("PATCH", `/api/routes/${id}`, patch);
    if (!res.ok) return setError(res.data.error ?? "Could not save the route.");
    setError(null);
    // The server's copy wins for what it normalizes (points, settings, folder rules).
    setRoutes((prev) => prev.map((r) => (r.id === id && !pending.current.has(id) ? res.data.route : r)));
  }, []);

  const create = useCallback(
    async (input: { layerId: string; groupId: string | null; points: RoutePt[]; name: string; style: RouteStyle; settings: TravelSettings }) => {
      const res = await api<{ route: MapRouteData }>("POST", `/api/maps/${mapId}/routes`, { ...input.style, ...input });
      if (!res.ok) {
        setError(res.data.error ?? "Could not save the route.");
        return null;
      }
      setError(null);
      setRoutes((prev) => [...prev, res.data.route]);
      return res.data.route;
    },
    [mapId]
  );

  /** Applies at once; folder/layer/order changes save right away, the rest shortly after (merged). */
  const update = useCallback(
    (id: string, patch: RoutePatch) => {
      setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, settings: patch.settings ? { ...r.settings, ...patch.settings } : r.settings } : r)));
      const queue = pending.current;
      const before = queue.get(id);
      if (before) clearTimeout(before.timer);
      const merged: RoutePatch = { ...before?.patch, ...patch, settings: before?.patch.settings || patch.settings ? { ...before?.patch.settings, ...patch.settings } : undefined };
      const immediate = "groupId" in patch || "layerId" in patch || "sortOrder" in patch;
      if (immediate) {
        queue.delete(id);
        void send(id, merged);
        return;
      }
      const timer = setTimeout(() => {
        queue.delete(id);
        void send(id, merged);
      }, SAVE_DELAY_MS);
      queue.set(id, { patch: merged, timer });
    },
    [send]
  );

  const remove = useCallback(async (id: string) => {
    const queued = pending.current.get(id);
    if (queued) clearTimeout(queued.timer);
    pending.current.delete(id);
    setRoutes((prev) => prev.filter((r) => r.id !== id));
    const res = await api("DELETE", `/api/routes/${id}`);
    if (!res.ok) setError(res.data.error ?? "Could not delete the route.");
  }, []);

  /** Brings a deleted route back (undo), as the server has it. */
  const restore = useCallback(async (route: MapRouteData) => {
    const res = await api<{ route: MapRouteData }>("POST", `/api/routes/${route.id}/restore`);
    if (!res.ok) return setError(res.data.error ?? "Could not restore the route.");
    setRoutes((prev) => (prev.some((r) => r.id === route.id) ? prev : [...prev, res.data.route]));
  }, []);

  const createGroup = useCallback(
    async (name: string, layerId: string) => {
      const res = await api<{ group: MapFolderData }>("POST", `/api/maps/${mapId}/route-groups`, { name, layerId });
      if (!res.ok) {
        setError(res.data.error ?? "Could not create the folder.");
        return null;
      }
      setGroups((prev) => [...prev, res.data.group]);
      return res.data.group;
    },
    [mapId]
  );

  /** Its routes go to Ungrouped, or with `cascade` are deleted with it. */
  const deleteGroup = useCallback(async (id: string, cascade: boolean) => {
    const res = await api("DELETE", `/api/route-groups/${id}${cascade ? "?mode=cascade" : ""}`);
    if (!res.ok) return setError(res.data.error ?? "Could not delete the folder.");
    setGroups((prev) => prev.filter((g) => g.id !== id));
    setRoutes((prev) => (cascade ? prev.filter((r) => r.groupId !== id) : prev.map((r) => (r.groupId === id ? { ...r, groupId: null } : r))));
  }, []);

  return { routes, groups, error, create, update, remove, restore, createGroup, updateGroup, deleteGroup };
}

export type MapRoutesApi = ReturnType<typeof useMapRoutes>;
export type NewRoute = Parameters<MapRoutesApi["create"]>[0];

/**
 * What the Travel tool gets from the map workspace: the active layer's routes
 * and edits that go through its undo history and multi-selection.
 */
export interface RouteControls {
  /** Routes on the active layer (home or also shown here). */
  routes: MapRouteData[];
  /** Routes drawn on the map (the active layer's plus "always draw" layers'), shown ones only. */
  drawn: MapRouteData[];
  /** Every route folder of the map. */
  groups: MapFolderData[];
  error: string | null;
  sel: SelectionApi;
  /** Folder new routes go into (one of the active layer's), or null: Ungrouped. */
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
  /** Its own lock or its folder's. */
  isLocked: (route: MapRouteData) => boolean;
  create: (input: NewRoute) => Promise<MapRouteData | null>;
  update: (id: string, patch: RoutePatch) => void;
  remove: (id: string) => void;
  /** One undo step for several routes (locked ones skipped unless `includeLocked`). */
  updateMany: (ids: readonly string[], patchOf: (route: MapRouteData) => RoutePatch, opts?: { includeLocked?: boolean }) => void;
  deleteMany: (ids: readonly string[]) => void;
  createGroup: (name: string) => Promise<MapFolderData | null>;
  updateGroup: (id: string, patch: FolderPatch) => void;
  deleteGroup: (id: string, cascade: boolean) => void;
}
