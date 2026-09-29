"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/calendars/api";
import type { ClientCampaign, ClientSession } from "@/components/sessions/types";
import type { FrontData, QuestData } from "@/server/quests/types";
import type { OutlineNode, PlotThread, ThreadBeat } from "@/server/writer/types";

export interface WriterData {
  nodes: OutlineNode[];
  threads: PlotThread[];
  beats: ThreadBeat[];
  sessions: ClientSession[];
  quests: QuestData[];
  fronts: FrontData[];
}

const EMPTY: WriterData = { nodes: [], threads: [], beats: [], sessions: [], quests: [], fronts: [] };

/** Everything the Writer shows for one campaign; `reload` refetches it all (e.g. after a conflict). */
export function useWriterData(campaignId: string | null) {
  const [data, setData] = useState<WriterData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (id: string) => {
    const c = encodeURIComponent(id);
    const [outline, sessions, quests, fronts] = await Promise.all([
      api<{ nodes: OutlineNode[]; threads: PlotThread[]; beats: ThreadBeat[] }>("GET", `/api/campaigns/${c}/outline`),
      api<{ sessions: ClientSession[] }>("GET", `/api/sessions?campaignId=${c}`),
      api<{ quests: QuestData[] }>("GET", `/api/campaigns/${c}/quests`),
      api<{ fronts: FrontData[] }>("GET", `/api/campaigns/${c}/fronts`),
    ]);
    if (!outline.ok) return { error: outline.data.error ?? "Could not load the story." };
    return {
      data: {
        nodes: outline.data.nodes,
        threads: outline.data.threads,
        beats: outline.data.beats,
        sessions: sessions.ok ? sessions.data.sessions : [],
        quests: quests.ok ? quests.data.quests : [],
        fronts: fronts.ok ? fronts.data.fronts : [],
      },
    };
  }, []);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    void fetchAll(campaignId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.data) setData(res.data);
      setError(res.error ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [campaignId, fetchAll]);

  const reload = useCallback(async () => {
    if (!campaignId) return;
    const res = await fetchAll(campaignId);
    if (res.data) setData(res.data);
    setError(res.error ?? null);
  }, [campaignId, fetchAll]);

  const update = useCallback((fn: (d: WriterData) => WriterData) => setData(fn), []);
  return { data, loading, error, reload, update };
}

/** Replaces the item with the same id (or appends it). */
export const upsert = <T extends { id: string }>(list: T[], item: T) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);

/** Loads the world's campaigns once. */
export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<ClientCampaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void api<{ campaigns: ClientCampaign[] }>("GET", "/api/campaigns").then((res) => {
      if (cancelled) return;
      if (res.ok) setCampaigns(res.data.campaigns);
      else setError(res.data.error ?? "Could not load the campaigns.");
    });
    return () => {
      cancelled = true;
    };
  }, [version]);
  const replace = useCallback((c: ClientCampaign) => setCampaigns((list) => (list ? upsert(list, c) : [c])), []);
  /** Loads the list again (campaigns changed elsewhere). */
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { campaigns, error, replace, reload };
}
