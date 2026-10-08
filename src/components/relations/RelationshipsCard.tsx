"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeftRight, ArrowRight, CalendarDays, ChevronDown, ChevronRight, Eye, EyeOff, GitFork, Lock, Network, Pin, Plus, Trash2, Waypoints, X } from "lucide-react";
import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";
import WorldDatePicker from "@/components/calendars/WorldDatePicker";
import { dayLabel } from "@/components/calendars/evaluate";
import type { CalendarDefinition } from "@/server/calendars/engine";
import { templateLabel, type ArticleTemplateKey } from "@/server/articles/templates";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";
import { derivedSiblings, webEdges } from "@/server/relations/graph";
import {
  ATTITUDE_MAX,
  ATTITUDE_MIN,
  labelFor,
  MAX_RELATION_LABEL,
  MAX_RELATION_NOTES,
  PARENT_KINDS,
  perspectiveOptions,
  RELATION_GROUPS,
  derivedLabel,
  relationType,
  SPOUSE_STATUSES,
  type RelationGroup,
} from "@/server/relations/types";
import { useHideSecrets, useRelations, type Relation } from "./relations-context";
import { useDefaultCalendar } from "./use-default-calendar";
import { useWebGraph } from "./web-graph";

const RelationsCanvas = dynamic(() => import("./RelationsCanvas"), { ssr: false });

/** The record's neighborhood as a small graph (1–3 hops). */
function MiniWeb({ recordId }: { recordId: string }) {
  const t = useT("relations");
  const { relations, derived, catalog, openArticle, openWeb } = useRelations();
  const [hideSecrets] = useHideSecrets();
  const [depth, setDepth] = useState(1);
  const edges = useMemo(() => webEdges(catalog, relations, derived, { hideSecrets }), [catalog, relations, derived, hideSecrets]);
  const graph = useWebGraph(recordId, depth, edges);
  return (
    <div className="rel-mini">
      <label className="rel-field rel-depth">
        <span className="field-label">{t("card.hops", { n: depth })}</span>
        <input type="range" min={1} max={3} value={depth} onChange={(e) => setDepth(Number(e.target.value))} />
      </label>
      <div className="rel-mini-canvas">
        {graph.cards.length <= 1 ? (
          <p className="cal-help rel-empty">{t("card.noTies")}</p>
        ) : (
          <RelationsCanvas key={`${depth}|${graph.cards.map((c) => c.id).join("|")}`} cards={graph.cards} lines={graph.lines} compact onOpen={(e) => openArticle(e.template, e.id)} onFocus={openWeb} />
        )}
      </div>
    </div>
  );
}

async function send(method: string, url: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.ok) return null;
  return (await res.json().catch(() => ({}))).error ?? activeT("relations")("card.couldNotSave");
}

/**
 * An article's relationships: every tie it has (pinned first, then by
 * group), editable in place, the read-only ties computed from other data
 * (house, rulers, seats, territory parent, siblings by shared parents), and
 * a row to add a new one.
 */
