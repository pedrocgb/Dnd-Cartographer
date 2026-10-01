"use client";

import { formatInteger } from "@/server/settings/number-format";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { PageSkeleton, Skeleton } from "@/components/Skeleton";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Coins, Flame, Gem, Network, Pencil, Plus, ScrollText, Swords, Users } from "lucide-react";
import { api } from "@/components/calendars/api";
import { announceCampaignsChanged, readActiveCampaign, rememberActiveCampaign } from "@/components/campaign/active-campaign";
import { formatIsoDate } from "@/components/DatePicker";
import { dayLabel } from "@/components/calendars/evaluate";
import type { Chronology, ClientCalendar } from "@/components/calendars/types";
import { campaignTotals } from "@/server/sessions/totals";
import { PARTY } from "@/server/sessions/types";
import { isClosed, type FrontData, type QuestData, type QuestStatus } from "@/server/quests/types";
import QuestBoard, { type BoardMove } from "@/components/quests/QuestBoard";
import QuestEditor, { type QuestDraft } from "@/components/quests/QuestEditor";
import QuestView from "@/components/quests/QuestView";
import FrontsView from "@/components/quests/FrontsView";
import FrontEditor from "@/components/quests/FrontEditor";
import { Progress, StatusChip, useCandidates } from "@/components/quests/parts";
import CampaignEditor from "./CampaignEditor";
import SessionEditor from "./SessionEditor";
import SessionView from "./SessionView";
import { Avatar, formatBase, formatCoins, STATUS_LABELS } from "./parts";
import type { ClientCampaign, ClientSession } from "./types";

type MainView = "sessions" | "quests" | "fronts" | "map";

const viewParam = (v: string | null): MainView => (v === "quests" || v === "fronts" || v === "map" ? v : "sessions");

/** The relationship map (React Flow) loads only when its tab opens. */
const QuestMap = dynamic(() => import("@/components/quests/QuestMap"), { ssr: false, loading: () => <Skeleton height="70vh" radius="var(--radius-md)" /> });

/** Keeps ?campaign=&session=&view=&quest= in the address bar without a navigation. */
function syncUrl(values: Record<"campaign" | "session" | "view" | "quest", string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(null, "", url);
}

/** The sidebar's "Active quests": active ones first, then hooks, by priority. */
const activeQuests = (quests: QuestData[]) =>
  quests
    .filter((q) => q.status === "active" || q.status === "hook")
    .sort((a, b) => Number(a.status !== "active") - Number(b.status !== "active") || b.priority - a.priority || a.title.localeCompare(b.title));

/**
 * The Sessions page: campaigns (sidebar) with their party, running totals
 * and active quests; the selected campaign's sessions or its quest board
 * (main). Sessions and quests open in a read-only view; Edit opens their
 * editor.
 */
