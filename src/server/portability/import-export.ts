import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { db } from "../db/client";
import { mapCategories, markerCategories, maps, markers, mapAssets, processingJobs, richDocuments } from "../db/schema";
import { validateDocument, DocumentValidationError, SCHEMA_VERSION } from "../documents/schema";
import {
  isValidIconKey,
  normalizeColor,
  isValidBackgroundShape,
  DEFAULT_ICON_KEY,
  DEFAULT_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_OUTLINE_COLOR,
  DEFAULT_BACKGROUND_SHAPE,
} from "../markers/icon-registry";
import { isValidEnvironmentTag, isValidOwnershipTag, encodeStatusTags } from "../markers/tag-registry";
import { isValidMarkerCategory } from "../markers/icon-registry";
import { originalPath, originalKey, tempUploadPath } from "../assets/paths";
import { validateImageFile, InvalidImageError } from "../assets/validate";
import type { ExportBundle } from "./types";

export class ImportValidationError extends Error {}

/** Tolerates bundles from before statusTags existed (undefined/malformed). */
function parseJsonArraySafe(raw: string | undefined): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const LIMITS = { maxMaps: 5000, maxMarkers: 50_000, maxDocuments: 55_000, maxCategories: 1000 };

function assertBundleShape(bundle: unknown): ExportBundle {
  if (typeof bundle !== "object" || bundle === null) {
    throw new ImportValidationError("Import file is not a valid export bundle.");
  }
  const b = bundle as Partial<ExportBundle>;
  if (b.exportVersion !== 1) {
    throw new ImportValidationError(`Unsupported export version: ${String(b.exportVersion)}`);
  }
  if (!Array.isArray(b.maps) || !Array.isArray(b.markers) || !Array.isArray(b.documents)) {
    throw new ImportValidationError("Import file is missing required sections.");
  }
  if (b.maps.length > LIMITS.maxMaps) throw new ImportValidationError("Too many maps in import file.");
  if (b.markers.length > LIMITS.maxMarkers) throw new ImportValidationError("Too many markers in import file.");
  if (b.documents.length > LIMITS.maxDocuments) throw new ImportValidationError("Too many documents in import file.");
  if ((b.mapCategories?.length ?? 0) > LIMITS.maxCategories || (b.markerCategories?.length ?? 0) > LIMITS.maxCategories) {
    throw new ImportValidationError("Too many categories in import file.");
  }
  return b as ExportBundle;
}

export interface ImportSummary {
  worldId: string;
  mapsCreated: number;
  markersCreated: number;
  documentsCreated: number;
  assetsQueued: number;
}

/**
 * Imports additively into the given (existing) world: every entity gets a
 * fresh id, so an import can never collide with or overwrite anything
 * already there. There's no world-switcher UI yet, so importing into a
 * brand-new isolated world (as the plan's wording suggests) would make the
 * result invisible — merging into the active world is what's actually
 * usable today, while still being purely additive and collision-safe.
 */
