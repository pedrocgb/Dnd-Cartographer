"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MapPlus } from "lucide-react";

interface Option {
  id: string;
  name?: string;
  label?: string;
}

export default function NewMapPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [parentId, setParentId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<Option[]>([]);
  const [maps, setMaps] = useState<Option[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/map-categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories));
    fetch("/api/maps")
      .then((r) => r.json())
      .then((d) => setMaps(d.maps));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const mapRes = await fetch("/api/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          categoryId: categoryId || null,
          parentId: parentId || null,
        }),
      });
      if (!mapRes.ok) throw new Error((await mapRes.json()).error ?? "Failed to create map.");
      const { map } = await mapRes.json();

      if (file) {
        const uploadRes = await fetch(`/api/maps/${map.id}/assets`, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadRes.ok) throw new Error((await uploadRes.json()).error ?? "Upload failed.");
      }

      router.push(`/maps/${map.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form className="upload-form" onSubmit={submit}>
      <h1>New map</h1>
      <label className="field-label" htmlFor="new-map-name">
        Map name
      </label>
      <input
        id="new-map-name"
        type="text"
        placeholder="e.g. The Sundered Coast"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <label className="field-label" htmlFor="new-map-category">
        Category
      </label>
      <select id="new-map-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <label className="field-label" htmlFor="new-map-parent">
        Parent map
      </label>
      <select id="new-map-parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
        <option value="">No parent (root map)</option>
        {maps.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <label className="field-label" htmlFor="new-map-file">
        Map artwork (optional)
      </label>
      <input
        id="new-map-file"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button type="submit" className="btn btn-primary" disabled={busy}>
        <MapPlus size={15} strokeWidth={2.25} />
        {busy ? "Creating…" : "Create map"}
      </button>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
