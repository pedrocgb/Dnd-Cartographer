import { eq, and, ne, isNotNull } from "drizzle-orm";
import { db } from "../db/client";
import { markers, maps, richDocuments, territories, people, organizations, politicalLinks, territorySeats } from "../db/schema";
import { resolveChain, getAcceptedAffiliation, getAuthoritiesForChain } from "./queries";
import { extractLinksFromJson, classifyHref } from "./rich-text-links";

export interface ConsolidatedLink {
  key: string;
  direction: "outgoing" | "incoming";
  source: string;
  targetType: "map" | "marker" | "territory" | "person" | "organization" | "external";
  targetId: string | null;
  targetName: string;
  href: string | null;
  removableLinkId: string | null;
  unavailable?: boolean;
}

async function resolveInternalName(targetType: string, targetId: string): Promise<{ name: string; href: string; unavailable: boolean }> {
  switch (targetType) {
    case "map": {
      const row = await db.query.maps.findFirst({ where: eq(maps.id, targetId) });
      return row ? { name: row.name, href: `/maps/${targetId}`, unavailable: Boolean(row.deletedAt) } : { name: "(deleted map)", href: `/maps/${targetId}`, unavailable: true };
    }
    case "marker": {
      const row = await db.query.markers.findFirst({ where: eq(markers.id, targetId) });
      if (!row) return { name: "(deleted marker)", href: "#", unavailable: true };
      return { name: row.name, href: `/maps/${row.mapId}?marker=${targetId}`, unavailable: Boolean(row.deletedAt) };
    }
    case "territory": {
      const row = await db.query.territories.findFirst({ where: eq(territories.id, targetId) });
      return row
        ? { name: row.name, href: `/politics?type=territory&id=${targetId}`, unavailable: Boolean(row.deletedAt) }
        : { name: "(deleted territory)", href: "#", unavailable: true };
    }
    case "person": {
      const row = await db.query.people.findFirst({ where: eq(people.id, targetId) });
      return row
        ? { name: row.name, href: `/politics?type=person&id=${targetId}`, unavailable: Boolean(row.deletedAt) }
        : { name: "(deleted person)", href: "#", unavailable: true };
    }
    case "organization": {
      const row = await db.query.organizations.findFirst({ where: eq(organizations.id, targetId) });
      return row
        ? { name: row.name, href: `/politics?type=organization&id=${targetId}`, unavailable: Boolean(row.deletedAt) }
        : { name: "(deleted organization)", href: "#", unavailable: true };
    }
    default:
      return { name: targetId, href: "#", unavailable: true };
  }
}

/**
 * Builds the full consolidated Links view for one marker: direct links,
 * the linked map, rich-text hyperlinks from its own description, its
 * political affiliation chain, authorities across that chain, capital/seat
 * roles, and incoming references from other owners' links or other
 * markers' descriptions. Every entry explains why it appears (the
 * `source` field) — nothing here is a materialized copy of another
 * record's data, only resolved names/hrefs for display.
 */