export async function importBundle(raw: unknown, worldId: string): Promise<ImportSummary> {
  const bundle = assertBundleShape(raw);

  for (const doc of bundle.documents) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(doc.jsonText);
    } catch {
      throw new ImportValidationError(`Document ${doc.id} is not valid JSON.`);
    }
    try {
      validateDocument(parsed);
    } catch (err) {
      if (err instanceof DocumentValidationError) {
        throw new ImportValidationError(`Document ${doc.id} failed validation: ${err.message}`);
      }
      throw err;
    }
  }

  const documentIdMap = new Map<string, string>();
  const categoryIdMap = new Map<string, string>();
  const markerCategoryIdMap = new Map<string, string>();
  const mapIdMap = new Map<string, string>();

  for (const doc of bundle.documents) {
    const [inserted] = await db
      .insert(richDocuments)
      .values({
        worldId,
        jsonText: doc.jsonText,
        plainText: doc.plainText,
        schemaVersion: SCHEMA_VERSION,
      })
      .returning({ id: richDocuments.id });
    documentIdMap.set(doc.id, inserted.id);
  }

  for (const cat of bundle.mapCategories) {
    const [inserted] = await db
      .insert(mapCategories)
      .values({ worldId, label: cat.label, sortOrder: cat.sortOrder })
      .returning({ id: mapCategories.id });
    categoryIdMap.set(cat.id, inserted.id);
  }

  for (const cat of bundle.markerCategories) {
    const [inserted] = await db
      .insert(markerCategories)
      .values({ worldId, label: cat.label, defaultIconKey: cat.defaultIconKey, defaultColor: cat.defaultColor })
      .returning({ id: markerCategories.id });
    markerCategoryIdMap.set(cat.id, inserted.id);
  }

  // Pass 1: allocate new ids for every map before inserting any of them, so
  // parentId references (which point at other maps in this same import) can
  // always be remapped regardless of insertion order.
  for (const map of bundle.maps) {
    mapIdMap.set(map.id, crypto.randomUUID());
  }

  for (const map of bundle.maps) {
    const newId = mapIdMap.get(map.id)!;
    await db.insert(maps).values({
      id: newId,
      worldId,
      parentId: map.parentId ? mapIdMap.get(map.parentId) ?? null : null,
      categoryId: map.categoryId ? categoryIdMap.get(map.categoryId) ?? null : null,
      name: map.name,
      descriptionDocumentId: map.descriptionDocumentId ? documentIdMap.get(map.descriptionDocumentId) ?? null : null,
      deletedAt: map.deletedAt ? new Date(map.deletedAt) : null,
    });
  }

  let markersCreated = 0;
  for (const marker of bundle.markers) {
    const newMapId = mapIdMap.get(marker.mapId);
    if (!newMapId) continue; // marker referenced a map not present in this bundle
    await db.insert(markers).values({
      mapId: newMapId,
      name: marker.name,
      u: marker.u,
      v: marker.v,
      iconKey: isValidIconKey(marker.iconKey) ? marker.iconKey : DEFAULT_ICON_KEY,
      color: normalizeColor(marker.color ?? DEFAULT_COLOR, DEFAULT_COLOR),
      backgroundColor: normalizeColor(marker.backgroundColor ?? DEFAULT_BACKGROUND_COLOR, DEFAULT_BACKGROUND_COLOR),
      outlineColor: normalizeColor(marker.outlineColor ?? DEFAULT_OUTLINE_COLOR, DEFAULT_OUTLINE_COLOR),
      backgroundShape:
        marker.backgroundShape && isValidBackgroundShape(marker.backgroundShape)
          ? marker.backgroundShape
          : DEFAULT_BACKGROUND_SHAPE,
      category: marker.category && isValidMarkerCategory(marker.category) ? marker.category : null,
      categoryId: marker.categoryId ? markerCategoryIdMap.get(marker.categoryId) ?? null : null,
      descriptionDocumentId: marker.descriptionDocumentId
        ? documentIdMap.get(marker.descriptionDocumentId) ?? null
        : null,
      linkedMapId: marker.linkedMapId ? mapIdMap.get(marker.linkedMapId) ?? null : null,
      locked: marker.locked,
      statusTags: encodeStatusTags(parseJsonArraySafe(marker.statusTags)),
      environment: marker.environment && isValidEnvironmentTag(marker.environment) ? marker.environment : null,
      ownership: marker.ownership && isValidOwnershipTag(marker.ownership) ? marker.ownership : null,
      deletedAt: marker.deletedAt ? new Date(marker.deletedAt) : null,
    });
    markersCreated += 1;
  }

  let assetsQueued = 0;
  for (const map of bundle.maps) {
    if (!map.asset) continue;
    const newMapId = mapIdMap.get(map.id)!;
    const assetId = crypto.randomUUID();
    const bytes = Buffer.from(map.asset.dataBase64, "base64");

    const tempId = crypto.randomUUID();
    const tempPath = tempUploadPath(tempId);
    await mkdir(path.dirname(tempPath), { recursive: true });
    await writeFile(tempPath, bytes);

    let validated;
    try {
      validated = await validateImageFile(tempPath, bytes.length);
    } catch (err) {
      await rm(tempPath, { force: true });
      if (err instanceof InvalidImageError) continue; // skip a corrupt embedded image, don't fail the whole import
      throw err;
    }

    const finalPath = originalPath(assetId, validated.extension);
    await mkdir(path.dirname(finalPath), { recursive: true });
    await writeFile(finalPath, bytes);
    await rm(tempPath, { force: true });

    const [asset] = await db
      .insert(mapAssets)
      .values({
        id: assetId,
        mapId: newMapId,
        originalKey: originalKey(assetId, validated.extension),
        width: validated.width,
        height: validated.height,
        byteSize: bytes.length,
        state: "queued",
        generation: 1,
      })
      .returning({ id: mapAssets.id });

    await db.insert(processingJobs).values({ assetId: asset.id, generation: 1, state: "queued" });
    assetsQueued += 1;
  }

  return {
    worldId,
    mapsCreated: bundle.maps.length,
    markersCreated,
    documentsCreated: bundle.documents.length,
    assetsQueued,
  };
}
