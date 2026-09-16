"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import DescriptionSection from "./DescriptionSection";

interface Category {
  id: string;
  label: string;
}

export interface MapSettingsStatus {
  map: {
    id: string;
    name: string;
    parentId: string | null;
    categoryId: string | null;
    descriptionDocumentId: string | null;
  };
}

export default function MapSettingsModal({
  open,
  onClose,
  status,
  mapId,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  status: MapSettingsStatus;
  mapId: string;
  onChanged: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allMaps, setAllMaps] = useState<{ id: string; name: string }[]>([]);
  // Lazily seeded from the first load only — polling refreshes stop once the
  // asset is ready, so this won't fight with in-progress local edits.
  const [name, setName] = useState(() => status.map.name);

  useEffect(() => {
    if (!open) return;
    fetch("/api/map-categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories));
    fetch("/api/maps")
      .then((r) => r.json())
      .then((d) => setAllMaps(d.maps.filter((m: { id: string }) => m.id !== mapId)));
  }, [open, mapId]);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/maps/${mapId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) onChanged();
    return res;
  }

  return (
    <Modal open={open} onClose={onClose} title="Map settings">
      <label className="field-label" htmlFor="settings-map-name">
        Map name
      </label>
      <input
        id="settings-map-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== status.map.name && patch({ name })}
      />

      <label className="field-label" htmlFor="settings-map-category">
        Category
      </label>
      <select
        id="settings-map-category"
        value={status.map.categoryId ?? ""}
        onChange={(e) => patch({ categoryId: e.target.value || null })}
      >
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>

      <label className="field-label" htmlFor="settings-map-parent">
        Parent map
      </label>
      <select
        id="settings-map-parent"
        value={status.map.parentId ?? ""}
        onChange={(e) => patch({ parentId: e.target.value || null })}
      >
        <option value="">No parent (root)</option>
        {allMaps.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      <label className="field-label">Description</label>
      <DescriptionSection
        documentId={status.map.descriptionDocumentId}
        editable
        onDocumentCreated={(id) => patch({ descriptionDocumentId: id })}
      />
    </Modal>
  );
}
