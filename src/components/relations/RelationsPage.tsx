"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Eye, EyeOff, Network, X } from "lucide-react";
import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";
import { Skeleton } from "@/components/Skeleton";
import { TEMPLATE_LABELS } from "@/server/articles/templates";
import { webEdges } from "@/server/relations/graph";
import { RELATION_GROUPS, type RelationGroup } from "@/server/relations/types";
import RelationsLegend from "./RelationsLegend";
import { useHideSecrets, useRelations } from "./relations-context";
import { useDefaultCalendar } from "./use-default-calendar";
import { useWebGraph } from "./web-graph";
import WorldDatePicker from "@/components/calendars/WorldDatePicker";

const RelationsCanvas = dynamic(() => import("./RelationsCanvas"), { ssr: false, loading: () => <Skeleton height="100%" radius="var(--radius-md)" /> });

/**
 * The world's relationship web: every tie between articles (relations plus,
 * optionally, what other information implies), filterable by group, date
 * and kind of article. Pick a focus to see its neighborhood instead.
 */
export default function RelationsPage({ focusId, onFocus }: { focusId: string | null; onFocus: (id: string | null) => void }) {
  const { relations, derived, catalog, openArticle } = useRelations();
  const [hideSecrets, setHideSecrets] = useHideSecrets();
  const [groups, setGroups] = useState<RelationGroup[]>([]);
  const [showDerived, setShowDerived] = useState(true);
  const [showLinked, setShowLinked] = useState(false);
  const [attitudeMode, setAttitudeMode] = useState(false);
  const [depth, setDepth] = useState(2);
  const [asOfDay, setAsOfDay] = useState<number | null>(null);
  const calendar = useDefaultCalendar();

  const edges = useMemo(
    () => webEdges(catalog, relations, derived, { hideSecrets, groups, showDerived, showLinked, asOfDay }),
    [catalog, relations, derived, hideSecrets, groups, showDerived, showLinked, asOfDay]
  );
  const focus = focusId && catalog.has(focusId) ? focusId : null;
  const graph = useWebGraph(focus, depth, edges);
  const options = useMemo<PickerOption[]>(
    () =>
      [...catalog.values()]
        .sort((a, b) => a.template.localeCompare(b.template) || a.name.localeCompare(b.name))
        .map((e) => ({ value: e.id, label: e.name, group: TEMPLATE_LABELS[e.template] })),
    [catalog]
  );
  const toggleGroup = (g: RelationGroup) => setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  const key = [focus, depth, ...graph.cards.map((c) => c.id)].join("|");

  return (
    <div className="rel-page">
      <header className="rel-page-header">
        <h1>
          <Network size={20} strokeWidth={2.25} aria-hidden /> Relationships
        </h1>
        <div className="rel-toolbar">
          <InfoPicker options={options} value={focus} placeholder="Focus on…" clearLabel="Whole world" ariaLabel="Focus" collapsibleGroups onChange={onFocus} />
          {focus && (
            <label className="rel-field rel-depth">
              <span className="field-label">Hops: {depth}</span>
              <input type="range" min={1} max={4} value={depth} onChange={(e) => setDepth(Number(e.target.value))} />
            </label>
          )}
          <button type="button" className={hideSecrets ? "btn btn-sm active" : "btn btn-sm"} aria-pressed={hideSecrets} onClick={() => setHideSecrets(!hideSecrets)} data-tooltip="Hide secret ties everywhere (for sharing your screen)">
            {hideSecrets ? <EyeOff size={14} /> : <Eye size={14} />} {hideSecrets ? "Secrets hidden" : "Hide secrets"}
          </button>
        </div>
        <div className="rel-toolbar">
          {RELATION_GROUPS.map((g) => (
            <button key={g.key} type="button" className={groups.includes(g.key) ? "rel-chip active" : "rel-chip"} aria-pressed={groups.includes(g.key)} onClick={() => toggleGroup(g.key)}>
              {g.label}
            </button>
          ))}
          <label className="cal-check">
            <input type="checkbox" checked={showDerived} onChange={(e) => setShowDerived(e.target.checked)} /> From other information
          </label>
          <label className="cal-check" data-tooltip="Every other link in the Info Bars (headquarters, birthplace, …)">
            <input type="checkbox" checked={showLinked} disabled={!showDerived} onChange={(e) => setShowLinked(e.target.checked)} /> Other links
          </label>
          <label className="cal-check" data-tooltip="Color ties by attitude, from hostile (red) to devoted (green)">
            <input type="checkbox" checked={attitudeMode} onChange={(e) => setAttitudeMode(e.target.checked)} /> Attitude colors
          </label>
          {calendar &&
            (asOfDay === null ? (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAsOfDay(calendar.currentDay)} data-tooltip="Only ties in force on a given in-world day">
                As of a date…
              </button>
            ) : (
              <span className="rel-date">
                <span className="field-label">As of</span>
                <WorldDatePicker def={calendar.def} label="As of" value={asOfDay} currentDay={calendar.currentDay} onChange={setAsOfDay} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsOfDay(null)} aria-label="Any date" data-tooltip="Any date">
                  <X size={13} />
                </button>
              </span>
            ))}
        </div>
      </header>
      <RelationsLegend edges={edges} attitudeMode={attitudeMode} />
      <div className="rel-canvas">
        {graph.tooMany > 0 ? (
          <p className="cal-help rel-empty">{graph.tooMany} tied articles are too many to draw at once. Pick a focus, or narrow the groups.</p>
        ) : graph.cards.length === 0 ? (
          <p className="cal-help rel-empty">{relations.length ? "No tie matches these filters." : "No relationships yet. Add some from an article's Relationships card, or its Info Bar (Parents, Allies, …)."}</p>
        ) : (
          <RelationsCanvas key={key} cards={graph.cards} lines={graph.lines} attitudeMode={attitudeMode} onOpen={(e) => openArticle(e.template, e.id)} onFocus={onFocus} />
        )}
      </div>
      <p className="cal-help">Click a card to open its article; Shift-click to center the web on it.</p>
    </div>
  );
}
