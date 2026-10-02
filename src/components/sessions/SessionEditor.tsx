"use client";

import { useEffect, useState } from "react";
import { BookOpen, Coins, ListChecks, Plus, ScrollText, Swords, Trash2, Users, Waypoints } from "lucide-react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import RichEditor from "@/components/RichEditor";
import DatePicker from "@/components/DatePicker";
import InfoPicker from "@/components/articles/InfoPicker";
import { candidateOptions, loadCandidates, type Candidate } from "@/components/articles/candidates";
import ArticleLinksSection from "@/components/calendars/ArticleLinksSection";
import WorldDatePicker from "@/components/calendars/WorldDatePicker";
import { api, newId, notifyWorldDateChanged } from "@/components/calendars/api";
import { dayLabel, safe } from "@/components/calendars/evaluate";
import type { ArticleRef, Chronology, ClientCalendar } from "@/components/calendars/types";
import { fromWorldDay, type CalendarDefinition } from "@/server/calendars/engine";
import { xpShares } from "@/server/sessions/totals";
import { PARTY, type CoinLine, type LootLine, type SessionNotes } from "@/server/sessions/types";
import type { QuestData, QuestLogLine, Rewards } from "@/server/quests/types";
import { rewardsToSessionLines } from "@/server/quests/logic";
import SessionQuestLog from "@/components/quests/SessionQuestLog";
import { Avatar } from "./parts";
import type { ClientCampaign, ClientSession, RosterMember } from "./types";

type Tab = "summary" | "recap" | "notes" | "quests" | "involved" | "party" | "loot";

