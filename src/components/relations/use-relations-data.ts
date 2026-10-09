"use client";

import { useCallback, useMemo, useState } from "react";
import type { ArticleLists } from "@/components/articles/ArticlesSidebar";
import { json } from "@/components/articles/shared";
import type { GenericArticle, Organization, Person, Territory } from "@/components/articles/types";
import { buildCatalog, derivedEdges } from "@/server/relations/graph";
import type { Relation, ServerDerived } from "./relations-context";

const EMPTY_LISTS: ArticleLists = { territories: [], people: [], organizations: [], articles: [] };

/**
 * Every live record and the stored relations, as the relations tools need
 * them (Articles, Boards). `refresh` reloads both; `loaded` turns true once
 * the first load lands.
 */
export function useRelationsData() {
  const [lists, setLists] = useState<ArticleLists>(EMPTY_LISTS);
  const [relationData, setRelationData] = useState<{ relations: Relation[]; derived: ServerDerived[] }>({ relations: [], derived: [] });
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    return Promise.all([
      fetch("/api/politics/territories").then((r) => json<{ territories: Territory[] }>(r)),
      fetch("/api/politics/people").then((r) => json<{ people: Person[] }>(r)),
      fetch("/api/politics/organizations").then((r) => json<{ organizations: Organization[] }>(r)),
      fetch("/api/articles").then((r) => json<{ articles: GenericArticle[] }>(r)),
      fetch("/api/relations").then((r) => json<{ relations: Relation[]; derived: ServerDerived[] }>(r)),
    ]).then(([t, p, o, a, rel]) => {
      setLists({ territories: t.territories, people: p.people, organizations: o.organizations, articles: a.articles });
      setRelationData(rel);
      setLoaded(true);
    });
  }, []);

  // Every live record (template, name, house color), for relation-backed Info Bar fields and graphs.
  const catalog = useMemo(() => buildCatalog(lists), [lists]);
  const derived = useMemo(() => derivedEdges(catalog, relationData.derived, lists), [catalog, relationData.derived, lists]);

  return { lists, relations: relationData.relations, catalog, derived, loaded, refresh };
}
