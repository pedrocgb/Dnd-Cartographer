"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ExternalLink, GitFork, Minus, Network, Plus } from "lucide-react";
import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";
import { Skeleton } from "@/components/Skeleton";
import { templateOf } from "@/components/articles/templates";
import { useT } from "@/i18n/useT";
import { layoutFamily } from "@/server/relations/family";
import { webEdges } from "@/server/relations/graph";
import type { CanvasCard, CanvasLine } from "./RelationsCanvas";
import { useHideSecrets, useRelations } from "./relations-context";
import { HideSecretsSwitch, Inspector, RailHeader, RailSection, RailSwitch, RelWorkspace, StageEmpty } from "./workspace";

const RelationsCanvas = dynamic(() => import("./RelationsCanvas"), { ssr: false, loading: () => <Skeleton height="100%" radius="0" /> });

const MAX_GENERATIONS = 6;

/** Player characters first, then characters; each by name. */
const PERSON_ORDER: Record<string, number> = { playerCharacter: 0, character: 1 };

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const t = useT("relations");
  return (
    <div className="rel-stepper">
      <span>{label}</span>
      <button type="button" className="rel-icon-btn" onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0} aria-label={t("family.fewer", { label })}>
        <Minus size={13} />
      </button>
      <strong aria-live="polite">{value}</strong>
      <button type="button" className="rel-icon-btn" onClick={() => onChange(Math.min(MAX_GENERATIONS, value + 1))} disabled={value === MAX_GENERATIONS} aria-label={t("family.more", { label })}>
        <Plus size={13} />
      </button>
    </div>
  );
}

/**
 * A character's family tree: parents above, children below, partners side
 * by side, houses by color. The family view shows a few generations around
 * them with everyone's partners; the bloodline view follows blood only, as
 * far as it goes, with partners faint.
 */
