"use client";

import { useEffect, useState } from "react";
import { BookOpen, CalendarCheck, Eye, Globe, HelpCircle, ListTree, PenLine, Plus, Settings2, Spline } from "lucide-react";
import { api } from "@/components/calendars/api";
import { PageSkeleton } from "@/components/Skeleton";
import type { ClientCampaign } from "@/components/sessions/types";
import { applyMoves } from "@/server/writer/logic";
import type { OutlineMove } from "@/server/writer/parse";
import type { NodeKind, OutlineNode } from "@/server/writer/types";
import { TIPS } from "@/server/writer/guides";
import OutlineTree from "./OutlineTree";
import NodeEditor from "./NodeEditor";
import TemplatePicker from "./TemplatePicker";
import CampaignSetupDialog from "./CampaignSetupDialog";
import ThreadsView from "./ThreadsView";
import SessionsPanel from "./SessionsPanel";
import StatusLog from "./StatusLog";
import StoryReader from "./StoryReader";
import ReaderDock from "./ReaderDock";
import { upsert, useWriterData } from "./useWriterData";

type Tab = "story" | "sessions" | "threads" | "status";
const TABS: { key: Tab; label: string; icon: typeof BookOpen; hint: string }[] = [
  { key: "story", label: "Story", icon: BookOpen, hint: "Arcs, chapters and scenes, and their text" },
  { key: "sessions", label: "Sessions", icon: CalendarCheck, hint: "Prep the next session, then mark what happened" },
  { key: "threads", label: "Threads", icon: Spline, hint: "Promises, setups and mysteries: where they start and pay off" },
  { key: "status", label: "World status", icon: Globe, hint: "What changed in the world, session by session" },
];

const tabParam = (v: string | null): Tab => (v === "sessions" || v === "threads" || v === "status" ? v : "story");

/** Keeps ?campaign=&node=&tab=&mode= in the address bar without a navigation. */
function syncUrl(values: Record<"campaign" | "node" | "tab" | "mode", string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(null, "", url);
}

/**
 * One campaign's writer: the outline (sidebar) and, in the main area, the
 * selected item's editor, session prep and review, threads with the plot
 * grid and health warnings, and the world status log.
 */
