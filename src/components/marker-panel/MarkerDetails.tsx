"use client";

import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";
import LayerChecklist from "../LayerChecklist";
import { MARKER_CATEGORIES, DEFAULT_MARKER_CATEGORY, markerCategoryLabel } from "@/server/markers/icon-registry";
import { STATUS_TAGS, ENVIRONMENT_TAGS, OWNERSHIP_TAGS, markerTagLabel } from "@/server/markers/tag-registry";
import { useT } from "@/i18n/useT";
import type { Marker } from "../MarkerLayer";
import type { MapLayerData } from "../layer-images";
import type { MarkerUpdate } from "./types";
import MarkerCard from "./MarkerCard";

/** Stored English values as picker rows, labeled in the user's language. */
const toOptions = (values: readonly string[], label: (value: string) => string): PickerOption[] => values.map((v) => ({ value: v, label: label(v) }));

/** A labelled field: label on the left, control on the right. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="marker-detail-field">
      <span className="field-label">{label}</span>
      <div className="marker-detail-control">{children}</div>
    </div>
  );
}

/**
 * The marker panel's Details card: classification and placement — category,
 * environment, ownership, status and layers (the linked map has its own card). Searchable pickers
 * for the long lists, chips for status.
 */
export default function MarkerDetails({
  marker,
  layers,
  onUpdate,
}: {
  marker: Marker;
  layers: MapLayerData[];
  onUpdate: MarkerUpdate;
}) {
  const t = useT("maps");
  const category = marker.category ?? DEFAULT_MARKER_CATEGORY;
  // Covers a category saved under an older list — shown as-is instead of silently becoming another.
  const categoryOptions = toOptions((MARKER_CATEGORIES as readonly string[]).includes(category) ? MARKER_CATEGORIES : [category, ...MARKER_CATEGORIES], markerCategoryLabel);
  const environmentOptions = toOptions(ENVIRONMENT_TAGS, (v) => markerTagLabel("environment", v));
  const ownershipOptions = toOptions(OWNERSHIP_TAGS, (v) => markerTagLabel("ownership", v));

  function toggleStatus(tag: string) {
    const next = marker.statusTags.includes(tag) ? marker.statusTags.filter((t) => t !== tag) : [...marker.statusTags, tag];
    onUpdate({ statusTags: next });
  }

  return (
    <MarkerCard title={t("marker.details")}>
      <Field label={t("field.category")}>
        <InfoPicker
          options={categoryOptions}
          value={category}
          placeholder={t("field.category")}
          ariaLabel={t("field.category")}
          searchable={false}
          onChange={(v) => v && onUpdate({ category: v })}
        />
      </Field>
      <Field label={t("marker.environment")}>
        <InfoPicker
          options={environmentOptions}
          value={marker.environment}
          placeholder={t("marker.none")}
          clearLabel={t("marker.none")}
          ariaLabel={t("marker.environment")}
          onChange={(environment) => onUpdate({ environment })}
        />
      </Field>
      <Field label={t("marker.ownership")}>
        <InfoPicker
          options={ownershipOptions}
          value={marker.ownership}
          placeholder={t("marker.none")}
          clearLabel={t("marker.none")}
          ariaLabel={t("marker.ownership")}
          onChange={(ownership) => onUpdate({ ownership })}
        />
      </Field>
      <Field label={t("field.layer")}>
        <InfoPicker
          options={layers.map((l) => ({ value: l.id, label: l.name }))}
          value={marker.layerId}
          placeholder={t("field.layer")}
          ariaLabel={t("field.layer")}
          searchable={layers.length > 8}
          onChange={(layerId) => layerId && onUpdate({ layerId })}
        />
      </Field>
      <LayerChecklist
        layers={layers}
        homeLayerId={marker.layerId}
        value={marker.extraLayerIds ?? []}
        alwaysDrawFlag="markersAlwaysVisible"
        onChange={(extraLayerIds) => onUpdate({ extraLayerIds })}
      />
      <div className="marker-field">
        <span className="field-label">{t("marker.status")}</span>
        <div className="tag-toggle-grid">
          {STATUS_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={marker.statusTags.includes(tag) ? "tag-toggle active" : "tag-toggle"}
              aria-pressed={marker.statusTags.includes(tag)}
              onClick={() => toggleStatus(tag)}
            >
              {markerTagLabel("status", tag)}
            </button>
          ))}
        </div>
      </div>
    </MarkerCard>
  );
}