export default function RelationshipsCard({ recordId, template }: { recordId: string; template: ArticleTemplateKey }) {
  const t = useT("relations");
  const { relations, derived, catalog, openArticle, openWeb, openFamily, refresh } = useRelations();
  const [tab, setTab] = useState<"list" | "web">("list");
  const isPerson = template === "character" || template === "playerCharacter";
  const [hideSecrets, setHideSecrets] = useHideSecrets();
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const calendar = useDefaultCalendar();

  const mine = useMemo(
    () => relations.filter((r) => (r.fromId === recordId || r.toId === recordId) && !relationType(r.type)?.hidden && catalog.has(r.fromId === recordId ? r.toId : r.fromId) && !(hideSecrets && r.secret)),
    [relations, recordId, catalog, hideSecrets]
  );
  const computed = useMemo(() => {
    const rows = derived
      .filter((d) => d.kind !== "linked" && (d.fromId === recordId || d.toId === recordId))
      .map((d) => ({ id: d.id, otherId: d.fromId === recordId ? d.toId : d.fromId, label: d.fromId === recordId ? d.label : inverseDerived(d.kind, d.label) }));
    const explicit = new Set(mine.filter((r) => r.type === "sibling").map((r) => (r.fromId === recordId ? r.toId : r.fromId)));
    for (const s of derivedSiblings(relations, recordId)) {
      if (!explicit.has(s.id) && catalog.has(s.id)) rows.push({ id: `sibling:${s.id}`, otherId: s.id, label: s.full ? t("card.siblingFull") : t("card.siblingHalf") });
    }
    return rows;
  }, [derived, relations, recordId, mine, catalog, t]);

  const run = async (op: Promise<string | null>) => {
    const failed = await op;
    setError(failed);
    if (!failed) refresh();
  };

  const groups = RELATION_GROUPS.map((g) => ({ ...g, rows: mine.filter((r) => !r.pinned && relationType(r.type)?.group === g.key) })).filter((g) => g.rows.length);
  const pinned = mine.filter((r) => r.pinned);
  const nameOf = (id: string) => catalog.get(id)?.name ?? t("ui.removed");
  const open = (id: string) => {
    const entry = catalog.get(id);
    if (entry) openArticle(entry.template, id);
  };

  const renderRow = (r: Relation) => (
    <RelationRow
      key={r.id}
      relation={r}
      recordId={recordId}
      otherName={nameOf(r.fromId === recordId ? r.toId : r.fromId)}
      open={openId === r.id}
      calendar={calendar}
      onToggle={() => setOpenId(openId === r.id ? null : r.id)}
      onOpenOther={() => open(r.fromId === recordId ? r.toId : r.fromId)}
      onPatch={(patch) => void run(send("PATCH", `/api/relations/${r.id}`, patch))}
      onDelete={() => void run(send("DELETE", `/api/relations/${r.id}`))}
    />
  );

  return (
    <section className="article-card rel-card" aria-label={t("card.title")}>
      <header className="article-card-header">
        <span className="article-card-label">
          <Network size={15} strokeWidth={2.25} />
          {t("card.title")}
        </span>
        <div className="rel-tabs" role="tablist" aria-label={t("card.view")}>
          <button type="button" role="tab" aria-selected={tab === "list"} className={tab === "list" ? "rel-chip active" : "rel-chip"} onClick={() => setTab("list")}>
            {t("card.list")}
          </button>
          <button type="button" role="tab" aria-selected={tab === "web"} className={tab === "web" ? "rel-chip active" : "rel-chip"} onClick={() => setTab("web")}>
            {t("card.web")}
          </button>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => openWeb(recordId)} data-tooltip={t("card.openWebHint")}>
          <Waypoints size={14} /> {t("card.openWeb")}
        </button>
        {isPerson && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => openFamily(recordId)} data-tooltip={t("card.familyTreeHint")}>
            <GitFork size={14} /> {t("card.familyTree")}
          </button>
        )}
        <button
          type="button"
          className={hideSecrets ? "btn btn-sm btn-ghost active" : "btn btn-sm btn-ghost"}
          onClick={() => setHideSecrets(!hideSecrets)}
          aria-pressed={hideSecrets}
          data-tooltip={hideSecrets ? t("card.secretsHiddenHint") : t("card.hideSecretsHint")}
        >
          {hideSecrets ? <EyeOff size={14} /> : <Eye size={14} />}
          {hideSecrets ? t("secrets.hidden") : t("card.hideSecrets")}
        </button>
      </header>

      {tab === "web" && <MiniWeb recordId={recordId} />}
      {tab === "list" && mine.length === 0 && computed.length === 0 && <p className="article-card-placeholder">{t("card.none")}</p>}
      {tab === "list" && pinned.length > 0 && (
        <RelationGroupList label={t("card.pinned")} icon={<Pin size={12} />}>
          {pinned.map(renderRow)}
        </RelationGroupList>
      )}
      {tab === "list" && groups.map((g) => (
        <RelationGroupList key={g.key} label={g.label}>
          {g.rows.map(renderRow)}
        </RelationGroupList>
      ))}
      {tab === "list" && computed.length > 0 && (
        <RelationGroupList label={t("ui.fromOtherInfo")} icon={<Lock size={12} />}>
          {computed.map((c) => (
            <li key={c.id} className="rel-row rel-row-derived">
              <div className="rel-row-main">
                <span className="rel-row-label">{c.label}</span>
                <button type="button" className="politics-link-button" onClick={() => open(c.otherId)}>
                  {nameOf(c.otherId)}
                </button>
              </div>
            </li>
          ))}
        </RelationGroupList>
      )}

      <AddRelation recordId={recordId} template={template} onAdd={(body) => run(send("POST", "/api/relations", body))} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** An attitude with its sign ("+2", "-1", "0"). */
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** How a derived edge reads from its other end. */
function inverseDerived(kind: string, label: string): string {
  const t = activeT("relations");
  if (kind === "house") return t("card.houseOf");
  if (kind === "territoryParent") return t("card.liegeOf");
  if (kind === "rules") return t("card.ruledBy", { role: label });
  if (kind === "seat") return label === derivedLabel("capital") ? t("card.capital") : t("card.seat");
  return label;
}