export default function FamilyTreePage({ personId, bloodline, onChange }: { personId: string | null; bloodline: boolean; onChange: (personId: string | null, bloodline: boolean) => void }) {
  const t = useT("relations");
  const { relations, catalog, openArticle, openWeb } = useRelations();
  const [hideSecrets] = useHideSecrets();
  const [up, setUp] = useState(2);
  const [down, setDown] = useState(2);
  const [inLaws, setInLaws] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const people = useMemo<PickerOption[]>(
    () =>
      [...catalog.values()]
        .filter((e) => e.template in PERSON_ORDER)
        .sort((a, b) => PERSON_ORDER[a.template] - PERSON_ORDER[b.template] || a.name.localeCompare(b.name))
        .map((e) => ({ value: e.id, label: e.name, group: templateOf(e.template).plural })),
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

  const personCount = cards.filter((c) => c.kind === "record").length;
  const generations = tree ? new Set(tree.nodes.filter((n) => n.kind === "person").map((n) => n.generation)).size : 0;
  const houses = useMemo(() => {
    const ids = new Set(cards.flatMap((c) => (c.kind === "record" && c.entry.houseId ? [c.entry.houseId] : [])));
    return [...ids].flatMap((id) => {
      const house = catalog.get(id);
      return house ? [{ id, name: house.name, color: house.color }] : [];
    });
  }, [cards, catalog]);
  const familyEdges = useMemo(() => webEdges(catalog, relations, [], { hideSecrets, groups: ["family"], showDerived: false }), [catalog, relations, hideSecrets]);
  const selectedEntry = selected && cards.some((c) => c.id === selected) ? catalog.get(selected) : undefined;

  const rail = (
    <>
      <RailHeader Icon={GitFork} title={t("family.title")} subtitle={focus ? `${t("family.people", { count: personCount })} · ${t("family.generations", { count: generations })}` : t("family.subtitle")} />
      <RailSection title={t("family.whose")}>
        <InfoPicker options={people} value={focus} placeholder={t("family.pick")} ariaLabel={t("family.character")} onChange={(id) => onChange(id, bloodline)} />
      </RailSection>
      <RailSection title={t("family.view")}>
        <div className="rel-segmented" role="radiogroup" aria-label={t("family.kind")}>
          <button type="button" role="radio" aria-checked={!bloodline} className={!bloodline ? "active" : undefined} onClick={() => onChange(focus, false)} data-tooltip={t("family.familyHint")}>
            {t("family.family")}
          </button>
          <button type="button" role="radio" aria-checked={bloodline} className={bloodline ? "active" : undefined} onClick={() => onChange(focus, true)} data-tooltip={t("family.bloodlineHint")}>
            {t("family.bloodline")}
          </button>
        </div>
        {bloodline ? (
          <RailSwitch label={t("family.showPartners")} hint={t("family.showPartnersHint")} checked={inLaws} onChange={setInLaws} />
        ) : (
          <>
            <Stepper label={t("family.up")} value={up} onChange={setUp} />
            <Stepper label={t("family.down")} value={down} onChange={setDown} />
          </>
        )}
        <HideSecretsSwitch />
      </RailSection>
      {houses.length > 0 && (
        <RailSection title={t("family.houses")}>
          <ul className="rel-houses">
            {houses.map((h) => (
              <li key={h.id}>
                <span className="rel-house-swatch" style={{ background: h.color ?? "transparent" }} aria-hidden />
                <button type="button" className="btn-link" onClick={() => openArticle("organization", h.id)}>
                  {h.name}
                </button>
                {!h.color && <span className="rel-muted" data-tooltip={t("family.noColorHint")}>{t("family.noColor")}</span>}
              </li>
            ))}
          </ul>
        </RailSection>
      )}
      <RailSection title={t("family.lines")}>
        <ul className="rel-key">
          <li>
            <span className="rel-key-line" style={{ borderColor: "#D4A24C" }} /> {t("family.lineParent")}
          </li>
          <li>
            <span className="rel-key-line" style={{ borderColor: "#E879A6" }} /> {t("family.linePartners")}
          </li>
          <li>
            <span className="rel-key-line dotted" style={{ borderColor: "#D4A24C" }} /> {t("family.lineAdoptive")}
          </li>
          <li>
            <span className="rel-key-line dotted" style={{ borderColor: "#6B7280" }} /> {t("family.lineCoParents")}
          </li>
        </ul>
      </RailSection>
      <p className="rel-rail-tip">{t("family.tip")}</p>
    </>
  );

  return (
    <RelWorkspace rail={rail}>
      {!focus ? (
        <StageEmpty Icon={GitFork} title={t("family.pickTitle")}>
          {t("family.pickBody")}
        </StageEmpty>
      ) : cards.length <= 1 ? (
        <StageEmpty Icon={GitFork} title={t("family.noneTitle")}>
          {t("family.noneBody", { name: catalog.get(focus)?.name ?? "" })}
        </StageEmpty>
      ) : (
        <>
          <RelationsCanvas
            key={[focus, bloodline, up, down, inLaws, ...cards.map((c) => `${c.id}@${c.position.x},${c.position.y}`)].join("|")}
            cards={cards}
            lines={lines}
            highlightId={selectedEntry ? selected : null}
            onOpen={(e) => openArticle(e.template, e.id)}
            onFocus={(id) => onChange(id, bloodline)}
            onSelect={setSelected}
          />
          {selectedEntry && (
            <Inspector
              entry={selectedEntry}
              edges={familyEdges}
              onSelect={setSelected}
              onClose={() => setSelected(null)}
              actions={
                <>
                  <button type="button" className="btn btn-sm" onClick={() => openArticle(selectedEntry.template, selectedEntry.id)}>
                    <ExternalLink size={13} /> {t("ui.open")}
                  </button>
                  {selectedEntry.id !== focus && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange(selectedEntry.id, bloodline)}>
                      <GitFork size={13} /> {t("family.theirTree")}
                    </button>
                  )}
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => openWeb(selectedEntry.id)}>
                    <Network size={13} /> {t("family.web")}
                  </button>
                </>
              }
            />
          )}
        </>
      )}
    </RelWorkspace>
  );
}
