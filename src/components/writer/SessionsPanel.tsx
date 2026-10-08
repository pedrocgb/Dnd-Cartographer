"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardList, MessageSquareQuote, Plus } from "lucide-react";
import { api } from "@/components/calendars/api";
import type { ClientCampaign, ClientSession } from "@/components/sessions/types";
import { sessionHref, sessionLabel } from "@/components/sessions/types";
import { SUGGESTED_SECRETS, TIPS } from "@/server/writer/guides";
import { NODE_STATUS_LABELS, type OutlineNode } from "@/server/writer/types";
import SessionPrepDialog from "./SessionPrepDialog";
import SessionReviewDialog from "./SessionReviewDialog";
import { upsert, type WriterData } from "./useWriterData";
import { useT } from "@/i18n/useT";

/**
 * The Sessions tab: each session's planned scenes and prep, newest first.
 * Before a game: plan scenes and prep (the Lazy DM's eight steps). After
 * it: "What happened?" marks scenes played, changed or not reached (those
 * move on to the next session, like unrevealed secrets).
 */
export default function SessionsPanel({
  campaign,
  data,
  update,
  reload,
  guides,
  onOpenNode,
}: {
  campaign: ClientCampaign;
  data: WriterData;
  update: (fn: (d: WriterData) => WriterData) => void;
  reload: () => Promise<void>;
  guides: boolean;
  onOpenNode: (id: string) => void;
}) {
  const t = useT("writer");
  const [prepping, setPrepping] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ordered = [...data.sessions].sort((a, b) => b.number - a.number);
  const replaceSession = (s: ClientSession) => update((d) => ({ ...d, sessions: upsert(d.sessions, s) }));

  async function newSession() {
    const res = await api<{ session: ClientSession }>("POST", "/api/sessions", { campaignId: campaign.id });
    if (res.ok) replaceSession(res.data.session);
    else setError(res.data.error ?? t("sessions.couldNotCreate"));
  }

  async function plan(node: OutlineNode, sessionId: string | null) {
    const res = await api<{ node: OutlineNode }>("PATCH", `/api/outline/${node.id}`, { plannedSessionId: sessionId, expectedVersion: node.version });
    if (res.ok) update((d) => ({ ...d, nodes: upsert(d.nodes, res.data.node) }));
    else {
      setError(res.data.error ?? t("sessions.couldNotPlan"));
      if (res.status === 409) await reload();
    }
  }

  const prepSession = data.sessions.find((s) => s.id === prepping) ?? null;
  const reviewSession = data.sessions.find((s) => s.id === reviewing) ?? null;
  const unplanned = data.nodes.filter((n) => n.kind === "scene" && (n.status === "planned" || n.status === "ready") && n.plannedSessionId === null);

  return (
    <div className="wr-sessions">
      {guides && <p className="wr-tip">{t("sessions.tip")}</p>}
      <div className="wr-inline-actions">
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void newSession()}>
          <Plus size={14} /> {t("sessions.newSession")}
        </button>
        {unplanned.length > 0 && <span className="cal-help">{t("sessions.unplanned", { count: unplanned.length })}</span>}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {ordered.length === 0 && <p className="cal-help">{t("sessions.none")}</p>}
      <ul className="wr-session-list">
        {ordered.map((s) => {
          const scenes = data.nodes.filter((n) => n.kind === "scene" && n.plannedSessionId === s.id);
          const secrets = s.prep.secrets;
          return (
            <li key={s.id} className="wr-session">
              <header className="wr-session-head">
                <strong>{sessionLabel(s)}</strong>
                {s.prep.reviewed && (
                  <span className="cv-chip wr-reviewed">
                    <CheckCircle2 size={12} aria-hidden /> {t("sessions.reviewed")}
                  </span>
                )}
                <Link className="cal-help" href={sessionHref(s)}>
                  {t("sessions.log")}
                </Link>
              </header>
              {s.prep.strongStart && (
                <p className="wr-session-start">
                  <strong>{t("sessions.strongStart")}</strong> {s.prep.strongStart}
                </p>
              )}
              <p className="cal-help">
                {t("sessions.secrets", { n: secrets.length, total: SUGGESTED_SECRETS })}
                {secrets.length > 0 ? ` · ${t("sessions.revealed", { n: secrets.filter((x) => x.state === "revealed").length })}` : ""}
              </p>
              <ul className="wr-session-scenes">
                {scenes.map((n) => (
                  <li key={n.id}>
                    <span className={`wr-dot wr-dot-${n.status}`} data-tooltip={NODE_STATUS_LABELS[n.status]} aria-label={NODE_STATUS_LABELS[n.status]} role="img" />
                    <button type="button" className="btn-link" onClick={() => onOpenNode(n.id)}>
                      {n.title}
                    </button>
                    {!s.prep.reviewed && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void plan(n, null)}>
                        {t("sessions.unplan")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {!s.prep.reviewed && unplanned.length > 0 && (
                <select aria-label={t("sessions.planFor", { session: sessionLabel(s) })} value="" onChange={(e) => {
                  const node = unplanned.find((n) => n.id === e.target.value);
                  if (node) void plan(node, s.id);
                }}>
                  <option value="">{t("sessions.planPick")}</option>
                  {unplanned.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title}
                    </option>
                  ))}
                </select>
              )}
              <div className="wr-inline-actions">
                <button type="button" className="btn btn-sm" onClick={() => setPrepping(s.id)}>
                  <ClipboardList size={14} /> {t("sessions.prep")}
                </button>
                <button type="button" className="btn btn-sm" data-tooltip={TIPS.review} onClick={() => setReviewing(s.id)}>
                  <MessageSquareQuote size={14} /> {t("sessions.whatHappened")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {prepSession && <SessionPrepDialog key={prepSession.id} session={prepSession} scenes={data.nodes.filter((n) => n.kind === "scene" && n.plannedSessionId === prepSession.id)} guides={guides} onSaved={replaceSession} onClose={() => setPrepping(null)} />}
      {reviewSession && (
        <SessionReviewDialog
          key={reviewSession.id}
          session={reviewSession}
          scenes={data.nodes.filter((n) => n.kind === "scene" && n.plannedSessionId === reviewSession.id && n.status !== "skipped")}
          guides={guides}
          onDone={(res) => {
            update((d) => ({ ...d, nodes: res.nodes, sessions: res.sessions.reduce((list, x) => upsert(list, x), d.sessions) }));
            setReviewing(null);
          }}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}
