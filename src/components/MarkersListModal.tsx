"use client";

import { useMemo, useState } from "react";
import Modal from "./Modal";
import { RawIcon } from "./MarkerIcon";
import type { Marker } from "./MarkerLayer";

export default function MarkersListModal({
  open,
  onClose,
  markers,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  markers: Marker[];
  onSelect: (markerId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return markers;
    const q = search.toLowerCase();
    return markers.filter((m) => m.name.toLowerCase().includes(q));
  }, [markers, search]);

  return (
    <Modal open={open} onClose={onClose} title="Markers on this map">
      <input
        type="text"
        placeholder="Search markers…"
        aria-label="Search markers"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      {filtered.length === 0 ? (
        <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
          {markers.length === 0 ? "No markers on this map yet." : "No markers match your search."}
        </p>
      ) : (
        <ul className="marker-list">
          {filtered.map((m) => (
            <li key={m.id}>
              <button
                className="marker-list-row"
                onClick={() => {
                  onSelect(m.id);
                  onClose();
                }}
              >
                <span className="marker-list-icon" style={{ color: m.color }}>
                  <RawIcon iconKey={m.iconKey} size={16} />
                </span>
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
