"use client";

import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";
import LayerChecklist from "../LayerChecklist";
import { MARKER_CATEGORIES, DEFAULT_MARKER_CATEGORY } from "@/server/markers/icon-registry";
import { STATUS_TAGS, ENVIRONMENT_TAGS, OWNERSHIP_TAGS } from "@/server/markers/tag-registry";
import type { Marker } from "../MarkerLayer";
import type { MapLayerData } from "../layer-images";
import type { MarkerUpdate } from "./types";
import MarkerCard from "./MarkerCard";

const toOptions = (values: readonly string[]): PickerOption[] => values.map((v) => ({ value: v, label: v }));
const ENVIRONMENT_OPTIONS = toOptions(ENVIRONMENT_TAGS);
const OWNERSHIP_OPTIONS = toOptions(OWNERSHIP_TAGS);

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
  const category = marker.category ?? DEFAULT_MARKER_CATEGORY;
  // Covers a category saved under an older list — shown as-is instead of silently becoming another.
  const categoryOptions = toOptions((MARKER_CATEGORIES as readonly string[]).includes(category) ? MARKER_CATEGORIES : [category, ...MARKER_CATEGORIES]);

  function toggleStatus(tag: string) {
    const next = marker.statusTags.includes(tag) ? marker.statusTags.filter((t) => t !== tag) : [...marker.statusTags, tag];
    onUpdate({ statusTags: next });
  }

  return (
    <MarkerCard title="Details">
      <Field label="Category">
        <InfoPicker
          options={categoryOptions}
          value={category}
          placeholder="Category"
          ariaLabel="Category"
          searchable={false}
          onChange={(v) => v && onUpdate({ category: v })}
        />
      </Field>
      <Field label="Environment">
        <InfoPicker
          options={ENVIRONMENT_OPTIONS}
          value={marker.environment}
          placeholder="None"
          clearLabel="None"
          ariaLabel="Environment"
          onChange={(environment) => onUpdate({ environment })}
        />
      </Field>
      <Field label="Ownership">
        <InfoPicker
          options={OWNERSHIP_OPTIONS}
          value={marker.ownership}
          placeholder="None"
          clearLabel="None"
          ariaLabel="Ownership"
          onChange={(ownership) => onUpdate({ ownership })}
        />
      </Field>
      <Field label="Layer">
        <InfoPicker
          options={layers.map((l) => ({ value: l.id, label: l.name }))}
          value={marker.layerId}
          placeholder="Layer"
          ariaLabel="Layer"
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
        <span className="field-label">Status</span>
        <div className="tag-toggle-grid">
          {STATUS_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={marker.statusTags.includes(tag) ? "tag-toggle active" : "tag-toggle"}
              aria-pressed={marker.statusTags.includes(tag)}
              onClick={() => toggleStatus(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </MarkerCard>
  );
}
