"use client";

import { Eye, EyeOff, Lock, X, type LucideIcon } from "lucide-react";
import { templateOf } from "@/components/articles/templates";
import type { CatalogEntry, GraphEdge } from "@/server/relations/graph";
import { labelFor, RELATION_GROUPS, type RelationGroup } from "@/server/relations/types";
import { portraitSrc, templateTint } from "./edge-style";
import { useHideSecrets, useRelations } from "./relations-context";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";

/**
 * The shared shell of the relations tools (Relationships, Family trees,
 * Boards): a control rail on the left and a full-height canvas stage.
 */
export function RelWorkspace({ rail, children }: { rail: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rel-workspace">
      <aside className="rel-rail">{rail}</aside>
      <section className="rel-stage">{children}</section>
    </div>
  );
}

export function RailHeader({ Icon, title, subtitle }: { Icon: LucideIcon; title: string; subtitle?: React.ReactNode }) {
  return (
    <header className="rel-rail-header">
      <span className="rel-rail-badge" aria-hidden>
        <Icon size={18} strokeWidth={2.25} />
      </span>
      <span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </span>
    </header>
  );
}

export function RailSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rel-rail-section">
      <div className="rel-rail-section-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** An on/off row styled as a switch (a real checkbox underneath). */
export function RailSwitch({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className={disabled ? "rel-switch disabled" : "rel-switch"} data-tooltip={hint}>
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="rel-switch-track" aria-hidden />
    </label>
  );
}

export function HideSecretsSwitch() {
  const t = useT("relations");
  const [hideSecrets, setHideSecrets] = useHideSecrets();
  return (
    <button type="button" className={hideSecrets ? "rel-secret-toggle active" : "rel-secret-toggle"} aria-pressed={hideSecrets} onClick={() => setHideSecrets(!hideSecrets)} data-tooltip={t("secrets.hideHint")}>
      {hideSecrets ? <EyeOff size={14} /> : <Eye size={14} />}
      {hideSecrets ? t("secrets.hidden") : t("secrets.shown")}
    </button>
  );
}

/** A centered empty or hint state inside the stage. */
export function StageEmpty({ Icon, title, children }: { Icon: LucideIcon; title: string; children?: React.ReactNode }) {
  return (
    <div className="rel-stage-empty">
      <Icon size={28} strokeWidth={1.75} aria-hidden />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

/** Chip color per relation group (rail filters, inspector headings). */
export const GROUP_COLORS: Record<RelationGroup | "derived", string> = {
  family: "#d4a24c",
  social: "#47bfab",
  political: "#6f9fe0",
  ecology: "#65a30d",
  custom: "#9ca3af",
  derived: "#8b9199",
};

/** How an edge reads from `id`'s side ("Child of", "Member of house", …). */
export function edgeLabelFrom(edge: GraphEdge, id: string): string {
  if (edge.relation) {
    const base = labelFor(edge.relation, id);
    return edge.relation.label && edge.type !== "custom" ? `${base} · ${edge.relation.label}` : base;
  }
  return edge.fromId === id ? edge.label : activeT("relations")("edge.by", { label: edge.label });
}

/**
 * The selected card's details: who it is, its ties grouped by kind (click
 * one to select that card), and actions (open, center the web, family).
 */
export function Inspector({ entry, edges, onSelect, onClose, actions }: { entry: CatalogEntry; edges: readonly GraphEdge[]; onSelect: (id: string) => void; onClose: () => void; actions: React.ReactNode }) {
  const t = useT("relations");
  const { catalog } = useRelations();
  const { Icon, label } = templateOf(entry.template);
  const ties = edges.filter((e) => e.fromId === entry.id || e.toId === entry.id);
  const groups = [...RELATION_GROUPS.map((g) => ({ key: g.key as RelationGroup | "derived", label: g.label })), { key: "derived" as const, label: t("ui.fromOtherInfo") }]
    .map((g) => ({ ...g, ties: ties.filter((x) => x.group === g.key) }))
    .filter((g) => g.ties.length);
  return (
    <aside className="rel-inspector" aria-label={t("inspector.details", { name: entry.name })} style={{ ["--rel-accent" as string]: entry.color ?? templateTint(entry.template) }}>
      <header className="rel-inspector-head">
        {entry.portraitKey ? (
          // eslint-disable-next-line @next/next/no-img-element -- small cropped portraits served by the app
          <img className="rel-avatar rel-avatar-lg" src={portraitSrc(entry.portraitKey)} alt="" />
        ) : (
          <span className="rel-avatar rel-avatar-lg rel-avatar-icon" aria-hidden>
            <Icon size={20} />
          </span>
        )}
        <span className="rel-inspector-title">
          <strong>{entry.name}</strong>
          <span>
            {t("inspector.subtitle", { kind: label, ties: t("ui.ties", { count: ties.length }) })}
          </span>
        </span>
        <button type="button" className="btn btn-ghost btn-sm rel-icon-btn" onClick={onClose} aria-label={t("inspector.closeDetails")} data-tooltip={t("ui.close")}>
          <X size={14} />
        </button>
      </header>
      <div className="rel-inspector-actions">{actions}</div>
      <div className="rel-inspector-body">
        {groups.length === 0 && <p className="cal-help">{t("inspector.noTies")}</p>}
        {groups.map((g) => (
          <section key={g.key}>
            <h3>
              <span className="rel-dot" style={{ background: GROUP_COLORS[g.key] }} aria-hidden />
              {g.label}
            </h3>
            <ul>
              {g.ties.map((tie) => {
                const other = tie.fromId === entry.id ? tie.toId : tie.fromId;
                return (
                  <li key={tie.id}>
                    <button type="button" onClick={() => onSelect(other)}>
                      <span className="rel-tie-label">
                        {tie.secret && <Lock size={11} aria-label={t("ui.secret")} />}
                        {edgeLabelFrom(tie, entry.id)}
                      </span>
                      <span className="rel-tie-name">{catalog.get(other)?.name ?? t("ui.removed")}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