export default function CampaignWriter({
  campaign,
  initialNode,
  initialTab,
  initialMode,
  onCampaignChanged,
}: {
  campaign: ClientCampaign;
  initialNode: string | null;
  initialTab: string | null;
  initialMode: string | null;
  onCampaignChanged: (c: ClientCampaign) => void;
}) {
  const { data, loading, error, reload, update } = useWriterData(campaign.id);
  const [tab, setTab] = useState<Tab>(tabParam(initialTab));
  const [selectedId, setSelectedId] = useState<string | null>(initialNode);
  // The Story tab reads like a book (no editing) or opens the editor.
  const [reading, setReading] = useState(initialMode === "read");
  const [mainEl, setMainEl] = useState<HTMLElement | null>(null);
  const [templateFor, setTemplateFor] = useState<{ parentId: string | null } | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const guides = !campaign.setup.guidesHidden;
  const selected = data.nodes.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    syncUrl({ campaign: campaign.id, node: selected?.id ?? null, tab: tab === "story" ? null : tab, mode: tab === "story" && reading ? "read" : null });
  }, [campaign.id, selected?.id, tab, reading]);

  const setNodes = (fn: (nodes: OutlineNode[]) => OutlineNode[]) => update((d) => ({ ...d, nodes: fn(d.nodes) }));

  async function addNode(kind: NodeKind, parentId: string | null) {
    const title = kind === "arc" ? "New arc" : kind === "chapter" ? "New chapter" : "New scene";
    const res = await api<{ node: OutlineNode }>("POST", `/api/campaigns/${campaign.id}/outline`, { kind, parentId, title });
    if (!res.ok) return setNotice(res.data.error ?? "Could not add it.");
    setNodes((list) => [...list, res.data.node]);
    setSelectedId(res.data.node.id);
    setTab("story");
    setReading(false);
  }

  async function move(moves: OutlineMove[]) {
    if (!moves.length) return;
    setNodes((list) => applyMoves(list, moves));
    const res = await api<{ nodes: OutlineNode[] }>("POST", `/api/campaigns/${campaign.id}/outline/reorder`, { moves });
    if (res.ok) setNodes(() => res.data.nodes);
    else {
      setNotice(res.data.error ?? "Could not move it.");
      await reload();
    }
  }

  async function applyTemplate(parentId: string | null, template: string) {
    setTemplateFor(null);
    const res = await api<{ nodes: OutlineNode[] }>("POST", `/api/campaigns/${campaign.id}/outline/apply-template`, { parentId, template });
    if (!res.ok) return setNotice(res.data.error ?? "Could not lay out the structure.");
    setNodes(() => res.data.nodes);
    if (parentId === null) setSelectedId(res.data.nodes.find((n) => n.parentId === null)?.id ?? null);
  }

  async function saveSetup(setup: Partial<ClientCampaign["setup"]>) {
    const res = await api<{ campaign: ClientCampaign }>("PATCH", `/api/campaigns/${campaign.id}`, { setup });
    if (res.ok) onCampaignChanged(res.data.campaign);
    else setNotice(res.data.error ?? "Could not save the campaign setup.");
    return res.ok;
  }

  if (loading) return <PageSkeleton label="Loading the story…" main="cards" />;

  const sidebar = (
    <aside className="articles-sidebar wr-sidebar" aria-label="Story outline">
      <section className="cal-side-section wr-outline-section">
        <h2 className="field-label">
          <ListTree size={14} aria-hidden /> Outline
        </h2>
        <OutlineTree
          nodes={data.nodes}
          selectedId={selected?.id ?? null}
          onSelect={(id) => {
            setSelectedId(id);
            setTab("story");
          }}
          onAdd={addNode}
          onMove={(m) => void move(m)}
        />
        <button type="button" className="articles-folder articles-create" onClick={() => void addNode("arc", null)}>
          <Plus size={16} />
          <span className="articles-folder-name">New arc</span>
        </button>
      </section>
    </aside>
  );

  return (
    <div className="articles-page">
      {sidebar}
      <main ref={setMainEl} className={tab === "story" ? "articles-main wr-main wr-main-story" : "articles-main wr-main"}>
        <header className="ss-header">
          <div className="ss-header-text">
            <h1>{campaign.name}</h1>
            {campaign.setup.pitch ? <p className="ss-description">{campaign.setup.pitch}</p> : <p className="cal-help">No pitch yet. Open the campaign setup to write it in a sentence or two.</p>}
          </div>
          <div className="ss-header-actions">
            {tab === "story" && (
              <div className="wr-mode" role="group" aria-label="Story mode">
                <button type="button" className={reading ? "btn btn-sm btn-ghost" : "btn btn-sm btn-ghost active"} aria-pressed={!reading} data-tooltip="Write and organize the story" onClick={() => setReading(false)}>
                  <PenLine size={14} /> Edit
                </button>
                <button type="button" className={reading ? "btn btn-sm btn-ghost active" : "btn btn-sm btn-ghost"} aria-pressed={reading} data-tooltip="Read the story like a book, without editing" onClick={() => setReading(true)}>
                  <Eye size={14} /> Read
                </button>
              </div>
            )}
            <button type="button" className={guides ? "btn btn-sm btn-ghost active" : "btn btn-sm btn-ghost"} aria-pressed={guides} data-tooltip={guides ? "Hide the writing guides" : "Show the writing guides"} onClick={() => void saveSetup({ guidesHidden: guides })}>
              <HelpCircle size={14} /> Guides
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setSetupOpen(true)}>
              <Settings2 size={14} /> Campaign setup
            </button>
          </div>
        </header>
        <nav className="cal-editor-tabs ss-view-tabs" role="tablist" aria-label="Show">
          {TABS.map(({ key, label, icon: Icon, hint }) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "cal-tab active" : "cal-tab"} data-tooltip={hint} onClick={() => setTab(key)}>
              <Icon size={14} aria-hidden /> {label}
            </button>
          ))}
        </nav>
        {(notice || error) && (
          <p className="form-error" role="alert">
            {notice ?? error}
          </p>
        )}

        {tab === "story" && reading && <StoryReader nodes={data.nodes} rootId={selected?.id ?? null} title={campaign.name} pitch={campaign.setup.pitch} onReadAll={() => setSelectedId(null)} />}
        {tab === "story" &&
          !reading &&
          (selected ? (
            <NodeEditor
              key={selected.id}
              node={selected}
              campaign={campaign}
              data={data}
              guides={guides}
              onChanged={(n) => setNodes((list) => upsert(list, n))}
              onRemoved={(ids) => {
                setNodes((list) => list.filter((n) => !ids.includes(n.id)));
                setSelectedId(selected.parentId);
              }}
              onSelect={setSelectedId}
              onAdd={addNode}
              onApplyTemplate={(parentId) => setTemplateFor({ parentId })}
              onBeatsChanged={(beats) => update((d) => ({ ...d, beats }))}
              onStale={reload}
            />
          ) : (
            <EmptyStory hasOutline={data.nodes.length > 0} guides={guides} onTemplate={() => setTemplateFor({ parentId: null })} onBlank={() => void addNode("arc", null)} onSetup={() => setSetupOpen(true)} />
          ))}
        {tab === "sessions" && <SessionsPanel campaign={campaign} data={data} update={update} reload={reload} guides={guides} onOpenNode={(id) => { setSelectedId(id); setTab("story"); }} />}
        {tab === "threads" && <ThreadsView campaign={campaign} data={data} update={update} guides={guides} onOpenNode={(id) => { setSelectedId(id); setTab("story"); }} />}
        {tab === "status" && <StatusLog campaign={campaign} sessions={data.sessions} guides={guides} />}
      </main>
      {tab === "story" && reading && <ReaderDock pane={mainEl} onEdit={() => setReading(false)} />}

      {templateFor && <TemplatePicker target={templateFor.parentId === null ? null : (data.nodes.find((n) => n.id === templateFor.parentId)?.kind ?? null)} onPick={(key) => void applyTemplate(templateFor.parentId, key)} onClose={() => setTemplateFor(null)} />}
      {setupOpen && (
        <CampaignSetupDialog
          campaign={campaign}
          outlineEmpty={data.nodes.length === 0}
          onSave={saveSetup}
          onApplyTemplate={(key) => void applyTemplate(null, key)}
          onClose={() => setSetupOpen(false)}
        />
      )}
    </div>
  );
}