export async function buildMarkerLinks(markerId: string): Promise<ConsolidatedLink[]> {
  const marker = await db.query.markers.findFirst({ where: eq(markers.id, markerId) });
  if (!marker) return [];

  const out: ConsolidatedLink[] = [];
  const seenOutgoing = new Set<string>(); // `${targetType}:${targetId}` or `external:${url}`, direction-scoped

  function addOutgoing(entry: Omit<ConsolidatedLink, "key" | "direction">) {
    const dedupeKey = entry.targetType === "external" ? `external:${entry.href}` : `${entry.targetType}:${entry.targetId}`;
    if (seenOutgoing.has(dedupeKey)) return;
    seenOutgoing.add(dedupeKey);
    out.push({ ...entry, key: `out:${dedupeKey}`, direction: "outgoing" });
  }

  // 1. Direct marker-attached links.
  const direct = await db.query.politicalLinks.findMany({ where: and(eq(politicalLinks.ownerType, "marker"), eq(politicalLinks.ownerId, markerId)) });
  for (const link of direct) {
    if (link.externalUrl) {
      addOutgoing({ source: "Direct", targetType: "external", targetId: null, targetName: link.label || link.externalUrl, href: link.externalUrl, removableLinkId: link.id });
    } else if (link.targetType && link.targetId) {
      const resolved = await resolveInternalName(link.targetType, link.targetId);
      addOutgoing({
        source: "Direct",
        targetType: link.targetType as ConsolidatedLink["targetType"],
        targetId: link.targetId,
        targetName: link.label || resolved.name,
        href: resolved.href,
        removableLinkId: link.id,
        unavailable: resolved.unavailable,
      });
    }
  }

  // 2. Existing linked map.
  if (marker.linkedMapId) {
    const resolved = await resolveInternalName("map", marker.linkedMapId);
    addOutgoing({ source: "Linked map", targetType: "map", targetId: marker.linkedMapId, targetName: resolved.name, href: resolved.href, removableLinkId: null, unavailable: resolved.unavailable });
  }

  // 3. Rich-text links from this marker's own description.
  if (marker.descriptionDocumentId) {
    const doc = await db.query.richDocuments.findFirst({ where: eq(richDocuments.id, marker.descriptionDocumentId) });
    if (doc) {
      for (const link of extractLinksFromJson(doc.jsonText)) {
        const classified = classifyHref(link.href);
        if (classified.kind === "marker") {
          const resolved = await resolveInternalName("marker", classified.markerId);
          addOutgoing({ source: "From description", targetType: "marker", targetId: classified.markerId, targetName: resolved.name, href: resolved.href, removableLinkId: null, unavailable: resolved.unavailable });
        } else if (classified.kind === "map") {
          const resolved = await resolveInternalName("map", classified.mapId);
          addOutgoing({ source: "From description", targetType: "map", targetId: classified.mapId, targetName: resolved.name, href: resolved.href, removableLinkId: null, unavailable: resolved.unavailable });
        } else {
          addOutgoing({ source: "From description", targetType: "external", targetId: null, targetName: link.text || link.href, href: link.href, removableLinkId: null });
        }
      }
    }
  }

  // 4. Political affiliation: accepted territory + full ancestor chain.
  const accepted = await getAcceptedAffiliation(markerId);
  let chainIds: string[] = [];
  if (accepted) {
    const chain = await resolveChain(accepted.territoryId);
    chainIds = chain.map((t) => t.id);
    for (let i = 0; i < chain.length; i++) {
      const t = chain[i];
      const isLeaf = t.id === accepted.territoryId;
      addOutgoing({
        source: isLeaf ? "Political affiliation (direct)" : "Political affiliation (inherited)",
        targetType: "territory",
        targetId: t.id,
        targetName: `${t.name} (${t.type})`,
        href: `/politics?type=territory&id=${t.id}`,
        removableLinkId: null,
        unavailable: Boolean(t.deletedAt),
      });
    }

    // 5. Authorities across that chain.
    const authorities = await getAuthoritiesForChain(chainIds);
    const territoryNameById = new Map(chain.map((t) => [t.id, t.name]));
    for (const a of authorities) {
      const resolved = await resolveInternalName(a.holderType, a.holderId);
      const territoryName = territoryNameById.get(a.territoryId) ?? "";
      addOutgoing({
        source: `${a.role}${a.title ? ` (${a.title})` : ""} of ${territoryName}`,
        targetType: a.holderType as ConsolidatedLink["targetType"],
        targetId: a.holderId,
        targetName: resolved.name,
        href: resolved.href,
        removableLinkId: null,
        unavailable: resolved.unavailable,
      });
    }
  }

  // 6. Capital/seat roles for this marker.
  const seats = await db.query.territorySeats.findMany({ where: eq(territorySeats.markerId, markerId) });
  for (const seat of seats) {
    const territory = await db.query.territories.findFirst({ where: eq(territories.id, seat.territoryId) });
    if (!territory) continue;
    addOutgoing({
      source: seat.role === "capital" ? "Capital of" : "Administrative seat of",
      targetType: "territory",
      targetId: territory.id,
      targetName: `${territory.name} (${territory.type})`,
      href: `/politics?type=territory&id=${territory.id}`,
      removableLinkId: null,
      unavailable: Boolean(territory.deletedAt),
    });
  }

  // 7. Incoming: other owners' explicit links pointing at this marker.
  const incoming: ConsolidatedLink[] = [];
  const seenIncoming = new Set<string>();
  function addIncoming(entry: Omit<ConsolidatedLink, "key" | "direction">) {
    const dedupeKey = `${entry.targetType}:${entry.targetId}`;
    if (seenIncoming.has(dedupeKey)) return;
    seenIncoming.add(dedupeKey);
    incoming.push({ ...entry, key: `in:${dedupeKey}`, direction: "incoming" });
  }

  const incomingLinks = await db.query.politicalLinks.findMany({
    where: and(eq(politicalLinks.targetType, "marker"), eq(politicalLinks.targetId, markerId)),
  });
  for (const link of incomingLinks) {
    const resolved = await resolveInternalName(link.ownerType, link.ownerId);
    addIncoming({
      source: "Referenced by",
      targetType: link.ownerType as ConsolidatedLink["targetType"],
      targetId: link.ownerId,
      targetName: resolved.name,
      href: resolved.href,
      removableLinkId: null,
      unavailable: resolved.unavailable,
    });
  }

  // Incoming: other markers whose own description rich-text links here.
  const otherMarkersWithDocs = await db.query.markers.findMany({
    where: and(ne(markers.id, markerId), isNotNull(markers.descriptionDocumentId)),
  });
  for (const other of otherMarkersWithDocs) {
    if (!other.descriptionDocumentId) continue;
    const doc = await db.query.richDocuments.findFirst({ where: eq(richDocuments.id, other.descriptionDocumentId) });
    if (!doc) continue;
    const hasLinkToThis = extractLinksFromJson(doc.jsonText).some((l) => {
      const c = classifyHref(l.href);
      return c.kind === "marker" && c.markerId === markerId;
    });
    if (hasLinkToThis) {
      addIncoming({
        source: "Referenced by (description)",
        targetType: "marker",
        targetId: other.id,
        targetName: other.name,
        href: `/maps/${other.mapId}?marker=${other.id}`,
        removableLinkId: null,
        unavailable: Boolean(other.deletedAt),
      });
    }
  }

  return [...out, ...incoming];
}
