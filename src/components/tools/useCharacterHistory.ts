"use client";

import { useCallback, useMemo } from "react";
import { markArticleCreated, parseHistory } from "@/lib/character-on-demand/history";
import { useLiveLookup } from "./useLiveLookup";
import { useToolHistory } from "./useToolHistory";

const articlesUrl = (query: string) => `/api/tools/character-on-demand/article?ids=${query}`;
const readLiveIds = (data: unknown) => {
  const ids = (data as { ids?: unknown } | null)?.ids;
  return Array.isArray(ids) ? new Set(ids.filter((id): id is string => typeof id === "string")) : null;
};

/**
 * The recent Character On Demand results of one world (see useToolHistory).
 * An entry's `personId` is dropped once its article is deleted, so a new one can be made.
 */
export function useCharacterHistory(worldId: string) {
  const { entries: stored, add, save } = useToolHistory(`character-on-demand-history:${worldId}`, parseHistory);
  const live = useLiveLookup(stored.flatMap((e) => (e.personId ? [e.personId] : [])), articlesUrl, readLiveIds);
  // While unknown, an entry keeps its article: better than offering a duplicate.
  const entries = useMemo(() => (live ? stored.map((e) => (e.personId && !live.has(e.personId) ? { ...e, personId: undefined } : e)) : stored), [stored, live]);
  const markArticle = useCallback((id: string, personId: string) => save((current) => markArticleCreated(current, id, personId)), [save]);
  return { entries, add, markArticle };
}