function RelationGroupList({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rel-group">
      <h3 className="rel-group-title">
        {icon}
        {label}
      </h3>
      <ul className="rel-list">{children}</ul>
    </div>
  );
}

function RelationRow({
  relation: r,
  recordId,
  otherName,
  open,
  calendar,
  onToggle,
  onOpenOther,
  onPatch,
  onDelete,
}: {
  relation: Relation;
  recordId: string;
  otherName: string;
  open: boolean;
  calendar: { def: CalendarDefinition; currentDay: number } | null;
  onToggle: () => void;
  onOpenOther: () => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const t = useT("relations");
  const type = relationType(r.type);
  const [label, setLabel] = useState(r.label);
  const [notes, setNotes] = useState(r.notes);
  const span = [r.sinceDay, r.untilDay].some((d) => d !== null) && calendar
    ? `${r.sinceDay !== null ? dayLabel(calendar.def, r.sinceDay, { weekday: false, short: true }) : "…"} – ${r.untilDay !== null ? dayLabel(calendar.def, r.untilDay, { weekday: false, short: true }) : "…"}`
    : null;
  const detail = [r.parentKind && r.parentKind !== "biological" ? t(`parentKind.${r.parentKind}`) : null, r.spouseStatus && r.spouseStatus !== "unknown" ? t(`spouseStatus.${r.spouseStatus}`) : null].filter(Boolean).join(", ");

  return (
    <li className={["rel-row", r.secret && "rel-row-secret", open && "open"].filter(Boolean).join(" ")}>
      <div className="rel-row-main">
        <button type="button" className="rel-row-toggle" onClick={onToggle} aria-expanded={open} aria-label={open ? t("card.closeDetails") : t("card.editDetails")} data-tooltip={open ? t("ui.close") : t("card.editTie")}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <span className="rel-row-label" style={{ ["--rel-color" as string]: type?.color }}>
          {labelFor(r, recordId)}
          {r.label && r.type !== "custom" && <span className="field-label"> · {r.label}</span>}
        </span>
        <button type="button" className="politics-link-button" onClick={onOpenOther}>
          {otherName}
        </button>
        {detail && <span className="field-label">{detail}</span>}
        {span && <span className="field-label">{span}</span>}
        <span className="rel-row-badges">
          {r.attitude !== null && (
            <span className={r.attitude < 0 ? "rel-attitude neg" : "rel-attitude"} data-tooltip={t("card.attitude", { value: signed(r.attitude) })}>
              {r.attitude > 0 ? "+" : ""}
              {r.attitude}
            </span>
          )}
          {r.secret && (
            <span data-tooltip={t("card.secretTie")} aria-label={t("ui.secret")}>
              <EyeOff size={13} />
            </span>
          )}
          {r.pinned && (
            <span data-tooltip={t("card.pinnedFlag")} aria-label={t("card.pinnedFlag")}>
              <Pin size={13} />
            </span>
          )}
        </span>
      </div>
      {open && type && (
        <div className="rel-row-editor">
          <section className="rel-editor-section">
            <h4>{t("card.details")}</h4>
            <div className="rel-editor-grid">
              <label className="rel-field">
                <span className="field-label">{r.type === "custom" ? t("card.label") : t("card.extraWording")}</span>
                <input
                  type="text"
                  value={label}
                  maxLength={MAX_RELATION_LABEL}
                  placeholder={r.type === "custom" ? t("card.labelPlaceholder") : t("card.extraPlaceholder")}
                  onChange={(e) => setLabel(e.target.value)}
                  onBlur={() => label !== r.label && onPatch({ label })}
                />
                {r.type !== "custom" && <span className="rel-field-hint">{t("card.readsAs", { text: `${labelFor(r, recordId)} · ${label || "…"}` })}</span>}
              </label>
              {type.attrs?.includes("parentKind") && (
                <label className="rel-field">
                  <span className="field-label">{t("card.parent")}</span>
                  <InfoPicker options={PARENT_KINDS.map((k) => ({ value: k, label: t(`parentKind.${k}`) }))} value={r.parentKind} placeholder={t("parentKind.biological")} ariaLabel={t("card.parentKindLabel")} searchable={false} onChange={(v) => v && onPatch({ parentKind: v })} />
                </label>
              )}
              {type.attrs?.includes("spouseStatus") && (
                <label className="rel-field">
                  <span className="field-label">{t("card.status")}</span>
                  <InfoPicker options={SPOUSE_STATUSES.map((k) => ({ value: k, label: t(`spouseStatus.${k}`) }))} value={r.spouseStatus} placeholder={t("spouseStatus.unknown")} ariaLabel={t("card.status")} searchable={false} onChange={(v) => v && onPatch({ spouseStatus: v })} />
                </label>
              )}
            </div>
          </section>

          <section className="rel-editor-section">
            <h4>
              {t("card.attitudeTitle")}
              {r.attitude !== null && <span className={r.attitude < 0 ? "rel-attitude neg" : "rel-attitude"}>{signed(r.attitude)}</span>}
            </h4>
            {r.attitude === null ? (
              <div className="rel-editor-empty">
                <span className="field-label">{t("card.attitudeHelp")}</span>
                <button type="button" className="btn btn-sm" onClick={() => onPatch({ attitude: 0 })}>
                  {t("card.setAttitude")}
                </button>
              </div>
            ) : (
              <div className="rel-attitude-scale">
                <span className="field-label">{t("card.hostile")}</span>
                <input type="range" min={ATTITUDE_MIN} max={ATTITUDE_MAX} step={1} value={r.attitude} aria-label={t("card.attitudeTitle")} onChange={(e) => onPatch({ attitude: Number(e.target.value) })} />
                <span className="field-label">{t("card.friendly")}</span>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onPatch({ attitude: null })} aria-label={t("card.clearAttitude")} data-tooltip={t("card.clearAttitude")}>
                  <X size={13} />
                </button>
              </div>
            )}
          </section>

          {calendar && (
            <section className="rel-editor-section">
              <h4>{t("card.when")}</h4>
              <div className="rel-dates">
                {(["sinceDay", "untilDay"] as const).map((key) => (
                  <div key={key} className="rel-field">
                    <span className="field-label">{key === "sinceDay" ? t("card.since") : t("card.until")}</span>
                    {r[key] === null ? (
                      <button type="button" className="btn btn-sm rel-date-empty" onClick={() => onPatch({ [key]: calendar.currentDay })} data-tooltip={t("card.dateHint")}>
                        <CalendarDays size={13} /> {key === "sinceDay" ? t("card.noStart") : t("card.ongoing")}
                      </button>
                    ) : (
                      <span className="rel-date">
                        <WorldDatePicker def={calendar.def} label={key === "sinceDay" ? t("card.since") : t("card.until")} value={r[key]!} currentDay={calendar.currentDay} onChange={(d) => onPatch({ [key]: d })} />
                        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onPatch({ [key]: null })} aria-label={t("card.clearDate")} data-tooltip={t("card.openEnded")}>
                          <X size={13} />
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rel-editor-section">
            <h4>{t("card.notes")}</h4>
            <textarea className="rel-notes" value={notes} maxLength={MAX_RELATION_NOTES} rows={2} aria-label={t("card.notes")} placeholder={t("card.notesPlaceholder")} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== r.notes && onPatch({ notes })} />
          </section>

          <div className="rel-row-actions">
            <div className="rel-flags" role="group" aria-label={t("card.options")}>
              <button type="button" className={r.secret ? "rel-flag active" : "rel-flag"} aria-pressed={r.secret} onClick={() => onPatch({ secret: !r.secret })} data-tooltip={t("card.secretHint")}>
                <EyeOff size={13} /> {t("ui.secret")}
              </button>
              <button type="button" className={r.pinned ? "rel-flag active" : "rel-flag"} aria-pressed={r.pinned} onClick={() => onPatch({ pinned: !r.pinned })} data-tooltip={t("card.pinnedHint")}>
                <Pin size={13} /> {t("card.pinnedFlag")}
              </button>
              {type.symmetric && (
                <button type="button" className={r.oneWay ? "rel-flag active" : "rel-flag"} aria-pressed={r.oneWay} onClick={() => onPatch({ oneWay: !r.oneWay })} data-tooltip={t("card.oneWayHint")}>
                  <ArrowRight size={13} /> {t("card.oneWay")}
                </button>
              )}
            </div>
            <div className="rel-row-buttons">
              {!type.symmetric && r.type !== "custom" && (
                <button type="button" className="btn btn-sm" onClick={() => onPatch({ reverse: true })} data-tooltip={t("card.reverseHint")}>
                  <ArrowLeftRight size={13} /> {t("card.reverse")}
                </button>
              )}
              <button type="button" className="btn btn-sm btn-ghost rel-delete" onClick={onDelete}>
                <Trash2 size={13} /> {t("ui.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

/** Pick another article, then how it's related (phrased from this article's side). */
function AddRelation({ recordId, template, onAdd }: { recordId: string; template: ArticleTemplateKey; onAdd: (body: Record<string, unknown>) => Promise<void> }) {
  const t = useT("relations");
  const ta = useT("articles");
  const { catalog } = useRelations();
  const [otherId, setOtherId] = useState<string | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  const others = useMemo<PickerOption[]>(
    () =>
      [...catalog.values()]
        .filter((e) => e.id !== recordId)
        .sort((a, b) => a.template.localeCompare(b.template) || a.name.localeCompare(b.name))
        .map((e) => ({ value: e.id, label: e.name, group: templateLabel(e.template, ta) })),
    [catalog, recordId, ta]
  );
  const other = otherId ? catalog.get(otherId) : undefined;
  const phrasings = useMemo(() => (other ? perspectiveOptions(template, other.template) : []), [other, template]);
  const options: PickerOption[] = phrasings.map((p, i) => ({ value: String(i), label: p.label, group: RELATION_GROUPS.find((g) => g.key === (p.group as RelationGroup))?.label }));
  const picked = choice !== null ? phrasings[Number(choice)] : undefined;

  async function add() {
    if (!picked || !otherId) return;
    const [fromId, toId] = picked.swap ? [otherId, recordId] : [recordId, otherId];
    await onAdd({ type: picked.type, fromId, toId, label: label.trim() });
    setOtherId(null);
    setChoice(null);
    setLabel("");
  }

  return (
    <div className="rel-add">
      <InfoPicker options={others} value={otherId} placeholder={t("card.addWith")} ariaLabel={t("card.related")} collapsibleGroups onChange={(v) => (setOtherId(v), setChoice(null))} />
      {other && (
        <InfoPicker options={options} value={choice} placeholder={t("card.is", { name: catalog.get(recordId)?.name ?? t("card.this") })} ariaLabel={t("card.kind")} onChange={setChoice} />
      )}
      {picked && (
        <input
          type="text"
          value={label}
          maxLength={MAX_RELATION_LABEL}
          placeholder={picked.type === "custom" ? t("card.labelRequired") : t("card.extraOptional")}
          aria-label={t("card.relationshipLabel")}
          onChange={(e) => setLabel(e.target.value)}
        />
      )}
      <button type="button" className="btn btn-sm btn-primary" disabled={!picked || (picked.type === "custom" && !label.trim())} onClick={() => void add()}>
        <Plus size={13} /> {t("ui.add")}
      </button>
    </div>
  );
}