/** One text line per row, with add/remove. */
function LineList({ label, hint, lines, onChange, placeholder }: { label: string; hint: string; lines: string[]; onChange: (l: string[]) => void; placeholder: string }) {
  return (
    <div className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>{label}</h3>
          <p className="cal-help">{hint}</p>
        </div>
      </header>
      {lines.map((line, i) => (
        <div key={i} className="ss-line">
          <input type="text" aria-label={`${label} ${i + 1}`} value={line} maxLength={500} placeholder={placeholder} onChange={(e) => onChange(lines.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove line ${i + 1}`} onClick={() => onChange(lines.filter((_, j) => j !== i))}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-sm" disabled={lines.length >= 100} onClick={() => onChange([...lines, ""])}>
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  );
}

function RecipientSelect({ value, roster, onChange, label }: { value: string; roster: RosterMember[]; onChange: (v: string) => void; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value={PARTY}>Party stash</option>
      {roster.map((m) => (
        <option key={m.personId} value={m.personId}>
          {m.name ?? "(deleted character)"}
        </option>
      ))}
    </select>
  );
}

function LootTab({ campaign, loot, coins, onLoot, onCoins }: { campaign: ClientCampaign; loot: LootLine[]; coins: CoinLine[]; onLoot: (l: LootLine[]) => void; onCoins: (c: CoinLine[]) => void }) {
  const [items, setItems] = useState<Candidate[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadCandidates()
      .then((c) => !cancelled && setItems(c.filter((x) => x.template === "item")))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, []);
  const currencies = campaign.currencies;
  const setLine = (id: string, patch: Partial<LootLine>) => onLoot(loot.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const setCoin = (id: string, patch: Partial<CoinLine>) => onCoins(coins.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const biggest = [...currencies].sort((a, b) => b.value - a.value)[0]?.id ?? "";
  return (
    <>
      <div className="cel-section">
        <header className="cel-section-head">
          <div>
            <h3>Loot</h3>
            <p className="cal-help">Type an item, or link an Item article. Who got it keeps the inventory history straight.</p>
          </div>
        </header>
        {loot.map((l) => (
          <div key={l.id} className="ss-loot-row">
            <div className="ss-loot-item">
              {l.articleId ? (
                <span className="ss-linked-item">
                  <BookOpen size={13} aria-hidden /> {items?.find((x) => x.id === l.articleId)?.name ?? l.name}
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Unlink the item" onClick={() => setLine(l.id, { articleId: null, template: null })}>
                    ×
                  </button>
                </span>
              ) : (
                <>
                  <input type="text" aria-label="Item" value={l.name} maxLength={120} placeholder="Silver ring" onChange={(e) => setLine(l.id, { name: e.target.value })} />
                  <InfoPicker
                    options={candidateOptions(items ?? [])}
                    value={null}
                    placeholder="or link an Item…"
                    ariaLabel="Link an Item article"
                    disabled={!items || items.length === 0}
                    onChange={(id) => {
                      const c = items?.find((x) => x.id === id);
                      if (c) setLine(l.id, { articleId: c.id, template: c.template, name: c.name });
                    }}
                  />
                </>
              )}
            </div>
            <label className="ss-mini">
              <span className="field-label">Qty</span>
              <input type="number" min={1} value={l.quantity} onChange={(e) => setLine(l.id, { quantity: Math.max(1, Math.floor(Number(e.target.value)) || 1) })} />
            </label>
            <label className="ss-mini">
              <span className="field-label">Value each</span>
              <span className="ss-value">
                <input type="number" min={0} value={l.value?.amount ?? ""} placeholder="—" onChange={(e) => setLine(l.id, { value: e.target.value === "" ? null : { currencyId: l.value?.currencyId ?? biggest, amount: Math.max(0, Math.floor(Number(e.target.value)) || 0) } })} />
                <select aria-label="Value coin" value={l.value?.currencyId ?? biggest} disabled={!l.value} onChange={(e) => l.value && setLine(l.id, { value: { ...l.value, currencyId: e.target.value } })}>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.short}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="ss-mini">
              <span className="field-label">Given to</span>
              <RecipientSelect label="Given to" value={l.recipient} roster={campaign.roster} onChange={(recipient) => setLine(l.id, { recipient })} />
            </label>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Remove loot line" onClick={() => onLoot(loot.filter((x) => x.id !== l.id))}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="btn btn-sm" disabled={loot.length >= 200} onClick={() => onLoot([...loot, { id: newId("loot"), name: "", template: null, articleId: null, quantity: 1, value: null, recipient: PARTY }])}>
            <Plus size={14} /> Add loot
          </button>
        </div>
      </div>
      <div className="cel-section">
        <header className="cel-section-head">
          <div>
            <h3>Coins</h3>
            <p className="cal-help">Found, paid or earned. A negative amount is money spent or lost.</p>
          </div>
        </header>
        {coins.map((c) => (
          <div key={c.id} className="ss-coin-line">
            <input type="number" aria-label="Amount" value={c.amount} onChange={(e) => setCoin(c.id, { amount: Math.floor(Number(e.target.value)) || 0 })} />
            <select aria-label="Coin" value={c.currencyId} onChange={(e) => setCoin(c.id, { currencyId: e.target.value })}>
              {currencies.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({x.short})
                </option>
              ))}
            </select>
            <RecipientSelect label="Goes to" value={c.recipient} roster={campaign.roster} onChange={(recipient) => setCoin(c.id, { recipient })} />
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Remove coin line" onClick={() => onCoins(coins.filter((x) => x.id !== c.id))}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="btn btn-sm" disabled={coins.length >= 200} onClick={() => onCoins([...coins, { id: newId("coin"), currencyId: biggest, amount: 1, recipient: PARTY }])}>
            <Plus size={14} /> Add coins
          </button>
        </div>
      </div>
    </>
  );
}

function PartyTab({ roster, attendance, xpTotal, overrides, onAttendance, onXpTotal, onOverrides }: { roster: RosterMember[]; attendance: string[]; xpTotal: string; overrides: Record<string, string>; onAttendance: (a: string[]) => void; onXpTotal: (v: string) => void; onOverrides: (o: Record<string, string>) => void }) {
  const total = xpTotal === "" ? null : Math.max(0, Math.floor(Number(xpTotal)) || 0);
  const numeric = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== "").map(([k, v]) => [k, Math.max(0, Math.floor(Number(v)) || 0)]));
  const shares = xpShares(attendance, total, numeric, roster.map((m) => m.personId));
  return (
    <div className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>Who played</h3>
          <p className="cal-help">The session&apos;s XP is split evenly among those who played. Type a number next to someone to give them a different amount; leave XP empty for milestone games.</p>
        </div>
      </header>
      <label className="cal-field ss-xp-total">
        <span className="field-label">Session XP</span>
        <input type="number" min={0} value={xpTotal} placeholder="Milestone (no XP)" onChange={(e) => onXpTotal(e.target.value)} />
      </label>
      {roster.length === 0 ? (
        <p className="cel-empty">The party is empty. Add characters in the campaign&apos;s settings.</p>
      ) : (
        <ul className="ss-attendance">
          {roster.map((m) => {
            const here = attendance.includes(m.personId);
            return (
              <li key={m.id} className={here ? "present" : undefined}>
                <label className="ss-attendee">
                  <input type="checkbox" checked={here} onChange={(e) => onAttendance(e.target.checked ? [...attendance, m.personId] : attendance.filter((x) => x !== m.personId))} />
                  <Avatar member={m} />
                  <span>
                    <strong>{m.name ?? "(deleted character)"}</strong>
                    {m.playerName && <span className="cal-help"> · {m.playerName}</span>}
                  </span>
                </label>
                {here && (
                  <input type="number" min={0} className="ss-xp-share" aria-label={`XP for ${m.name ?? "character"}`} value={overrides[m.personId] ?? ""} placeholder={String(shares[m.personId] ?? 0)} onChange={(e) => onOverrides({ ...overrides, [m.personId]: e.target.value })} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const toLocal = (def: CalendarDefinition, day: number) => safe(() => fromWorldDay(def, day), null);

/**
 * Edit every part of a session in tabs. Saving sends one PATCH; if the
 * session ends after the world's current date, it then offers to move the
 * current date there. The recap autosaves on its own (rich document).
 */
export default function SessionEditor({
  session,
  campaign,
  calendars,
  chronology,
  quests,
  onQuestCreated,
  onSaved,
  onClose,
}: {
  session: ClientSession;
  campaign: ClientCampaign;
  calendars: ClientCalendar[];
  chronology: Chronology;
  /** The campaign's quests (for the Quests tab). */
  quests: QuestData[];
  onQuestCreated: (q: QuestData) => void;
  onSaved: (s: ClientSession, movedDate: boolean) => void;
  onClose: () => void;
}) {
  const calendar = calendars.find((c) => c.id === campaign.calendarId) ?? null;
  const def = calendar?.definition ?? null;
  const [tab, setTab] = useState<Tab>("summary");
  const [number, setNumber] = useState(String(session.number));
  const [title, setTitle] = useState(session.title);
  const [playedOn, setPlayedOn] = useState(session.playedOn ?? "");
  const [startDay, setStartDay] = useState(session.startDay);
  const [endDay, setEndDay] = useState(session.endDay);
  const [notes, setNotes] = useState<SessionNotes>(session.notes);
  const [links, setLinks] = useState<ArticleRef[]>(session.articleLinks);
  const [attendance, setAttendance] = useState(session.attendance);
  const [xpTotal, setXpTotal] = useState(session.xpTotal === null ? "" : String(session.xpTotal));
  const [overrides, setOverrides] = useState<Record<string, string>>(Object.fromEntries(Object.entries(session.xpOverrides).map(([k, v]) => [k, String(v)])));
  const [loot, setLoot] = useState(session.loot);
  const [coins, setCoins] = useState(session.coins);
  const [questLog, setQuestLog] = useState<QuestLogLine[]>(session.questLog);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advance, setAdvance] = useState<{ saved: ClientSession; to: number } | null>(null);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  const start = def && startDay !== null ? toLocal(def, startDay) : null;

  async function save() {
    setSaving(true);
    setError(null);
    const xpOverrides = Object.fromEntries(Object.entries(overrides).filter(([k, v]) => v !== "" && attendance.includes(k)).map(([k, v]) => [k, Math.max(0, Math.floor(Number(v)) || 0)]));
    const body = {
      expectedVersion: session.version,
      number: Math.floor(Number(number)) || 0,
      title,
      playedOn: playedOn || null,
      startDay,
      endDay: startDay === null ? null : endDay,
      notes: { ...notes, events: notes.events.filter((x) => x.trim()), decisions: notes.decisions.filter((x) => x.trim()) },
      questLog,
      articleLinks: links,
      attendance,
      xpTotal: xpTotal === "" ? null : Math.max(0, Math.floor(Number(xpTotal)) || 0),
      xpOverrides,
      loot,
      coins: coins.filter((c) => c.amount !== 0),
    };
    const res = await api<{ session: ClientSession }>("PATCH", `/api/sessions/${session.id}`, body);
    setSaving(false);
    if (!res.ok) {
      setError(res.data.error ?? "Could not save the session.");
      return;
    }
    const saved = res.data.session;
    if (saved.endDay !== null && saved.endDay > chronology.currentDay) setAdvance({ saved, to: saved.endDay });
    else onSaved(saved, false);
  }

  /** A completed quest's rewards: XP added to the session's total, coins and items to the party stash. */
  function addRewards(rewards: Rewards) {
    const lines = rewardsToSessionLines(rewards, newId);
    if (lines.xp !== null) setXpTotal(String((Math.max(0, Math.floor(Number(xpTotal)) || 0)) + lines.xp));
    setLoot((l) => [...l, ...lines.loot]);
    setCoins((c) => [...c, ...lines.coins]);
  }

  async function moveDate() {
    if (!advance) return;
    const res = await api("PATCH", "/api/chronology", { currentDay: advance.to, expectedRevision: chronology.revision });
    if (res.ok) {
      notifyWorldDateChanged();
      onSaved(advance.saved, true);
    } else setAdvanceError(res.data.error ?? "Could not move the date (it may have changed elsewhere). The session itself is saved.");
  }

  const tabs: { key: Tab; label: string; Icon: typeof Users; count?: number }[] = [
    { key: "summary", label: "Summary", Icon: ScrollText },
    { key: "recap", label: "Recap", Icon: BookOpen },
    { key: "notes", label: "Notes", Icon: ListChecks, count: notes.events.length + notes.decisions.length },
    { key: "quests", label: "Quests", Icon: Swords, count: questLog.length },
    { key: "involved", label: "Involved", Icon: Waypoints, count: links.length },
    { key: "party", label: "Party & XP", Icon: Users, count: attendance.length },
    { key: "loot", label: "Loot & coins", Icon: Coins, count: loot.length + coins.length },
  ];

  return (
    <Modal open onClose={onClose} title={`Edit session ${session.number}`} size="wide">
      <div className="cel-editor">
        <nav className="cal-editor-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? "cal-tab active" : "cal-tab"} onClick={() => setTab(t.key)}>
              <t.Icon size={14} aria-hidden /> {t.label}
              {t.count ? <span className="cel-tab-count">{t.count}</span> : null}
            </button>
          ))}
        </nav>
        <div className="cel-body" role="tabpanel">
          {tab === "summary" && (
            <div className="cel-section">
              <div className="ss-summary-grid">
                <label className="cal-field">
                  <span className="field-label">Number</span>
                  <input type="number" min={0} value={number} onChange={(e) => setNumber(e.target.value)} />
                </label>
                <label className="cal-field">
                  <span className="field-label">Title</span>
                  <input type="text" value={title} maxLength={120} placeholder="e.g. The Ambush at Thornford" onChange={(e) => setTitle(e.target.value)} />
                </label>
                <div className="cal-field">
                  <span className="field-label">Played on (real date)</span>
                  <DatePicker label="Played on" value={playedOn || null} onChange={(v) => setPlayedOn(v ?? "")} />
                </div>
              </div>
              {!def ? (
                <p className="cal-help">The campaign&apos;s calendar is missing: pick another one in the campaign&apos;s settings to set in-world dates.</p>
              ) : startDay === null || !start ? (
                <div>
                  <button type="button" className="btn btn-sm" onClick={() => (setStartDay(chronology.currentDay), setEndDay(chronology.currentDay))}>
                    Set in-world dates
                  </button>
                </div>
              ) : (
                <>
                  <div className="ss-dates">
                    <div className="cal-field">
                      <span className="field-label">In-world start</span>
                      <WorldDatePicker
                        def={def}
                        label="In-world start"
                        value={startDay}
                        currentDay={chronology.currentDay}
                        onChange={(s) => {
                          setStartDay(s);
                          if (endDay === null || endDay < s) setEndDay(s);
                        }}
                      />
                    </div>
                    <div className="cal-field">
                      <span className="field-label">In-world end</span>
                      <WorldDatePicker def={def} label="In-world end" value={endDay ?? startDay} min={startDay} currentDay={chronology.currentDay} onChange={setEndDay} />
                    </div>
                  </div>
                  <p className="cal-help">
                    {endDay !== null && endDay >= startDay ? `${endDay - startDay + 1} in-world day${endDay === startDay ? "" : "s"}. ` : "The end is before the start. "}
                    The world&apos;s current date is {dayLabel(def, chronology.currentDay, { weekday: false })}.
                  </p>
                </>
              )}
            </div>
          )}
          {tab === "recap" &&
            (session.recapDocumentId ? (
              <div className="cel-section ss-recap-edit">
                <p className="cal-help">What happened, in your words. It saves as you type.</p>
                <RichEditor documentId={session.recapDocumentId} editable mentionCampaignId={campaign.id} placeholder="The party arrived at…" />
              </div>
            ) : (
              <p className="cal-help">This session has no recap document.</p>
            ))}
          {tab === "notes" && (
            <>
              <LineList label="Key events" hint="The moments worth remembering." placeholder="The bridge collapsed under the ogre" lines={notes.events} onChange={(events) => setNotes({ ...notes, events })} />
              <LineList label="Party decisions" hint="Big choices that shape what comes next." placeholder="Spared the bandit leader" lines={notes.decisions} onChange={(decisions) => setNotes({ ...notes, decisions })} />
              <label className="cel-section">
                <h3>For next session</h3>
                <textarea rows={4} maxLength={4000} value={notes.nextSession} placeholder="Where they left off, what to prepare…" onChange={(e) => setNotes({ ...notes, nextSession: e.target.value })} />
              </label>
            </>
          )}
          {tab === "quests" && <SessionQuestLog campaignId={campaign.id} quests={quests} log={questLog} onChange={setQuestLog} onQuestCreated={onQuestCreated} onAddRewards={addRewards} />}
          {tab === "involved" && <ArticleLinksSection links={links} onChange={setLinks} title="Who and where" hint="NPCs met, places visited, factions and items that mattered. Each article shows this session in its backlinks." />}
          {tab === "party" && <PartyTab roster={campaign.roster} attendance={attendance} xpTotal={xpTotal} overrides={overrides} onAttendance={setAttendance} onXpTotal={setXpTotal} onOverrides={setOverrides} />}
          {tab === "loot" && <LootTab campaign={campaign} loot={loot} coins={coins} onLoot={setLoot} onCoins={setCoins} />}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="cel-footer">
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save session"}
          </button>
        </div>
      </div>
      {advance && def && (
        <ConfirmDialog
          open
          title="Move the world's current date?"
          confirmLabel="Move the date"
          error={advanceError}
          onConfirm={moveDate}
          onCancel={() => {
            const saved = advance.saved;
            setAdvance(null);
            onSaved(saved, false);
          }}
        >
          The session is saved. It ends on {dayLabel(def, advance.to)}, after the world&apos;s current date ({dayLabel(def, chronology.currentDay)}). Move the current date to the end of this session?
        </ConfirmDialog>
      )}
    </Modal>
  );
}
