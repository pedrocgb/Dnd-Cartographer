import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { markerArticleLinks, markers, maps } from "@/server/db/schema";
import {
  isValidIconKey,
  normalizeColor,
  isValidBackgroundShape,
  isValidLabelMode,
  isValidImportance,
  DEFAULT_ICON_KEY,
  DEFAULT_COLOR,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_OUTLINE_COLOR,
  DEFAULT_BACKGROUND_SHAPE,
  DEFAULT_MARKER_CATEGORY,
  DEFAULT_LABEL_MODE,
  DEFAULT_IMPORTANCE,
  TEMPLATE_MARKER_DEFAULTS,
} from "@/server/markers/icon-registry";
import { toClientMarker } from "@/server/markers/tag-registry";
import { isLayerOfMap } from "@/server/layers/layers";
import { isArticleTemplate, type ArticleTemplateKey } from "@/server/articles/templates";
import { verifiedArticleName } from "@/server/articles/lookup";
import { notInWorld } from "@/server/world/guards";
import { errorResponse } from "@/i18n/server";

export async function GET(_request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "mapNotFound");
  if (denied) return denied;
  const rows = await db
    .select()
    .from(markers)
    .where(and(eq(markers.mapId, mapId), isNull(markers.deletedAt)));
  return NextResponse.json({ markers: rows.map(toClientMarker) });
}

/**
 * Creates a marker. With `article: { template, id }` the marker is placed
 * *for* that article: it is linked as the marker's primary article in the
 * same transaction, the name defaults to the article's, and the icon and
 * category default to the template's (TEMPLATE_MARKER_DEFAULTS).
 */
export async function POST(request: Request, { params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  const denied = await notInWorld("maps", mapId, "mapNotFound");
  if (denied) return denied;
  const map = await db.query.maps.findFirst({ where: eq(maps.id, mapId) });
  if (!map) {
    return errorResponse("mapNotFound", 404);
  }

  const body = await request.json().catch(() => null);
  const u = Number(body?.u);
  const v = Number(body?.v);

  let article: { template: ArticleTemplateKey; id: string; name: string } | null = null;
  if (body?.article != null) {
    const template = body.article.template;
    const id = typeof body.article.id === "string" ? body.article.id : "";
    const articleName = isArticleTemplate(template) && id ? await verifiedArticleName(map.worldId, template, id) : null;
    if (!articleName) return errorResponse("articleNotFound", 404);
    article = { template, id, name: articleName };
  }
  const templateDefaults = article ? TEMPLATE_MARKER_DEFAULTS[article.template] : undefined;

  const name = (typeof body?.name === "string" ? body.name.trim() : "") || article?.name || "";
  if (!name) {
    return errorResponse("markerNameRequired", 400);
  }
  if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) {
    return errorResponse("markerPositionInvalid", 400);
  }

  const iconKey =
    typeof body?.iconKey === "string" && isValidIconKey(body.iconKey) ? body.iconKey : templateDefaults?.iconKey ?? DEFAULT_ICON_KEY;
  const color = typeof body?.color === "string" ? normalizeColor(body.color, DEFAULT_COLOR) : DEFAULT_COLOR;
  const backgroundColor =
    typeof body?.backgroundColor === "string"
      ? normalizeColor(body.backgroundColor, DEFAULT_BACKGROUND_COLOR)
      : DEFAULT_BACKGROUND_COLOR;
  const outlineColor =
    typeof body?.outlineColor === "string"
      ? normalizeColor(body.outlineColor, DEFAULT_OUTLINE_COLOR)
      : DEFAULT_OUTLINE_COLOR;
  const backgroundShape =
    typeof body?.backgroundShape === "string" && isValidBackgroundShape(body.backgroundShape)
      ? body.backgroundShape
      : DEFAULT_BACKGROUND_SHAPE;
  const labelMode = typeof body?.labelMode === "string" && isValidLabelMode(body.labelMode) ? body.labelMode : DEFAULT_LABEL_MODE;
  const importance = typeof body?.importance === "string" && isValidImportance(body.importance) ? body.importance : DEFAULT_IMPORTANCE;
  const linkedMapId = typeof body?.linkedMapId === "string" ? body.linkedMapId : null;
  const category = templateDefaults?.category ?? DEFAULT_MARKER_CATEGORY;

  if (!(await isLayerOfMap(body?.layerId, mapId))) {
    return errorResponse("layerOfMapRequired", 400);
  }
  const layerId: string = body.layerId;

  if (linkedMapId) {
    const linked = await db.query.maps.findFirst({ where: eq(maps.id, linkedMapId) });
    if (!linked || linked.worldId !== map.worldId) {
      return errorResponse("linkedMapSameWorld", 400);
    }
  }

  const marker = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(markers)
      .values({ mapId, layerId, name, u, v, iconKey, color, backgroundColor, outlineColor, backgroundShape, category, linkedMapId, labelMode, importance })
      .returning();
    if (article) {
      await tx
        .insert(markerArticleLinks)
        .values({ worldId: map.worldId, markerId: row.id, template: article.template, articleId: article.id, isPrimary: true });
    }
    return row;
  });
  return NextResponse.json({ marker: toClientMarker(marker) }, { status: 201 });
}
