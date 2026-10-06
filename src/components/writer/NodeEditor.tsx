"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Eye, EyeOff, Flame, Lightbulb, Plus, Spline, Swords, Trash2, X } from "lucide-react";
import { api } from "@/components/calendars/api";
import ConfirmDialog from "@/components/ConfirmDialog";
import RichEditor from "@/components/RichEditor";
import MentionBacklinks from "@/components/MentionBacklinks";
import { Skeleton } from "@/components/Skeleton";
import type { ClientCampaign } from "@/components/sessions/types";
import { sessionLabel } from "@/components/sessions/types";
import { questHref } from "@/components/quests/href";
import { TIPS } from "@/server/writer/guides";
import { beatOf, templateByKey } from "@/server/writer/templates";
import {
  BEAT_ROLE_LABELS,
  BEAT_ROLES,
  CHILD_KIND,
  NODE_KIND_LABELS,
  NODE_STATUS_HINTS,
  NODE_STATUS_LABELS,
  NODE_STATUSES,
  type BeatRole,
  type NodeKind,
  type NodeStatus,
  type OutlineLink,
  type OutlineNode,
  type ThreadBeat,
} from "@/server/writer/types";
import type { WriterData } from "./useWriterData";

type Patch = Partial<Pick<OutlineNode, "title" | "synopsis" | "status" | "changeNote" | "plannedSessionId" | "links" | "beatTemplate" | "hidden">>;

/**
 * The selected arc, chapter or scene: its title, synopsis (the one-line
 * "what is this"), status, when it's planned, linked quests and fronts,
 * the threads that run through it, its full text, and what mentions it.
 * Fields save as you leave them; the text autosaves.
 */
