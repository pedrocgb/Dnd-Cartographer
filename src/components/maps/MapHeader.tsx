"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Compass, Map as MapIcon, Network } from "lucide-react";

interface Crumb {
  id: string;
  name: string;
}

/** "Child maps (n)": a small menu of the maps nested under this one. */
function ChildMapsMenu({ items }: { items: Crumb[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="map-header-children" ref={rootRef}>
      <button type="button" className="btn btn-sm btn-ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Network size={13} strokeWidth={2.25} />
        Child maps ({items.length})
        <ChevronDown size={13} strokeWidth={2.25} />
      </button>
      {open && (
        <div className="info-menu map-header-menu" role="menu">
          <div className="info-menu-list">
            {[...items]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((child) => (
                <Link key={child.id} href={`/maps/${child.id}`} role="menuitem" className="info-menu-option map-header-menu-item" onClick={() => setOpen(false)}>
                  <Compass size={14} strokeWidth={2.25} aria-hidden />
                  <span className="info-menu-option-label">{child.name}</span>
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The map page's top bar: where this map sits (Maps › parents › this map,
 * with its category) and, when it has any, a menu of its child maps.
 */
export default function MapHeader({ trail, category, childMaps }: { trail: Crumb[]; category: string | null; childMaps: Crumb[] }) {
  const current = trail.at(-1);
  const ancestors = trail.slice(0, -1);
  return (
    <header className="map-header">
      <nav className="map-header-trail" aria-label="Breadcrumb">
        <Link href="/maps" className="map-header-crumb">
          <MapIcon size={14} strokeWidth={2.25} aria-hidden />
          Maps
        </Link>
        {ancestors.map((entry) => (
          <span key={entry.id} className="map-header-step">
            <ChevronRight size={13} strokeWidth={2.25} className="map-header-sep" aria-hidden />
            <Link href={`/maps/${entry.id}`} className="map-header-crumb">
              {entry.name}
            </Link>
          </span>
        ))}
        {current && (
          <span className="map-header-step">
            <ChevronRight size={13} strokeWidth={2.25} className="map-header-sep" aria-hidden />
            <span className="map-header-current" aria-current="page">
              <Compass size={15} strokeWidth={2.25} aria-hidden />
              {current.name}
            </span>
          </span>
        )}
        {category && <span className="map-pill-tag">{category}</span>}
      </nav>
      {childMaps.length > 0 && <ChildMapsMenu items={childMaps} />}
    </header>
  );
}
