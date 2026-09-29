"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Crosshair, ExternalLink, GitFork, Network, X } from "lucide-react";
import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";
import { Skeleton } from "@/components/Skeleton";
import { TEMPLATE_LABELS } from "@/server/articles/templates";
import { webEdges } from "@/server/relations/graph";
import { RELATION_GROUPS, type RelationGroup } from "@/server/relations/types";
import RelationsLegend from "./RelationsLegend";
import { useHideSecrets, useRelations } from "./relations-context";
import { useDefaultCalendar } from "./use-default-calendar";
import { useWebGraph } from "./web-graph";
import { GROUP_COLORS, HideSecretsSwitch, Inspector, RailHeader, RailSection, RailSwitch, RelWorkspace, StageEmpty } from "./workspace";
import WorldDatePicker from "@/components/calendars/WorldDatePicker";

const RelationsCanvas = dynamic(() => import("./RelationsCanvas"), { ssr: false, loading: () => <Skeleton height="100%" radius="0" /> });

const HUBS = 5;

/**
 * The world's relationship web: every tie between articles (relations plus,
 * optionally, what other information implies), filterable by group, date
 * and kind of article. Pick a focus to see its neighborhood instead; click a
 * card to inspect its ties.
 */
export default function RelationsPage({ focusId, onFocus }: { focusId: string | null; onFocus: (id: string | null) => void }) {
  const { relations, derived, catalog, openArticle, openFamily } = useRelations();
  const [hideSecrets] = useHideSecrets();
  const [groups, setGroups] = useState<RelationGroup[]>([]);
  const [showDerived, setShowDerived] = useState(true);
  const [showLinked, setShowLinked] = useState(false);
  const [attitudeMode, setAttitudeMode] = useState(false);
  const [depth, setDepth] = useState(2);
  const [asOfDay, setAsOfDay] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const calendar = useDefaultCalendar();

  // Every tie the other filters keep, for the group counts.
  const allEdges = useMemo(
    () => webEdges(catalog, relations, derived, { hideSecrets, showDerived, showLinked, asOfDay }),
    [catalog, relations, derived, hideSecrets, showDerived, showLinked, asOfDay]
  );
  const edges = useMemo(() => (groups.length ? allEdges.filter((e) => e.group === "derived" || groups.includes(e.group)) : allEdges), [allEdges, groups]);
  const focus = focusId && catalog.has(focusId) ? focusId : null;
  const graph = useWebGraph(focus, depth, edges);
  const shownEdges = useMemo(() => graph.lines.flatMap((l) => (l.kind === "graph" ? [l.edge] : [])), [graph.lines]);

  const options = useMemo<PickerOption[]>(
    () =>
      [...catalog.values()]
        .sort((a, b) => a.template.localeCompare(b.template) || a.name.localeCompare(b.name))
        .map((e) => ({ value: e.id, label: e.name, group: TEMPLATE_LABELS[e.template] })),
    [catalog]
  );
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of allEdges) c.set(e.group, (c.get(e.group) ?? 0) + 1);
    return c;
  }, [allEdges]);
  const hubs = useMemo(() => {
    const degree = new Map<string, number>();
    for (const e of shownEdges) for (const id of [e.fromId, e.toId]) degree.set(id, (degree.get(id) ?? 0) + 1);
    return [...degree.entries()].sort((a, b) => b[1] - a[1] || (catalog.get(a[0])?.name ?? "").localeCompare(catalog.get(b[0])?.name ?? "")).slice(0, HUBS);
  }, [shownEdges, catalog]);

  const toggleGroup = (g: RelationGroup) => setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  const key = [focus, depth, ...graph.cards.map((c) => c.id)].join("|");
  const selectedEntry = selected && graph.cards.some((c) => c.id === selected) ? catalog.get(selected) : undefined;
  const isPerson = selectedEntry && (selectedEntry.template === "character" || selectedEntry.template === "playerCharacter");

  const rail = (
    <>
      <RailHeader
        Icon={Network}
        title="Relationships"
        subtitle={
          graph.tooMany ? `${graph.tooMany} tied articles` : `${graph.cards.length} ${graph.cards.length === 1 ? "article" : "articles"} · ${shownEdges.length} ${shownEdges.length === 1 ? "tie" : "ties"}`
        }
      />
      <RailSection title="Focus" action={focus && <button type="button" className="btn-link" onClick={() => onFocus(null)}>Whole world</button>}>
        <InfoPicker options={options} value={focus} placeholder="Whole world" clearLabel="Whole world" ariaLabel="Focus" collapsibleGroups onChange={onFocus} />
        {focus && (
          <label className="rel-range">
            <span>
              Reach <strong>{depth}</strong> {depth === 1 ? "step" : "steps"}
            </span>
            <input type="range" min={1} max={4} value={depth} onChange={(e) => setDepth(Number(e.target.value))} />
          </label>
        )}
      </RailSection>
      <RailSection title="Kinds of ties" action={groups.length > 0 && <button type="button" className="btn-link" onClick={() => setGroups([])}>All</button>}>
        <div className="rel-chip-grid">
          {RELATION_GROUPS.map((g) => {
            const on = groups.includes(g.key);
            return (
              <button key={g.key} type="button" className={on ? "rel-filter-chip active" : "rel-filter-chip"} aria-pressed={on} onClick={() => toggleGroup(g.key)} style={{ ["--chip" as string]: GROUP_COLORS[g.key] }}>
                <span className="rel-dot" aria-hidden />
                {g.label}
                <span className="rel-chip-count">{counts.get(g.key) ?? 0}</span>
              </button>
            );
          })}
        </div>
      </RailSection>
      <RailSection title="Show">
        <RailSwitch label="From other information" hint="Houses, rulers, seats and territory parents" checked={showDerived} onChange={setShowDerived} />
        <RailSwitch label="Other Info Bar links" hint="Every other link in the Info Bars (headquarters, birthplace, …)" checked={showLinked} disabled={!showDerived} onChange={setShowLinked} />
        <RailSwitch label="Color by attitude" hint="From hostile (red) to devoted (green)" checked={attitudeMode} onChange={setAttitudeMode} />
        <HideSecretsSwitch />
      </RailSection>
      {calendar && (
        <RailSection title="Point in time" action={asOfDay !== null && <button type="button" className="btn-link" onClick={() => setAsOfDay(null)}>Any date</button>}>
          {asOfDay === null ? (
            <button type="button" className="btn btn-sm rel-rail-btn" onClick={() => setAsOfDay(calendar.currentDay)} data-tooltip="Only ties in force on a given in-world day">
              Only ties in force on…
            </button>
          ) : (
            <WorldDatePicker def={calendar.def} label="As of" value={asOfDay} currentDay={calendar.currentDay} onChange={setAsOfDay} />
          )}
        </RailSection>
      )}
      {hubs.length > 1 && (
        <RailSection title="Most connected">
          <ol className="rel-hubs">
            {hubs.map(([id, n]) => (
              <li key={id}>
                <button type="button" className={selected === id ? "active" : undefined} onClick={() => setSelected(id)}>
                  <span>{catalog.get(id)?.name}</span>
                  <span className="rel-chip-count">{n}</span>
                </button>
              </li>
            ))}
          </ol>
        </RailSection>
      )}
      <p className="rel-rail-tip">Hover a card to light up its ties. Click to inspect, double-click to open, Shift-click to center the web on it.</p>
    </>
  );

  return (
    <RelWorkspace rail={rail}>
      {graph.tooMany > 0 ? (
        <StageEmpty Icon={Network} title="Too many to draw at once">
          {graph.tooMany} tied articles. Pick a focus, or narrow the kinds of ties.
        </StageEmpty>
      ) : graph.cards.length === 0 ? (
        <StageEmpty Icon={Network} title={relations.length ? "Nothing matches" : "No relationships yet"}>
          {relations.length ? "No tie matches these filters." : "Add ties from an article's Relationships card, or its Info Bar (Parents, Allies, …)."}
        </StageEmpty>
      ) : (
        <>
          <RelationsCanvas
            key={key}
            cards={graph.cards}
            lines={graph.lines}
            attitudeMode={attitudeMode}
            highlightId={selectedEntry ? selected : null}
            onOpen={(e) => openArticle(e.template, e.id)}
            onFocus={onFocus}
            onSelect={setSelected}
          />
          <details className="rel-legend-panel" open>
            <summary>Legend</summary>
            <RelationsLegend edges={shownEdges} attitudeMode={attitudeMode} />
          </details>
          {selectedEntry && (
            <Inspector
              entry={selectedEntry}
              edges={shownEdges}
              onSelect={setSelected}
              onClose={() => setSelected(null)}
              actions={
                <>
                  <button type="button" className="btn btn-sm" onClick={() => openArticle(selectedEntry.template, selectedEntry.id)}>
                    <ExternalLink size={13} /> Open
                  </button>
                  {focus !== selectedEntry.id && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => onFocus(selectedEntry.id)} data-tooltip="Show only what's within reach of it">
                      <Crosshair size={13} /> Center here
                    </button>
                  )}
                  {isPerson && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => openFamily(selectedEntry.id)}>
                      <GitFork size={13} /> Family
                    </button>
                  )}
                </>
              }
            />
          )}
          {focus && (
            <div className="rel-focus-pill">
              <Crosshair size={13} aria-hidden /> {catalog.get(focus)?.name}
              <button type="button" onClick={() => onFocus(null)} aria-label="Show the whole world" data-tooltip="Whole world">
                <X size={12} />
              </button>
            </div>
          )}
        </>
      )}
    </RelWorkspace>
  );
}
