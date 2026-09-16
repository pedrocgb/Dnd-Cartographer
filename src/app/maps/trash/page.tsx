"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

interface TrashedMap {
  id: string;
  name: string;
  deletedAt: string | null;
}

function loadTrash(): Promise<TrashedMap[]> {
  return fetch("/api/maps?trash=true")
    .then((r) => r.json())
    .then((d) => d.maps.filter((m: TrashedMap) => m.deletedAt));
}

export default function TrashPage() {
  const [maps, setMaps] = useState<TrashedMap[] | null>(null);

  useEffect(() => {
    loadTrash().then(setMaps);
  }, []);

  function restore(id: string) {
    fetch(`/api/maps/${id}/restore`, { method: "POST" })
      .then(loadTrash)
      .then(setMaps);
  }

  if (!maps) return <div className="map-status">Loading…</div>;

  return (
    <div className="map-manager">
      <h1>Trash</h1>
      {maps.length === 0 ? (
        <p className="map-status" style={{ padding: 0 }}>
          Nothing in the trash.
        </p>
      ) : (
        <ul className="map-tree-root">
          {maps.map((m) => (
            <li key={m.id} className="map-tree-row">
              <span style={{ fontWeight: 600 }}>{m.name}</span>
              <span className="map-pill-tag">
                deleted {m.deletedAt ? new Date(m.deletedAt).toLocaleString() : ""}
              </span>
              <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={() => restore(m.id)}>
                <RotateCcw size={14} strokeWidth={2.25} />
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
