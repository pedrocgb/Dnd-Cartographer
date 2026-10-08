"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Crosshair, ExternalLink, GitFork, Network, X } from "lucide-react";
import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";
import { Skeleton } from "@/components/Skeleton";
import { webEdges } from "@/server/relations/graph";
import { RELATION_GROUPS, type RelationGroup } from "@/server/relations/types";
import RelationsLegend from "./RelationsLegend";
import { useHideSecrets, useRelations } from "./relations-context";
import { useDefaultCalendar } from "./use-default-calendar";
import { useWebGraph } from "./web-graph";
import { GROUP_COLORS, HideSecretsSwitch, Inspector, RailHeader, RailSection, RailSwitch, RelWorkspace, StageEmpty } from "./workspace";
import WorldDatePicker from "@/components/calendars/WorldDatePicker";
import { useT } from "@/i18n/useT";
import { templateLabel } from "@/server/articles/templates";

const RelationsCanvas = dynamic(() => import("./RelationsCanvas"), { ssr: false, loading: () => <Skeleton height="100%" radius="0" /> });

const HUBS = 5;

/**
 * The world's relationship web: every tie between articles (relations plus,
 * optionally, what other information implies), filterable by group, date
 * and kind of article. Pick a focus to see its neighborhood instead; click a
 * card to inspect its ties.
 */
export default function RelationsPage({ focusId, onFocus }: { focusId: string | null; onFocus: (id: string | null) => void }) {
  const t = useT("relations");
  const ta = useT("articles");
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
        .map((e) => ({ value: e.id, label: e.name, group: templateLabel(e.template, ta) })),
    [catalog, ta]
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
        title={t("web.title")}
        subtitle={graph.tooMany ? t("web.tooMany", { n: graph.tooMany }) : `${t("web.articles", { count: graph.cards.length })} · ${t("ui.ties", { count: shownEdges.length })}`}
      />
      <RailSection title={t("web.focus")} action={focus && <button type="button" className="btn-link" onClick={() => onFocus(null)}>{t("ui.whole")}</button>}>
        <InfoPicker options={options} value={focus} placeholder={t("ui.whole")} clearLabel={t("ui.whole")} ariaLabel={t("web.focus")} collapsibleGroups onChange={onFocus} />
        {focus && (
          <label className="rel-range">
            <span>{t("web.reach", { count: depth })}</span>
            <input type="range" min={1} max={4} value={depth} onChange={(e) => setDepth(Number(e.target.value))} />
          </label>
        )}
      </RailSection>
      <RailSection title={t("web.kinds")} action={groups.length > 0 && <button type="button" className="btn-link" onClick={() => setGroups([])}>{t("ui.all")}</button>}>
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
      <RailSection title={t("web.show")}>
        <RailSwitch label={t("ui.fromOtherInfo")} hint={t("ui.fromOtherInfoHint")} checked={showDerived} onChange={setShowDerived} />
        <RailSwitch label={t("web.otherLinks")} hint={t("web.otherLinksHint")} checked={showLinked} disabled={!showDerived} onChange={setShowLinked} />
        <RailSwitch label={t("ui.colorByAttitude")} hint={t("ui.colorByAttitudeHint")} checked={attitudeMode} onChange={setAttitudeMode} />
        <HideSecretsSwitch />
      </RailSection>
      {calendar && (
        <RailSection title={t("web.pointInTime")} action={asOfDay !== null && <button type="button" className="btn-link" onClick={() => setAsOfDay(null)}>{t("web.anyDate")}</button>}>
          {asOfDay === null ? (
            <button type="button" className="btn btn-sm rel-rail-btn" onClick={() => setAsOfDay(calendar.currentDay)} data-tooltip={t("web.inForceHint")}>
              {t("web.inForce")}
            </button>
          ) : (
            <WorldDatePicker def={calendar.def} label={t("web.asOf")} value={asOfDay} currentDay={calendar.currentDay} onChange={setAsOfDay} />
          )}
        </RailSection>
      )}
      {hubs.length > 1 && (
        <RailSection title={t("web.mostConnected")}>
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
      <p className="rel-rail-tip">{t("web.tip")}</p>
    </>
  );

  return (
    <RelWorkspace rail={rail}>
      {graph.tooMany > 0 ? (
        <StageEmpty Icon={Network} title={t("web.tooManyTitle")}>
          {t("web.tooManyBody", { n: graph.tooMany })}
        </StageEmpty>
      ) : graph.cards.length === 0 ? (
        <StageEmpty Icon={Network} title={relations.length ? t("web.nothingMatches") : t("web.noneYet")}>
          {relations.length ? t("web.noMatchBody") : t("web.noneBody")}
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
            <summary>{t("ui.legend")}</summary>
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
                    <ExternalLink size={13} /> {t("ui.open")}
                  </button>
                  {focus !== selectedEntry.id && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => onFocus(selectedEntry.id)} data-tooltip={t("web.centerHint")}>
                      <Crosshair size={13} /> {t("web.centerHere")}
                    </button>
                  )}
                  {isPerson && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => openFamily(selectedEntry.id)}>
                      <GitFork size={13} /> {t("web.family")}
                    </button>
                  )}
                </>
              }
            />
          )}
          {focus && (
            <div className="rel-focus-pill">
              <Crosshair size={13} aria-hidden /> {catalog.get(focus)?.name}
              <button type="button" onClick={() => onFocus(null)} aria-label={t("web.showWhole")} data-tooltip={t("ui.whole")}>
                <X size={12} />
              </button>
            </div>
          )}
        </>
      )}
    </RelWorkspace>
  );
}
