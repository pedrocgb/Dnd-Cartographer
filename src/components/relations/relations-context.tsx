"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { InfoFieldSet, InfoValues } from "@/server/articles/info-fields";
import type { ArticleTemplateKey } from "@/server/articles/templates";
import { relationFieldValues } from "@/server/relations/info-backing";
import type { Catalog, DerivedEdge } from "@/server/relations/graph";
import type { ParentKind, SpouseStatus } from "@/server/relations/types";
import type { InfoLookups } from "@/components/articles/InfoBar";
import type { OpenArticle } from "@/components/articles/types";

/** A stored relation as the API returns it. */
export interface Relation {
  id: string;
  type: string;
  fromId: string;
  toId: string;
  label: string;
  oneWay: boolean;
  secret: boolean;
  pinned: boolean;
  attitude: number | null;
  parentKind: ParentKind | null;
  spouseStatus: SpouseStatus | null;
  sinceDay: number | null;
  untilDay: number | null;
  notes: string;
}

/** A read-only edge the server computed (rulers, seats). */
export interface ServerDerived {
  kind: "rules" | "seat";
  fromId: string;
  toId: string;
  label: string;
}

export interface RelationsState {
  relations: Relation[];
  /** Read-only edges: houses, territory parents, rulers, seats, plain Info Bar links. */
  derived: DerivedEdge[];
  /** Every live record (name, template, house color). */
  catalog: Catalog;
  /** The live record's template, or null (deleted or unknown). */
  templateOf: (id: string) => ArticleTemplateKey | null;
  /** Records by template, for pickers. */
  lookups: InfoLookups;
  openArticle: OpenArticle;
  /** Opens the Relationships view centered on a record, or a record's family tree. */
  openWeb: (focusId: string) => void;
  openFamily: (personId: string) => void;
  /** Reloads every list (relations change the other record's Info Bar too). */
  refresh: () => void;
}

const EMPTY: RelationsState = { relations: [], derived: [], catalog: new Map(), templateOf: () => null, lookups: {}, openArticle: () => {}, openWeb: () => {}, openFamily: () => {}, refresh: () => {} };

export const RelationsContext = createContext<RelationsState>(EMPTY);

export const useRelations = () => useContext(RelationsContext);

/**
 * A record's relation-backed Info Bar values. `forView` leaves secret ties
 * out while "Hide secrets" is on; the edit form always gets them all, so a
 * save never drops a hidden tie.
 */
export function useRelationValues(set: InfoFieldSet | undefined, recordId: string, { forView = false } = {}): InfoValues {
  const { relations, templateOf } = useRelations();
  const [hideSecrets] = useHideSecrets();
  return useMemo(() => {
    if (!set) return {};
    const shown = forView && hideSecrets ? relations.filter((r) => !r.secret) : relations;
    return relationFieldValues(set, recordId, shown, templateOf);
  }, [set, recordId, relations, templateOf, forView, hideSecrets]);
}

// ---- Hide secrets (per browser) ----

const HIDE_SECRETS_KEY = "dndforge.hideSecrets";
const HIDE_SECRETS_EVENT = "dndforge:hide-secrets";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(HIDE_SECRETS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(HIDE_SECRETS_EVENT, onChange);
  };
}

function read(): boolean {
  try {
    return window.localStorage.getItem(HIDE_SECRETS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether secret ties are hidden (for sharing the screen with players), and its setter. */
export function useHideSecrets(): [boolean, (hide: boolean) => void] {
  const hide = useSyncExternalStore(subscribe, read, () => false);
  const set = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(HIDE_SECRETS_KEY, next ? "1" : "0");
    } catch {
      // storage unavailable: nothing to remember it in
    }
    window.dispatchEvent(new Event(HIDE_SECRETS_EVENT));
  }, []);
  return [hide, set];
}