export default function NodeEditor({
  node,
  campaign,
  data,
  guides,
  onChanged,
  onRemoved,
  onSelect,
  onAdd,
  onApplyTemplate,
  onBeatsChanged,
  onStale,
}: {
  node: OutlineNode;
  campaign: ClientCampaign;
  data: WriterData;
  guides: boolean;
  onChanged: (n: OutlineNode) => void;
  onRemoved: (ids: string[]) => void;
  onSelect: (id: string) => void;
  onAdd: (kind: NodeKind, parentId: string) => void;
  onApplyTemplate: (parentId: string) => void;
  onBeatsChanged: (beats: ThreadBeat[]) => void;
  onStale: () => Promise<void>;
}) {
  const [title, setTitle] = useState(node.title);
  const [synopsis, setSynopsis] = useState(node.synopsis);
  const [changeNote, setChangeNote] = useState(node.changeNote);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(patch: Patch) {
    setError(null);
    const res = await api<{ node: OutlineNode }>("PATCH", `/api/outline/${node.id}`, { ...patch, expectedVersion: node.version });
    if (res.ok) onChanged(res.data.node);
    else if (res.status === 409) {
      setError("This changed elsewhere; it was reloaded. Check it and try again.");
      await onStale();
    } else setError(res.data.error ?? "Could not save.");
  }

  async function remove() {
    const res = await api<{ removed: string[] }>("DELETE", `/api/outline/${node.id}`);
    if (res.ok) onRemoved(res.data.removed);
    else setError(res.data.error ?? "Could not delete it.");
    setConfirmDelete(false);
  }

  const parent = data.nodes.find((n) => n.id === node.parentId) ?? null;
  const grandparent = parent ? (data.nodes.find((n) => n.id === parent.parentId) ?? null) : null;
  const beat = beatOf(parent?.beatTemplate, node.beatKey);
  const children = data.nodes.filter((n) => n.parentId === node.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const childKind = CHILD_KIND[node.kind];
  const descendants = countDescendants(data.nodes, node.id);
  // Hidden through an arc or chapter above it: shares leave it out whatever its own setting.
  const hiddenAbove = [parent, grandparent].find((p) => p?.hidden) ?? null;

  return (
    <article className="wr-editor" aria-label={`${NODE_KIND_LABELS[node.kind]}: ${node.title}`}>
      <nav className="wr-crumbs" aria-label="Where it sits">
        {[grandparent, parent].filter(Boolean).map((p) => (
          <span key={p!.id}>
            <button type="button" className="btn-link" onClick={() => onSelect(p!.id)}>
              {p!.title}
            </button>
            <ChevronRight size={12} aria-hidden />
          </span>
        ))}
        <span className={`wr-kind wr-kind-${node.kind}`}>{NODE_KIND_LABELS[node.kind]}</span>
        <button
          type="button"
          className={`btn btn-sm btn-ghost wr-hide-toggle${node.hidden ? " active" : hiddenAbove ? " via-parent" : ""}`}
          aria-pressed={node.hidden}
          data-tooltip={
            node.hidden
              ? "Left out of share links, with everything inside it. Click to show it again."
              : hiddenAbove
                ? `Already left out of share links: its ${NODE_KIND_LABELS[hiddenAbove.kind].toLowerCase()} is hidden`
                : "Leave it (and everything inside it) out of share links"
          }
          onClick={() => void save({ hidden: !node.hidden })}
        >
          {node.hidden || hiddenAbove ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
          {node.hidden ? "Hidden from shares" : hiddenAbove ? "Hidden (via parent)" : "Shown in shares"}
        </button>
      </nav>

      <input className="wr-title-input" aria-label="Title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== node.title && void save({ title })} />

      {beat && (
        <p className="wr-beat">
          <Lightbulb size={14} aria-hidden /> <strong>{beat.name}</strong> ({templateByKey(parent?.beatTemplate)?.name}): {beat.hint}
        </p>
      )}
      {guides && !beat && <p className="wr-tip">{TIPS[node.kind]}</p>}

      <label className="cal-field">
        <span className="field-label">In a sentence</span>
        <textarea
          rows={2}
          maxLength={4000}
          value={synopsis}
          placeholder={node.kind === "scene" ? "Who is here, what do they want, what happens if the heroes do nothing?" : "The question this answers, or what happens in it."}
          onChange={(e) => setSynopsis(e.target.value)}
          onBlur={() => synopsis !== node.synopsis && void save({ synopsis })}
        />
      </label>

      <div className="qs-general-grid">
        <label className="cal-field">
          <span className="field-label">Status</span>
          <select value={node.status} onChange={(e) => void save({ status: e.target.value as NodeStatus })}>
            {NODE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {NODE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          {guides && <span className="cal-help">{NODE_STATUS_HINTS[node.status]}</span>}
        </label>
        {node.kind === "scene" && (
          <label className="cal-field">
            <span className="field-label">Planned for</span>
            <select value={node.plannedSessionId ?? ""} onChange={(e) => void save({ plannedSessionId: e.target.value || null })}>
              <option value="">No session yet</option>
              {[...data.sessions]
                .sort((a, b) => b.number - a.number)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {sessionLabel(s)}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>

      {node.status === "changed" && (
        <label className="cal-field">
          <span className="field-label">What happened instead</span>
          <textarea rows={2} maxLength={4000} value={changeNote} placeholder="The party sided with the smugglers, so…" onChange={(e) => setChangeNote(e.target.value)} onBlur={() => changeNote !== node.changeNote && void save({ changeNote })} />
        </label>
      )}

      <LinksSection node={node} data={data} campaignId={campaign.id} onChange={(links) => void save({ links })} />
      <ThreadsSection node={node} data={data} onBeatsChanged={onBeatsChanged} setError={setError} />

      {childKind && (
        <section className="cv-block">
          <h3 className="cv-block-title">
            {NODE_KIND_LABELS[childKind]}s ({children.length})
          </h3>
          {children.length > 0 && (
            <ol className="wr-children">
              {children.map((c) => (
                <li key={c.id}>
                  <span className={`wr-dot wr-dot-${c.status}`} aria-hidden />
                  <button type="button" className="btn-link" onClick={() => onSelect(c.id)}>
                    {c.title}
                  </button>
                  {c.synopsis && <span className="cal-help"> {c.synopsis.slice(0, 140)}</span>}
                </li>
              ))}
            </ol>
          )}
          <div className="wr-inline-actions">
            <button type="button" className="btn btn-sm" onClick={() => onAdd(childKind, node.id)}>
              <Plus size={14} /> Add {NODE_KIND_LABELS[childKind].toLowerCase()}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" data-tooltip="Lay out one item per beat of a story structure" onClick={() => onApplyTemplate(node.id)}>
              <Spline size={14} /> Use a story structure
            </button>
          </div>
        </section>
      )}

      <section className="cv-block wr-text">
        <h3 className="cv-block-title">Text</h3>
        <NodeText node={node} campaignId={campaign.id} onChanged={onChanged} />
      </section>

      <MentionBacklinks targetId={node.id} />

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="wr-editor-footer">
        <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={14} /> Delete {NODE_KIND_LABELS[node.kind].toLowerCase()}
        </button>
      </div>
      <ConfirmDialog open={confirmDelete} danger title={`Delete ${node.title}?`} confirmLabel="Delete" onConfirm={remove} onCancel={() => setConfirmDelete(false)}>
        {descendants > 0 ? `Everything inside it goes too (${descendants} item${descendants === 1 ? "" : "s"}).` : "Its text goes with it."}
      </ConfirmDialog>
    </article>
  );
}

const countDescendants = (nodes: OutlineNode[], id: string): number => nodes.filter((n) => n.parentId === id).reduce((sum, c) => sum + 1 + countDescendants(nodes, c.id), 0);

/** The item's rich text, created on first open. */
function NodeText({ node, campaignId, onChanged }: { node: OutlineNode; campaignId: string; onChanged: (n: OutlineNode) => void }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (node.documentId) return;
    let cancelled = false;
    void api<{ node: OutlineNode }>("POST", `/api/outline/${node.id}/document`).then((res) => {
      if (cancelled) return;
      if (res.ok) onChanged(res.data.node);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
    // Only when the item has no document yet; onChanged is a fresh closure each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, node.documentId]);
  if (failed) return <p className="form-error">Could not open the text.</p>;
  if (!node.documentId) return <Skeleton height={120} radius="var(--radius-md)" />;
  return <RichEditor documentId={node.documentId} editable mentionCampaignId={campaignId} />;
}

/** Linked quests and fronts. */
function LinksSection({ node, data, campaignId, onChange }: { node: OutlineNode; data: WriterData; campaignId: string; onChange: (links: OutlineLink[]) => void }) {
  const linked = new Set(node.links.map((l) => `${l.kind}:${l.id}`));
  const nameOf = (l: OutlineLink) => (l.kind === "quest" ? data.quests.find((q) => q.id === l.id)?.title : data.fronts.find((f) => f.id === l.id)?.name) ?? "(removed)";
  const choices = [...data.quests.map((q) => ({ key: `quest:${q.id}`, label: `Quest: ${q.title}` })), ...data.fronts.map((f) => ({ key: `front:${f.id}`, label: `Front: ${f.name}` }))].filter((c) => !linked.has(c.key));
  return (
    <section className="cv-block">
      <h3 className="cv-block-title">Quests and fronts</h3>
      <ul className="wr-chips">
        {node.links.map((l) => (
          <li key={`${l.kind}:${l.id}`} className="wr-chip">
            {l.kind === "quest" ? <Swords size={12} aria-hidden /> : <Flame size={12} aria-hidden />}
            {l.kind === "quest" ? <Link href={questHref({ campaignId, id: l.id })}>{nameOf(l)}</Link> : <span>{nameOf(l)}</span>}
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Unlink ${nameOf(l)}`} data-tooltip="Unlink" onClick={() => onChange(node.links.filter((x) => !(x.kind === l.kind && x.id === l.id)))}>
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
      {choices.length > 0 ? (
        <select
          aria-label="Link a quest or front"
          value=""
          onChange={(e) => {
            const [kind, id] = e.target.value.split(":");
            if (id) onChange([...node.links, { kind: kind as OutlineLink["kind"], id }]);
          }}
        >
          <option value="">Link a quest or front…</option>
          {choices.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      ) : (
        node.links.length === 0 && <p className="cal-help">This campaign has no quests or fronts yet (add them on the Sessions page).</p>
      )}
    </section>
  );
}

/** The threads that show up here, and their role in this item (set up, move on, pay off). */
function ThreadsSection({ node, data, onBeatsChanged, setError }: { node: OutlineNode; data: WriterData; onBeatsChanged: (beats: ThreadBeat[]) => void; setError: (e: string | null) => void }) {
  const here = data.beats.filter((b) => b.nodeId === node.id);
  const others = data.threads.filter((t) => t.status === "open" && !here.some((b) => b.threadId === t.id));

  async function setRole(threadId: string, role: BeatRole | null) {
    const url = `/api/threads/${threadId}/beats/${node.id}`;
    const res = role ? await api<{ beat: ThreadBeat }>("PUT", url, { role }) : await api("DELETE", url);
    if (!res.ok) return setError(res.data.error ?? "Could not save the thread.");
    const rest = data.beats.filter((b) => !(b.threadId === threadId && b.nodeId === node.id));
    onBeatsChanged(role ? [...rest, (res.data as { beat: ThreadBeat }).beat] : rest);
  }

  if (data.threads.length === 0) return null;
  return (
    <section className="cv-block">
      <h3 className="cv-block-title">Threads here</h3>
      {here.length > 0 && (
        <ul className="wr-thread-roles">
          {here.map((b) => {
            const t = data.threads.find((x) => x.id === b.threadId);
            if (!t) return null;
            return (
              <li key={b.id}>
                <span className="wr-thread-swatch" style={t.color ? { background: t.color } : undefined} aria-hidden />
                <span className="wr-thread-name">{t.name}</span>
                <select aria-label={`${t.name}'s role here`} value={b.role} onChange={(e) => void setRole(t.id, e.target.value as BeatRole)}>
                  {BEAT_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {BEAT_ROLE_LABELS[t.kind][r]}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${t.name} from here`} data-tooltip="Remove from here" onClick={() => void setRole(t.id, null)}>
                  <X size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {others.length > 0 && (
        <select aria-label="Add a thread here" value="" onChange={(e) => e.target.value && void setRole(e.target.value, data.beats.some((b) => b.threadId === e.target.value) ? "progress" : "setup")}>
          <option value="">A thread shows up here…</option>
          {others.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
    </section>
  );
}
