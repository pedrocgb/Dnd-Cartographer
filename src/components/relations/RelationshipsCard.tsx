"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeftRight, ChevronDown, ChevronRight, Eye, EyeOff, GitFork, Lock, Network, Pin, Plus, Trash2, Waypoints } from "lucide-react";
import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";
import WorldDatePicker from "@/components/calendars/WorldDatePicker";
import { dayLabel } from "@/components/calendars/evaluate";
import type { CalendarDefinition } from "@/server/calendars/engine";
import { TEMPLATE_LABELS, type ArticleTemplateKey } from "@/server/articles/templates";
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
  const { relations, derived, catalog, openArticle, openWeb } = useRelations();
  const [hideSecrets] = useHideSecrets();
  const [depth, setDepth] = useState(1);
  const edges = useMemo(() => webEdges(catalog, relations, derived, { hideSecrets }), [catalog, relations, derived, hideSecrets]);
  const graph = useWebGraph(recordId, depth, edges);
  return (
    <div className="rel-mini">
      <label className="rel-field rel-depth">
        <span className="field-label">Hops: {depth}</span>
        <input type="range" min={1} max={3} value={depth} onChange={(e) => setDepth(Number(e.target.value))} />
      </label>
      <div className="rel-mini-canvas">
        {graph.cards.length <= 1 ? (
          <p className="cal-help rel-empty">No ties to draw yet.</p>
        ) : (
          <RelationsCanvas key={`${depth}|${graph.cards.map((c) => c.id).join("|")}`} cards={graph.cards} lines={graph.lines} compact onOpen={(e) => openArticle(e.template, e.id)} onFocus={openWeb} />
        )}
      </div>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

async function send(method: string, url: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.ok) return null;
  return (await res.json().catch(() => ({}))).error ?? "Could not save the relation.";
}

/**
 * An article's relationships: every tie it has (pinned first, then by
 * group), editable in place, the read-only ties computed from other data
 * (house, rulers, seats, territory parent, siblings by shared parents), and
 * a row to add a new one.
 */