export default function SessionsManager() {
  const params = useSearchParams();
  const [calendars, setCalendars] = useState<ClientCalendar[] | null>(null);
  const [chronology, setChronology] = useState<Chronology | null>(null);
  const [campaigns, setCampaigns] = useState<ClientCampaign[] | null>(null);
  // The Campaign area's active campaign: the address's, else the last one used here or in the Writer.
  const [campaignId, setCampaignId] = useState<string | null>(() => params.get("campaign") ?? readActiveCampaign());
  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [viewing, setViewing] = useState<string | null>(params.get("session"));
  const [editing, setEditing] = useState<string | null>(null);
  const [campaignEditor, setCampaignEditor] = useState<"new" | "edit" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mainView, setMainView] = useState<MainView>(viewParam(params.get("view")));
  const [quests, setQuests] = useState<QuestData[]>([]);
  const [fronts, setFronts] = useState<FrontData[]>([]);
  const [editingFront, setEditingFront] = useState<string | "new" | null>(null);
  const [viewingQuest, setViewingQuest] = useState<string | null>(params.get("quest"));
  const [editingQuest, setEditingQuest] = useState<{ id: string | null; draft?: QuestDraft } | null>(null);
  const candidates = useCandidates(mainView === "quests" || mainView === "map" || viewingQuest !== null || editingQuest !== null);

  const loadWorld = useCallback(async () => {
    const [cal, camp] = await Promise.all([api<{ calendars: ClientCalendar[]; chronology: Chronology }>("GET", "/api/calendars"), api<{ campaigns: ClientCampaign[] }>("GET", "/api/campaigns")]);
    if (!cal.ok || !camp.ok) {
      setLoadError(cal.data.error ?? camp.data.error ?? "Could not load the campaigns.");
      return;
    }
    setCalendars(cal.data.calendars);
    setChronology(cal.data.chronology);
    setCampaigns(camp.data.campaigns);
    announceCampaignsChanged();
  }, []);

  const loadSessions = useCallback(async (id: string) => {
    const res = await api<{ sessions: ClientSession[] }>("GET", `/api/sessions?campaignId=${encodeURIComponent(id)}`);
    if (res.ok) setSessions(res.data.sessions);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<{ calendars: ClientCalendar[]; chronology: Chronology }>("GET", "/api/calendars"), api<{ campaigns: ClientCampaign[] }>("GET", "/api/campaigns")]).then(([cal, camp]) => {
      if (cancelled) return;
      if (!cal.ok || !camp.ok) {
        setLoadError(cal.data.error ?? camp.data.error ?? "Could not load the campaigns.");
        return;
      }
      setCalendars(cal.data.calendars);
      setChronology(cal.data.chronology);
      setCampaigns(camp.data.campaigns);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // No (valid) campaign picked: the first live one.
  const campaign = campaigns?.find((c) => c.id === campaignId) ?? campaigns?.find((c) => !c.archived) ?? null;
  const activeId = campaign?.id ?? null;

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    api<{ sessions: ClientSession[] }>("GET", `/api/sessions?campaignId=${encodeURIComponent(activeId)}`).then((res) => {
      if (!cancelled && res.ok) setSessions(res.data.sessions);
    });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    Promise.all([api<{ quests: QuestData[] }>("GET", `/api/campaigns/${encodeURIComponent(activeId)}/quests`), api<{ fronts: FrontData[] }>("GET", `/api/campaigns/${encodeURIComponent(activeId)}/fronts`)]).then(([q, f]) => {
      if (cancelled) return;
      if (q.ok) setQuests(q.data.quests);
      if (f.ok) setFronts(f.data.fronts);
    });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const loadQuests = useCallback(async (id: string) => {
    const res = await api<{ quests: QuestData[] }>("GET", `/api/campaigns/${encodeURIComponent(id)}/quests`);
    if (res.ok) setQuests(res.data.quests);
  }, []);

  useEffect(() => {
    syncUrl({ campaign: activeId, session: viewing, view: mainView === "sessions" ? null : mainView, quest: viewingQuest });
    rememberActiveCampaign(activeId);
  }, [activeId, viewing, mainView, viewingQuest]);

  const visibleSessions = useMemo(() => (activeId ? sessions.filter((s) => s.campaignId === activeId) : []), [sessions, activeId]);
  const totals = useMemo(() => (campaign ? campaignTotals(visibleSessions, campaign.roster.map((m) => m.personId), campaign.currencies) : null), [campaign, visibleSessions]);
  const visibleQuests = useMemo(() => (activeId ? quests.filter((q) => q.campaignId === activeId) : []), [quests, activeId]);
  const visibleFronts = useMemo(() => (activeId ? fronts.filter((f) => f.campaignId === activeId) : []), [fronts, activeId]);
  const def = calendars?.find((c) => c.id === campaign?.calendarId)?.definition ?? null;

  function pick(id: string) {
    setCampaignId(id);
    setViewing(null);
    setViewingQuest(null);
    setSessions([]);
    setQuests([]);
    setFronts([]);
  }

  // The header's campaign picker changes the address: follow it.
  const urlCampaign = params.get("campaign");
  const [lastUrlCampaign, setLastUrlCampaign] = useState(urlCampaign);
  if (urlCampaign !== lastUrlCampaign) {
    setLastUrlCampaign(urlCampaign);
    if (urlCampaign && urlCampaign !== activeId) pick(urlCampaign);
  }

  const replaceFront = (f: FrontData) => setFronts((list) => (list.some((x) => x.id === f.id) ? list.map((x) => (x.id === f.id ? f : x)) : [...list, f]));
  const replaceQuest = (q: QuestData) => setQuests((list) => (list.some((x) => x.id === q.id) ? list.map((x) => (x.id === q.id ? q : x)) : [...list, q]));

  /** A board drop: the moved card's status, and the new order of its column (only changed cards are saved). */
  async function moveQuest({ id, status, order }: BoardMove) {
    const before = quests;
    const changes = order.flatMap((qid, sortOrder) => {
      const q = before.find((x) => x.id === qid);
      if (!q) return [];
      const nextStatus: QuestStatus = qid === id ? status : q.status;
      return q.sortOrder === sortOrder && q.status === nextStatus ? [] : [{ q, patch: { status: nextStatus, sortOrder } }];
    });
    setQuests((list) => list.map((q) => changes.find((c) => c.q.id === q.id) ? { ...q, ...changes.find((c) => c.q.id === q.id)!.patch } : q));
    for (const { q, patch } of changes) {
      const res = await api<{ quest: QuestData }>("PATCH", `/api/quests/${q.id}`, { ...patch, expectedVersion: q.version });
      if (res.ok) replaceQuest(res.data.quest);
      else {
        setNotice(res.data.error ?? "Could not move the quest.");
        if (activeId) await loadQuests(activeId);
        return;
      }
    }
  }

  async function newSession() {
    if (!campaign) return;
    const res = await api<{ session: ClientSession }>("POST", "/api/sessions", { campaignId: campaign.id });
    if (!res.ok) {
      setNotice(res.data.error ?? "Could not create the session.");
      return;
    }
    setSessions((list) => [...list, res.data.session]);
    setEditing(res.data.session.id);
  }

  const replaceSession = (s: ClientSession) => setSessions((list) => list.map((x) => (x.id === s.id ? s : x)));

  if (loadError) return <p className="form-error ss-page-error">{loadError}</p>;
  if (!calendars || !campaigns || !chronology) return <PageSkeleton label="Loading sessions…" main="cards" />;

  const liveCalendars = calendars.filter((c) => !c.trashed);
  const listed = campaigns.filter((c) => showArchived || !c.archived || c.id === activeId);
  const archivedCount = campaigns.filter((c) => c.archived).length;
  const viewed = visibleSessions.find((s) => s.id === viewing) ?? null;
  const edited = visibleSessions.find((s) => s.id === editing) ?? null;

  const sidebar = (
    <aside className="articles-sidebar ss-sidebar" aria-label="Campaigns">
      <section className="cal-side-section">
        <h2 className="field-label">Campaigns</h2>
        <ul className="cal-side-list">
          {listed.map((c) => (
            <li key={c.id} className="cal-side-item">
              <button type="button" className={c.id === activeId ? "articles-folder active" : "articles-folder"} aria-current={c.id === activeId} onClick={() => pick(c.id)}>
                <ScrollText size={16} aria-hidden />
                <span className="articles-folder-name">{c.name}</span>
                {c.status === "finished" && <span className="cal-default-badge">Finished</span>}
                {c.archived && <span className="cal-default-badge">Archived</span>}
              </button>
            </li>
          ))}
        </ul>
        {archivedCount > 0 && (
          <label className="cal-check">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived ({archivedCount})
          </label>
        )}
        <button type="button" className="articles-folder articles-create" disabled={liveCalendars.length === 0} onClick={() => setCampaignEditor("new")}>
          <Plus size={16} />
          <span className="articles-folder-name">New campaign</span>
        </button>
      </section>

      {campaign && totals && (
        <>
          <section className="cal-side-section">
            <h2 className="field-label">Party</h2>
            {campaign.roster.length === 0 ? (
              <p className="cal-help">No characters yet. Add them in the campaign&apos;s settings.</p>
            ) : (
              <ul className="ss-party">
                {campaign.roster.map((m) => (
                  <li key={m.id}>
                    <Avatar member={m} size={32} />
                    <span className="ss-party-main">
                      <strong>{m.name ?? "(deleted character)"}</strong>
                      <span className="cal-help">
                        {[m.playerName, m.status !== "active" && STATUS_LABELS[m.status]].filter(Boolean).join(" · ") || " "}
                      </span>
                      <span className="ss-party-stats">
                        <span>{formatInteger(totals[m.personId]?.xp ?? 0)} XP</span>
                        <span>{formatCoins(totals[m.personId]?.coins ?? {}, campaign.currencies)}</span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="ss-stash">
              <Coins size={14} aria-hidden />
              <span>
                <strong>Party stash</strong>
                <span className="cal-help">
                  {formatCoins(totals[PARTY].coins, campaign.currencies)}
                  {totals[PARTY].loot.length ? ` · ${totals[PARTY].loot.length} item${totals[PARTY].loot.length === 1 ? "" : "s"}` : ""}
                </span>
              </span>
            </div>
          </section>

          <section className="cal-side-section">
            <h2 className="field-label">Active quests</h2>
            {activeQuests(visibleQuests).length === 0 ? (
              <p className="cal-help">Nothing on the party&apos;s plate.</p>
            ) : (
              <ul className="ss-open-threads">
                {activeQuests(visibleQuests)
                  .slice(0, 30)
                  .map((q) => (
                    <li key={q.id}>
                      <button type="button" className="ss-thread-link qs-side-quest" onClick={() => setViewingQuest(q.id)}>
                        <span className="qs-side-title">
                          {q.status === "hook" && <StatusChip status="hook" />} {q.title}
                        </span>
                        <Progress objectives={q.objectives} />
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            <button type="button" className="btn btn-sm btn-ghost qs-side-all" onClick={() => setMainView("quests")}>
              <Swords size={14} /> Quest board ({visibleQuests.filter((q) => !isClosed(q.status)).length} open)
            </button>
          </section>
        </>
      )}
    </aside>
  );

  if (liveCalendars.length === 0 || !campaign) {
    return (
      <div className="articles-page">
        {sidebar}
        <main className="articles-main">
          <div className="articles-landing">
            <ScrollText size={40} strokeWidth={1.5} aria-hidden />
            <h1>Sessions</h1>
            {liveCalendars.length === 0 ? (
              <>
                <p className="cal-help">Sessions record in-world dates, so the world needs a calendar first.</p>
                <Link className="btn btn-primary" href="/calendars">
                  Go to Calendars
                </Link>
              </>
            ) : (
              <>
                <p className="cal-help">Start a campaign: its party, its coins and the calendar its dates are read in. Then log every session you play.</p>
                <button type="button" className="btn btn-primary" onClick={() => setCampaignEditor("new")}>
                  New campaign
                </button>
              </>
            )}
          </div>
        </main>
        {campaignEditor === "new" && (
          <CampaignEditor
            campaign={null}
            calendars={calendars}
            defaultCalendarId={chronology.defaultCalendarId}
            onClose={() => setCampaignEditor(null)}
            onChanged={() => void loadWorld()}
            onDeleted={() => setCampaignEditor(null)}
            onSaved={async (c) => {
              await loadWorld();
              pick(c.id);
              setCampaignEditor("edit");
            }}
          />
        )}
      </div>
    );
  }

  const calendarName = calendars.find((c) => c.id === campaign.calendarId)?.name ?? "a removed calendar";
  const ordered = [...visibleSessions].sort((a, b) => b.number - a.number);
  const shownQuest = visibleQuests.find((q) => q.id === viewingQuest) ?? null;
  const editedQuest = editingQuest?.id ? (visibleQuests.find((q) => q.id === editingQuest.id) ?? null) : null;

  return (
    <div className="articles-page">
      {sidebar}
      <main className="articles-main ss-main">
        <header className="ss-header">
          <div className="ss-header-text">
            <h1>{campaign.name}</h1>
            <p className="cal-help">
              {visibleSessions.length} session{visibleSessions.length === 1 ? "" : "s"} · {campaign.roster.filter((m) => m.status === "active").length} active character{campaign.roster.filter((m) => m.status === "active").length === 1 ? "" : "s"} · dates in {calendarName}
              {totals ? ` · party wealth ≈ ${formatBase(Object.values(totals).reduce((n, h) => n + h.base, 0), campaign.currencies)}` : ""}
            </p>
            {campaign.description && <p className="ss-description">{campaign.description}</p>}
          </div>
          <div className="ss-header-actions">
            <button type="button" className="btn btn-sm" onClick={() => setCampaignEditor("edit")}>
              <Pencil size={14} /> Campaign settings
            </button>
            {mainView === "sessions" ? (
              <button type="button" className="btn btn-sm btn-primary" onClick={newSession}>
                <Plus size={14} /> New session
              </button>
            ) : mainView === "quests" || mainView === "map" ? (
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setEditingQuest({ id: null })}>
                <Plus size={14} /> New quest
              </button>
            ) : (
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setEditingFront("new")}>
                <Plus size={14} /> New front
              </button>
            )}
          </div>
        </header>
        <nav className="cal-editor-tabs ss-view-tabs" role="tablist" aria-label="Show">
          <button type="button" role="tab" aria-selected={mainView === "sessions"} className={mainView === "sessions" ? "cal-tab active" : "cal-tab"} onClick={() => setMainView("sessions")}>
            <ScrollText size={14} aria-hidden /> Sessions <span className="cel-tab-count">{visibleSessions.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={mainView === "quests"} className={mainView === "quests" ? "cal-tab active" : "cal-tab"} onClick={() => setMainView("quests")}>
            <Swords size={14} aria-hidden /> Quests <span className="cel-tab-count">{visibleQuests.filter((q) => !isClosed(q.status)).length}</span>
          </button>
          <button type="button" role="tab" aria-selected={mainView === "fronts"} className={mainView === "fronts" ? "cal-tab active" : "cal-tab"} onClick={() => setMainView("fronts")}>
            <Flame size={14} aria-hidden /> Fronts <span className="cel-tab-count">{visibleFronts.filter((f) => f.status === "active").length}</span>
          </button>
          <button type="button" role="tab" aria-selected={mainView === "map"} className={mainView === "map" ? "cal-tab active" : "cal-tab"} onClick={() => setMainView("map")}>
            <Network size={14} aria-hidden /> Map
          </button>
        </nav>
        {notice && (
          <p className="form-error" role="alert">
            {notice}
          </p>
        )}

        {mainView === "map" ? (
          <QuestMap key={campaign.id} campaignId={campaign.id} quests={visibleQuests} fronts={visibleFronts} candidates={candidates} onOpenQuest={setViewingQuest} onOpenFront={setEditingFront} />
        ) : mainView === "fronts" ? (
          <FrontsView fronts={visibleFronts} quests={visibleQuests} onChanged={replaceFront} onEdit={setEditingFront} onNew={() => setEditingFront("new")} onOpenQuest={setViewingQuest} />
        ) : mainView === "quests" ? (
          <QuestBoard quests={visibleQuests} fronts={visibleFronts} candidates={candidates} def={def} today={chronology.currentDay} onOpen={setViewingQuest} onMove={(m) => void moveQuest(m)} onNew={(status) => setEditingQuest({ id: null, draft: { status } })} />
        ) : ordered.length === 0 ? (
          <div className="ss-empty">
            <p className="cal-help">No sessions yet. After your next game, log it here: what happened, who they met, what they found.</p>
          </div>
        ) : (
          <ul className="ss-cards">
            {ordered.map((s) => {
              const present = campaign.roster.filter((m) => s.attendance.includes(m.personId));
              return (
                <li key={s.id}>
                  <button type="button" className="ss-card" onClick={() => setViewing(s.id)}>
                    <span className="ss-card-number" aria-hidden>
                      {s.number}
                    </span>
                    <span className="ss-card-main">
                      <strong className="ss-card-title">{s.title || `Session ${s.number}`}</strong>
                      <span className="ss-card-meta">
                        {def && s.startDay !== null && (
                          <span>
                            <CalendarDays size={12} aria-hidden /> {dayLabel(def, s.startDay, { weekday: false })}
                            {s.endDay !== null && s.endDay > s.startDay ? ` – ${dayLabel(def, s.endDay, { weekday: false })}` : ""}
                          </span>
                        )}
                        {s.playedOn && <span>Played {formatIsoDate(s.playedOn)}</span>}
                      </span>
                      <span className="ss-card-foot">
                        <span className="ss-present">
                          {present.map((m) => (
                            <Avatar key={m.id} member={m} size={22} />
                          ))}
                        </span>
                        <span className="ss-card-stats">
                        {s.xpTotal !== null && <span className="cv-chip">{formatInteger(s.xpTotal)} XP</span>}
                        {s.loot.length > 0 && (
                          <span className="cv-chip">
                            <Gem size={11} aria-hidden /> {s.loot.length}
                          </span>
                        )}
                        {s.questLog.length > 0 && (
                          <span className="cv-chip" data-tooltip="Quests logged this session">
                            <Swords size={11} aria-hidden /> {s.questLog.length}
                          </span>
                        )}
                        {s.articleLinks.length > 0 && (
                          <span className="cv-chip">
                            <Users size={11} aria-hidden /> {s.articleLinks.length}
                          </span>
                        )}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {campaignEditor && (
        <CampaignEditor
          key={campaignEditor === "new" ? "new" : campaign.id}
          campaign={campaignEditor === "new" ? null : campaign}
          calendars={calendars}
          defaultCalendarId={chronology.defaultCalendarId}
          onClose={() => setCampaignEditor(null)}
          onChanged={() => void loadWorld()}
          onDeleted={async () => {
            setCampaignEditor(null);
            setCampaignId(null);
            await loadWorld();
          }}
          onSaved={async (c) => {
            await loadWorld();
            if (campaignEditor === "new") {
              pick(c.id);
              setCampaignEditor("edit");
            } else setCampaignEditor(null);
          }}
        />
      )}
      {viewed && !edited && (
        <SessionView
          key={viewed.id}
          session={viewed}
          campaign={campaign}
          calendars={calendars}
          onClose={() => setViewing(null)}
          quests={visibleQuests}
          onOpenQuest={(id) => {
            setViewing(null);
            setViewingQuest(id);
          }}
          onEdit={() => setEditing(viewed.id)}
          onDeleted={async () => {
            setViewing(null);
            await loadSessions(campaign.id);
          }}
        />
      )}
      {edited && (
        <SessionEditor
          key={edited.id}
          session={edited}
          campaign={campaign}
          calendars={calendars}
          chronology={chronology}
          quests={visibleQuests}
          onQuestCreated={replaceQuest}
          onClose={() => setEditing(null)}
          onSaved={async (s, moved) => {
            replaceSession(s);
            setEditing(null);
            setViewing(s.id);
            // The session's quest log may have moved quests along.
            await Promise.all([loadQuests(campaign.id), moved ? loadWorld() : null]);
          }}
        />
      )}
      {shownQuest && !editingQuest && (
        <QuestView
          key={shownQuest.id}
          quest={shownQuest}
          quests={visibleQuests}
          fronts={visibleFronts}
          currencies={campaign.currencies}
          sessions={visibleSessions}
          candidates={candidates}
          def={def}
          today={chronology.currentDay}
          onOpenQuest={setViewingQuest}
          onOpenSession={(id) => {
            setViewingQuest(null);
            setViewing(id);
          }}
          onEdit={() => setEditingQuest({ id: shownQuest.id })}
          onAddSub={() => setEditingQuest({ id: null, draft: { parentId: shownQuest.id, status: shownQuest.status === "hook" ? "hook" : "active" } })}
          onChanged={replaceQuest}
          onDeleted={async () => {
            setViewingQuest(null);
            await loadQuests(campaign.id);
          }}
          onClose={() => setViewingQuest(null)}
        />
      )}
      {editingQuest && (editingQuest.id === null || editedQuest) && (
        <QuestEditor
          key={editingQuest.id ?? "new"}
          campaignId={campaign.id}
          quest={editedQuest}
          draft={editingQuest.draft}
          quests={visibleQuests}
          fronts={visibleFronts}
          currencies={campaign.currencies}
          def={def}
          currentDay={chronology.currentDay}
          candidates={candidates}
          onClose={() => setEditingQuest(null)}
          onSaved={(q) => {
            replaceQuest(q);
            setEditingQuest(null);
            setViewingQuest(q.id);
          }}
          onDeleted={async () => {
            setEditingQuest(null);
            setViewingQuest(null);
            await loadQuests(campaign.id);
          }}
        />
      )}
      {editingFront && (editingFront === "new" || visibleFronts.some((f) => f.id === editingFront)) && (
        <FrontEditor
          key={editingFront}
          campaignId={campaign.id}
          front={editingFront === "new" ? null : (visibleFronts.find((f) => f.id === editingFront) ?? null)}
          onClose={() => setEditingFront(null)}
          onSaved={(f) => {
            replaceFront(f);
            setEditingFront(null);
          }}
          onDeleted={(id) => {
            setEditingFront(null);
            setFronts((list) => list.filter((f) => f.id !== id));
            setQuests((list) => list.map((q) => (q.frontId === id ? { ...q, frontId: null } : q)));
          }}
        />
      )}
    </div>
  );
}