/** The Story tab with nothing selected: where to begin. */
function EmptyStory({ hasOutline, guides, onTemplate, onBlank, onSetup }: { hasOutline: boolean; guides: boolean; onTemplate: () => void; onBlank: () => void; onSetup: () => void }) {
  if (hasOutline) return <p className="cal-help wr-empty">Pick an arc, chapter or scene in the outline to write it.</p>;
  return (
    <div className="wr-start">
      <h2>Where do you want to begin?</h2>
      {guides && <p className="cal-help">{TIPS.emptyOutline}</p>}
      <div className="wr-start-options">
        <button type="button" className="wr-start-card" onClick={onSetup}>
          <Settings2 size={20} aria-hidden />
          <strong>Set up the campaign</strong>
          <span className="cal-help">A pitch, a few truths about the world, session zero and safety tools. A guided start.</span>
        </button>
        <button type="button" className="wr-start-card" onClick={onTemplate}>
          <Spline size={20} aria-hidden />
          <strong>Start from a story structure</strong>
          <span className="cal-help">Three acts, Hero&apos;s Journey, Save the Cat… Lays out arcs you then fill in.</span>
        </button>
        <button type="button" className="wr-start-card" onClick={onBlank}>
          <Plus size={20} aria-hidden />
          <strong>Blank arc</strong>
          <span className="cal-help">Just start writing. You can add structure later.</span>
        </button>
      </div>
    </div>
  );
}