export default function RelationshipsCard({ recordId, template }: { recordId: string; template: ArticleTemplateKey }) {
  const { relations, derived, catalog, openArticle, openWeb, openFamily, refresh } = useRelations();
  const [tab, setTab] = useState<"list" | "web">("list");
  const isPerson = template === "character" || template === "playerCharacter";
  const [hideSecrets, setHideSecrets] = useHideSecrets();
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const calendar = useDefaultCalendar();

  const mine = useMemo(
    () => relations.filter((r) => (r.fromId === recordId || r.toId === recordId) && catalog.has(r.fromId === recordId ? r.toId : r.fromId) && !(hideSecrets && r.secret)),
    [relations, recordId, catalog, hideSecrets]
  );
  const computed = useMemo(() => {
    const rows = derived
      .filter((d) => d.kind !== "linked" && (d.fromId === recordId || d.toId === recordId))
      .map((d) => ({ id: d.id, otherId: d.fromId === recordId ? d.toId : d.fromId, label: d.fromId === recordId ? d.label : inverseDerived(d.kind, d.label) }));
    const explicit = new Set(mine.filter((r) => r.type === "sibling").map((r) => (r.fromId === recordId ? r.toId : r.fromId)));
    for (const s of derivedSiblings(relations, recordId)) {
      if (!explicit.has(s.id) && catalog.has(s.id)) rows.push({ id: `sibling:${s.id}`, otherId: s.id, label: s.full ? "Sibling of (by parents)" : "Half-sibling of (by a parent)" });
    }
    return rows;
  }, [derived, relations, recordId, mine, catalog]);

  const run = async (op: Promise<string | null>) => {
    const failed = await op;
    setError(failed);
    if (!failed) refresh();
  };

  const groups = RELATION_GROUPS.map((g) => ({ ...g, rows: mine.filter((r) => !r.pinned && relationType(r.type)?.group === g.key) })).filter((g) => g.rows.length);
  const pinned = mine.filter((r) => r.pinned);
  const nameOf = (id: string) => catalog.get(id)?.name ?? "(removed)";
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
    <section className="article-card rel-card" aria-label="Relationships">
      <header className="article-card-header">
        <span className="article-card-label">
          <Network size={15} strokeWidth={2.25} />
          Relationships
        </span>
        <div className="rel-tabs" role="tablist" aria-label="Relationships view">
          <button type="button" role="tab" aria-selected={tab === "list"} className={tab === "list" ? "rel-chip active" : "rel-chip"} onClick={() => setTab("list")}>
            List
          </button>
          <button type="button" role="tab" aria-selected={tab === "web"} className={tab === "web" ? "rel-chip active" : "rel-chip"} onClick={() => setTab("web")}>
            Web
          </button>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => openWeb(recordId)} data-tooltip="Open the Relationships view centered here">
          <Waypoints size={14} /> Open web
        </button>
        {isPerson && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => openFamily(recordId)} data-tooltip="Open this character's family tree">
            <GitFork size={14} /> Family tree
          </button>
        )}
        <button
          type="button"
          className={hideSecrets ? "btn btn-sm btn-ghost active" : "btn btn-sm btn-ghost"}
          onClick={() => setHideSecrets(!hideSecrets)}
          aria-pressed={hideSecrets}
          data-tooltip={hideSecrets ? "Secret ties are hidden everywhere (for sharing your screen). Click to show them." : "Hide secret ties everywhere, e.g. while players can see your screen"}
        >
          {hideSecrets ? <EyeOff size={14} /> : <Eye size={14} />}
          {hideSecrets ? "Secrets hidden" : "Hide secrets"}
        </button>
      </header>

      {tab === "web" && <MiniWeb recordId={recordId} />}
      {tab === "list" && mine.length === 0 && computed.length === 0 && <p className="article-card-placeholder">No relationships yet.</p>}
      {tab === "list" && pinned.length > 0 && (
        <RelationGroupList label="Pinned" icon={<Pin size={12} />}>
          {pinned.map(renderRow)}
        </RelationGroupList>
      )}
      {tab === "list" && groups.map((g) => (
        <RelationGroupList key={g.key} label={g.label}>
          {g.rows.map(renderRow)}
        </RelationGroupList>
      ))}
      {tab === "list" && computed.length > 0 && (
        <RelationGroupList label="From other information" icon={<Lock size={12} />}>
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

/** How a derived edge reads from its other end. */
function inverseDerived(kind: string, label: string): string {
  if (kind === "house") return "House of";
  if (kind === "territoryParent") return "Liege of";
  if (kind === "rules") return `Ruled by (${label})`;
  if (kind === "seat") return label === "Capital of" ? "Capital:" : "Seat:";
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
  const type = relationType(r.type);
  const [label, setLabel] = useState(r.label);
  const [notes, setNotes] = useState(r.notes);
  const span = [r.sinceDay, r.untilDay].some((d) => d !== null) && calendar
    ? `${r.sinceDay !== null ? dayLabel(calendar.def, r.sinceDay, { weekday: false, short: true }) : "…"} – ${r.untilDay !== null ? dayLabel(calendar.def, r.untilDay, { weekday: false, short: true }) : "…"}`
    : null;
  const detail = [r.parentKind && r.parentKind !== "biological" ? cap(r.parentKind) : null, r.spouseStatus && r.spouseStatus !== "unknown" ? cap(r.spouseStatus) : null].filter(Boolean).join(", ");

  return (
    <li className={["rel-row", r.secret && "rel-row-secret", open && "open"].filter(Boolean).join(" ")}>
      <div className="rel-row-main">
        <button type="button" className="rel-row-toggle" onClick={onToggle} aria-expanded={open} aria-label={open ? "Close details" : "Edit details"} data-tooltip={open ? "Close" : "Edit this tie"}>
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
            <span className={r.attitude < 0 ? "rel-attitude neg" : "rel-attitude"} data-tooltip={`Attitude ${r.attitude > 0 ? "+" : ""}${r.attitude}`}>
              {r.attitude > 0 ? "+" : ""}
              {r.attitude}
            </span>
          )}
          {r.secret && (
            <span data-tooltip="Secret tie" aria-label="Secret">
              <EyeOff size={13} />
            </span>
          )}
          {r.pinned && (
            <span data-tooltip="Pinned" aria-label="Pinned">
              <Pin size={13} />
            </span>
          )}
        </span>
      </div>
      {open && type && (
        <div className="rel-row-editor">
          <label className="cal-check">
            <input type="checkbox" checked={r.secret} onChange={(e) => onPatch({ secret: e.target.checked })} /> Secret
          </label>
          <label className="cal-check">
            <input type="checkbox" checked={r.pinned} onChange={(e) => onPatch({ pinned: e.target.checked })} /> Pinned
          </label>
          {type.symmetric && (
            <label className="cal-check" data-tooltip="Only one side holds this tie (e.g. an ally who isn't allied back): drawn as an arrow">
              <input type="checkbox" checked={r.oneWay} onChange={(e) => onPatch({ oneWay: e.target.checked })} /> One-way
            </label>
          )}
          <label className="rel-field">
            <span className="field-label">{r.type === "custom" ? "Label" : "Extra wording"}</span>
            <input type="text" value={label} maxLength={MAX_RELATION_LABEL} placeholder={r.type === "custom" ? "Owes a debt to" : "optional"} onChange={(e) => setLabel(e.target.value)} onBlur={() => label !== r.label && onPatch({ label })} />
          </label>
          {type.attrs?.includes("parentKind") && (
            <label className="rel-field">
              <span className="field-label">Parent</span>
              <InfoPicker options={PARENT_KINDS.map((k) => ({ value: k, label: cap(k) }))} value={r.parentKind} placeholder="Biological" ariaLabel="Kind of parent" searchable={false} onChange={(v) => v && onPatch({ parentKind: v })} />
            </label>
          )}
          {type.attrs?.includes("spouseStatus") && (
            <label className="rel-field">
              <span className="field-label">Status</span>
              <InfoPicker options={SPOUSE_STATUSES.map((k) => ({ value: k, label: cap(k) }))} value={r.spouseStatus} placeholder="Unknown" ariaLabel="Status" searchable={false} onChange={(v) => v && onPatch({ spouseStatus: v })} />
            </label>
          )}
          <label className="rel-field">
            <span className="field-label">Attitude: {r.attitude === null ? "not set" : `${r.attitude > 0 ? "+" : ""}${r.attitude}`}</span>
            <input type="range" min={ATTITUDE_MIN} max={ATTITUDE_MAX} value={r.attitude ?? 0} onChange={(e) => onPatch({ attitude: Number(e.target.value) })} />
          </label>
          {r.attitude !== null && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onPatch({ attitude: null })}>
              Clear attitude
            </button>
          )}
          {calendar && (
            <div className="rel-dates">
              {(["sinceDay", "untilDay"] as const).map((key) => (
                <div key={key} className="rel-field">
                  <span className="field-label">{key === "sinceDay" ? "Since" : "Until"}</span>
                  {r[key] === null ? (
                    <button type="button" className="btn btn-sm" onClick={() => onPatch({ [key]: calendar.currentDay })}>
                      Set date
                    </button>
                  ) : (
                    <span className="rel-date">
                      <WorldDatePicker def={calendar.def} label={key === "sinceDay" ? "Since" : "Until"} value={r[key]!} currentDay={calendar.currentDay} onChange={(d) => onPatch({ [key]: d })} />
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPatch({ [key]: null })} aria-label="Clear date" data-tooltip="No date: open-ended">
                        ✕
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <label className="rel-field rel-notes">
            <span className="field-label">Notes</span>
            <textarea value={notes} maxLength={MAX_RELATION_NOTES} rows={2} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== r.notes && onPatch({ notes })} />
          </label>
          <div className="rel-row-actions">
            {!type.symmetric && r.type !== "custom" && (
              <button type="button" className="btn btn-sm" onClick={() => onPatch({ reverse: true })} data-tooltip="Swap the two ends (Parent of ⇄ Child of)">
                <ArrowLeftRight size={13} /> Reverse
              </button>
            )}
            <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Pick another article, then how it's related (phrased from this article's side). */
function AddRelation({ recordId, template, onAdd }: { recordId: string; template: ArticleTemplateKey; onAdd: (body: Record<string, unknown>) => Promise<void> }) {
  const { catalog } = useRelations();
  const [otherId, setOtherId] = useState<string | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  const others = useMemo<PickerOption[]>(
    () =>
      [...catalog.values()]
        .filter((e) => e.id !== recordId)
        .sort((a, b) => a.template.localeCompare(b.template) || a.name.localeCompare(b.name))
        .map((e) => ({ value: e.id, label: e.name, group: TEMPLATE_LABELS[e.template] })),
    [catalog, recordId]
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
      <InfoPicker options={others} value={otherId} placeholder="Add a relationship with…" ariaLabel="Related article" collapsibleGroups onChange={(v) => (setOtherId(v), setChoice(null))} />
      {other && (
        <InfoPicker options={options} value={choice} placeholder={`${catalog.get(recordId)?.name ?? "This"} is…`} ariaLabel="Kind of relationship" onChange={setChoice} />
      )}
      {picked && (
        <input
          type="text"
          value={label}
          maxLength={MAX_RELATION_LABEL}
          placeholder={picked.type === "custom" ? "Label (required)" : "Extra wording (optional)"}
          aria-label="Relationship label"
          onChange={(e) => setLabel(e.target.value)}
        />
      )}
      <button type="button" className="btn btn-sm btn-primary" disabled={!picked || (picked.type === "custom" && !label.trim())} onClick={() => void add()}>
        <Plus size={13} /> Add
      </button>
    </div>
  );
}
