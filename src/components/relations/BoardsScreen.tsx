"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CreateArticleFlow, { buildInfoLookups } from "@/components/articles/CreateArticleFlow";
import { seedArticleBody } from "@/components/articles/seed-body";
import { json } from "@/components/articles/shared";
import type { HierarchyProfile } from "@/components/articles/types";
import { loadSeasonProfileLookup } from "@/components/calendars/profile-lookup";
import type { ArticleTemplateKey } from "@/server/articles/templates";
import BoardsPage, { type CreatedFromNote } from "./BoardsPage";
import { RelationsContext, type RelationsState } from "./relations-context";
import { useRelationsData } from "./use-relations-data";

const articlesUrl = (entries: Record<string, string>) => `/articles?${new URLSearchParams(entries)}`;

/**
 * The Campaign area's Boards tab (`/boards?id=`). Boards belong to the
 * world, not a campaign; opening a record or its ties goes to Articles.
 */
export default function BoardsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { lists, relations, catalog, derived, refresh } = useRelationsData();
  // For the create article forms (territory profiles, Season Profile info fields).
  const [profiles, setProfiles] = useState<HierarchyProfile[]>([]);
  const [seasonProfiles, setSeasonProfiles] = useState<{ id: string; name: string; detail: string }[]>([]);
  /** "Create article" from a note: its text, and who waits for the result. */
  const [creating, setCreating] = useState<{ text: string; resolve: (created: CreatedFromNote | null) => void } | null>(null);

  useEffect(() => {
    void refresh();
    fetch("/api/politics/hierarchy-profiles")
      .then((r) => json<{ profiles: HierarchyProfile[] }>(r))
      .then((d) => setProfiles(d.profiles))
      .catch(() => {});
    loadSeasonProfileLookup()
      .then(setSeasonProfiles)
      .catch(() => {});
  }, [refresh]);

  const lookups = useMemo(() => buildInfoLookups(lists, seasonProfiles), [lists, seasonProfiles]);
  const createArticleFrom = (text: string) => new Promise<CreatedFromNote | null>((resolve) => setCreating({ text, resolve }));

  async function created(template: ArticleTemplateKey, id: string) {
    if (!creating) return;
    setCreating(null);
    let error: string | null = null;
    try {
      await seedArticleBody(template, id, creating.text);
    } catch (err) {
      error = (err as Error).message;
    }
    await refresh();
    creating.resolve({ id, error });
  }

  const relationsState = useMemo<RelationsState>(
    () => ({
      relations,
      derived,
      catalog,
      templateOf: (id) => catalog.get(id)?.template ?? null,
      lookups,
      openArticle: (template, id) => router.push(articlesUrl({ type: template, id })),
      openWeb: (focus) => router.push(articlesUrl({ type: "relationships", focus })),
      openFamily: (id) => router.push(articlesUrl({ type: "family", id })),
      refresh: () => void refresh(),
    }),
    [relations, derived, catalog, lookups, router, refresh]
  );

  function openBoard(id: string | null) {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("id", id);
    else next.delete("id");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <RelationsContext.Provider value={relationsState}>
      <div className="boards-screen">
        <BoardsPage boardId={params.get("id")} onOpenBoard={openBoard} createArticleFrom={createArticleFrom} />
      </div>
      {creating && (
        <CreateArticleFlow
          initialTemplate="generic"
          territories={lists.territories}
          profiles={profiles}
          lookups={lookups}
          onClose={() => {
            creating.resolve(null);
            setCreating(null);
          }}
          onCreated={(template, id) => void created(template, id)}
        />
      )}
    </RelationsContext.Provider>
  );
}
