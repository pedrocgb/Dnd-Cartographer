"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { SearchResult } from "@/app/api/search/route";

export default function SearchBox() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      const timer = setTimeout(() => setResults([]), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => {
          setResults(d.results);
          setOpen(true);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="search-box" ref={containerRef}>
      <div className="search-box-field">
        <Search size={15} strokeWidth={2.25} aria-hidden="true" />
        <input
          type="text"
          placeholder="Search maps & markers…"
          aria-label="Search maps and markers"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
      </div>
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((r) => (
            <Link
              key={`${r.type}-${r.id}`}
              href={r.type === "map" ? `/maps/${r.id}` : `/maps/${r.mapId}?marker=${r.id}`}
              className="search-result-row"
              onClick={() => setOpen(false)}
            >
              <span className="search-result-type">{r.type}</span>
              <span>{r.name}</span>
              {r.type === "marker" && <span className="search-result-context">on {r.mapName}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
