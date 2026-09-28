"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { GitFork } from "lucide-react";
import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";
import { Skeleton } from "@/components/Skeleton";
import { TEMPLATE_LABELS } from "@/server/articles/templates";
import { layoutFamily } from "@/server/relations/family";
import type { CanvasCard, CanvasLine } from "./RelationsCanvas";
import { useHideSecrets, useRelations } from "./relations-context";

const RelationsCanvas = dynamic(() => import("./RelationsCanvas"), { ssr: false, loading: () => <Skeleton height="100%" radius="var(--radius-md)" /> });

/**
 * A character's family tree: parents above, children below, partners side
 * by side, houses by color. The family view shows a few generations around
 * them with everyone's partners; the bloodline view follows blood only, as
 * far as it goes, with partners faint.
 */
export default function FamilyTreePage({ personId, bloodline, onChange }: { personId: string | null; bloodline: boolean; onChange: (personId: string | null, bloodline: boolean) => void }) {
  const { relations, catalog, openArticle } = useRelations();
  const [hideSecrets] = useHideSecrets();
  const [up, setUp] = useState(2);
  const [down, setDown] = useState(2);
  const [inLaws, setInLaws] = useState(true);

  const people = useMemo<PickerOption[]>(
    () =>
      [...catalog.values()]
        .filter((e) => e.template === "character" || e.template === "playerCharacter")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((e) => ({ value: e.id, label: e.name, group: TEMPLATE_LABELS[e.template] })),
    [catalog]
  );
  const focus = personId && catalog.has(personId) ? personId : null;

  const tree = useMemo(() => {
    if (!focus) return null;
    const family = relations.filter((r) => (r.type === "parent" || r.type === "spouse") && !(hideSecrets && r.secret) && catalog.has(r.fromId) && catalog.has(r.toId));
    return layoutFamily(focus, family, { bloodline, up, down, inLaws }, (id) => catalog.get(id)?.name ?? id);
  }, [focus, relations, catalog, hideSecrets, bloodline, up, down, inLaws]);

  const { cards, lines } = useMemo(() => {
    if (!tree) return { cards: [] as CanvasCard[], lines: [] as CanvasLine[] };
    const cards: CanvasCard[] = tree.nodes.flatMap((n): CanvasCard[] => {
      const position = { x: n.x, y: n.y };
      if (n.kind === "union") return [{ kind: "union", id: n.id, position, inferred: n.inferred }];
      if (n.kind === "unknown") return [{ kind: "unknown", id: n.id, position }];
      const entry = catalog.get(n.id);
      return entry ? [{ kind: "record", id: n.id, position, entry, faint: n.faint, focus: n.id === focus }] : [];
    });
    return { cards, lines: tree.lines.map((l): CanvasLine => ({ kind: "family", ...l })) };
  }, [tree, catalog, focus]);

  const houses = useMemo(() => {
    const ids = new Set(cards.flatMap((c) => (c.kind === "record" && c.entry.houseId ? [c.entry.houseId] : [])));
    return [...ids].flatMap((id) => {
      const house = catalog.get(id);
      return house ? [{ id, name: house.name, color: house.color }] : [];
    });
  }, [cards, catalog]);

  return (
    <div className="rel-page">
      <header className="rel-page-header">
        <h1>
          <GitFork size={20} strokeWidth={2.25} aria-hidden /> Family trees
        </h1>
        <div className="rel-toolbar">
          <InfoPicker options={people} value={focus} placeholder="Whose family?" ariaLabel="Character" onChange={(id) => onChange(id, bloodline)} />
          <div className="rel-tabs" role="tablist" aria-label="Tree kind">
            <button type="button" role="tab" aria-selected={!bloodline} className={!bloodline ? "rel-chip active" : "rel-chip"} onClick={() => onChange(focus, false)} data-tooltip="A few generations around them, with everyone's partners">
              Family
            </button>
            <button type="button" role="tab" aria-selected={bloodline} className={bloodline ? "rel-chip active" : "rel-chip"} onClick={() => onChange(focus, true)} data-tooltip="Every blood relative, as far back and down as known">
              Bloodline
            </button>
          </div>
          {bloodline ? (
            <label className="cal-check">
              <input type="checkbox" checked={inLaws} onChange={(e) => setInLaws(e.target.checked)} /> Show partners
            </label>
          ) : (
            <>
              <label className="rel-field rel-depth">
                <span className="field-label">Generations up: {up}</span>
                <input type="range" min={0} max={6} value={up} onChange={(e) => setUp(Number(e.target.value))} />
              </label>
              <label className="rel-field rel-depth">
                <span className="field-label">Generations down: {down}</span>
                <input type="range" min={0} max={6} value={down} onChange={(e) => setDown(Number(e.target.value))} />
              </label>
            </>
          )}
        </div>
      </header>
      {houses.length > 0 && (
        <ul className="rel-legend" aria-label="Houses">
          {houses.map((h) => (
            <li key={h.id}>
              <span className="info-color-swatch" style={{ background: h.color ?? "transparent" }} aria-hidden />
              {h.name}
              {!h.color && <span className="field-label">(no color: set one on its Info Bar)</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="rel-canvas">
        {!focus ? (
          <p className="cal-help rel-empty">Pick a character to see their family. Parents, children and partners come from their Info Bar or Relationships card.</p>
        ) : cards.length <= 1 ? (
          <p className="cal-help rel-empty">No family recorded for {catalog.get(focus)?.name} yet.</p>
        ) : (
          <RelationsCanvas
            key={[focus, bloodline, up, down, inLaws, ...cards.map((c) => `${c.id}@${c.position.x},${c.position.y}`)].join("|")}
            cards={cards}
            lines={lines}
            onOpen={(e) => openArticle(e.template, e.id)}
            onFocus={(id) => onChange(id, bloodline)}
          />
        )}
      </div>
      <p className="cal-help">Click a card to open its article; Shift-click to see that person&apos;s tree. Dotted lines: adoptive or step parents, or parents with no marriage recorded.</p>
    </div>
  );
}
