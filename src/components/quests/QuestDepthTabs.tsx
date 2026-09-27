"use client";

import { Plus, Trash2, X } from "lucide-react";
import InfoPicker from "@/components/articles/InfoPicker";
import { candidateOptions, type Candidate } from "@/components/articles/candidates";
import { newId } from "@/components/calendars/api";
import WorldDatePicker from "@/components/calendars/WorldDatePicker";
import { dayLabel } from "@/components/calendars/evaluate";
import type { CalendarDefinition } from "@/server/calendars/engine";
import { clueCoverage } from "@/server/quests/logic";
import { CLOCK_SIZES, type ArticleRef, type Clock, type ClockSize, type Clue, type FrontData, type Rewards } from "@/server/quests/types";
import type { Currency } from "@/server/sessions/types";
import ProgressClock from "./ProgressClock";
import { nameOf } from "./parts";

/** The Three Clue Rule hint: how many clues are still out there, and whether that's enough. */
export function CoverageHint({ clues }: { clues: readonly Clue[] }) {
  const c = clueCoverage(clues);
  if (c.total === 0) return <p className="cal-help">No clues yet. The Three Clue Rule: give every conclusion the party must reach at least three clues, in different places.</p>;
  return (
    <p className={c.underThree ? "qs-coverage warn" : "qs-coverage"}>
      {c.revealed} of {c.total} revealed · {c.placed} hidden clue{c.placed === 1 ? "" : "s"} placed somewhere
      {c.underThree ? " · fewer than three: the party could miss it (Three Clue Rule)." : ""}
    </p>
  );
}

/** Secrets & clues: one-line facts, where they can be found, whether they're out. */
export function CluesTab({ clues, candidates, onChange }: { clues: Clue[]; candidates: Candidate[] | null; onChange: (c: Clue[]) => void }) {
  const set = (id: string, patch: Partial<Clue>) => onChange(clues.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  return (
    <div className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>Secrets &amp; clues</h3>
          <p className="cal-help">Short facts the party can discover, each placed with the people, places or things that could reveal it. Don&apos;t tie a clue to one scene: if they miss it there, it can come out elsewhere.</p>
        </div>
      </header>
      <CoverageHint clues={clues} />
      {clues.map((c, i) => (
        <div key={c.id} className="qs-clue-edit">
          <div className="ss-line">
            <label className="cal-check" data-tooltip="Revealed to the party">
              <input type="checkbox" aria-label={`Clue ${i + 1} revealed`} checked={c.revealed} onChange={(e) => set(c.id, { revealed: e.target.checked, revealedSessionId: e.target.checked ? c.revealedSessionId : null })} />
            </label>
            <input type="text" aria-label={`Clue ${i + 1}`} value={c.text} maxLength={500} placeholder="The baron's seal on the letter is a forgery" className={c.revealed ? "ss-resolved" : undefined} onChange={(e) => set(c.id, { text: e.target.value })} />
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove clue ${i + 1}`} data-tooltip="Remove" onClick={() => onChange(clues.filter((x) => x.id !== c.id))}>
              <Trash2 size={14} />
            </button>
          </div>
          <PlacesEditor places={c.placedIn} candidates={candidates} onChange={(placedIn) => set(c.id, { placedIn })} />
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-sm" disabled={clues.length >= 50} onClick={() => onChange([...clues, { id: newId("cl"), text: "", placedIn: [], revealed: false, revealedSessionId: null }])}>
          <Plus size={14} /> Add clue
        </button>
      </div>
    </div>
  );
}

function PlacesEditor({ places, candidates, onChange }: { places: ArticleRef[]; candidates: Candidate[] | null; onChange: (p: ArticleRef[]) => void }) {
  const picked = new Set(places.map((p) => p.articleId));
  return (
    <div className="qs-clue-places">
      <span className="field-label">Found with</span>
      {places.map((p) => (
        <span key={p.articleId} className="article-tag">
          {nameOf(p, candidates) ?? "(removed)"}
          <button type="button" aria-label={`Remove ${nameOf(p, candidates) ?? "place"}`} data-tooltip="Remove" onClick={() => onChange(places.filter((x) => x.articleId !== p.articleId))}>
            <X size={11} strokeWidth={2.5} />
          </button>
        </span>
      ))}
      {places.length < 10 && (
        <InfoPicker
          options={candidateOptions(candidates ?? [], picked)}
          value={null}
          placeholder={candidates ? "Add where…" : "Loading articles…"}
          ariaLabel="Add where the clue can be found"
          collapsibleGroups
          disabled={!candidates}
          onChange={(id) => {
            const c = id ? candidates?.find((x) => x.id === id) : null;
            if (c) onChange([...places, { template: c.template, articleId: c.id }]);
          }}
        />
      )}
    </div>
  );
}

/** The quest's front and its progress clock. */
export function ClockTab({ fronts, frontId, clock, onFront, onClock }: { fronts: FrontData[]; frontId: string | null; clock: Clock | null; onFront: (id: string | null) => void; onClock: (c: Clock | null) => void }) {
  return (
    <div className="cel-section">
      <div className="cal-field">
        <span className="field-label">Front</span>
        <select value={frontId ?? ""} onChange={(e) => onFront(e.target.value || null)}>
          <option value="">None</option>
          {fronts.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <p className="cal-help">{fronts.length ? "The threat this quest is part of. Fronts are on the Sessions page's Fronts tab." : "No fronts yet. Create one on the Sessions page's Fronts tab to group quests under a threat."}</p>
      </div>
      <header className="cel-section-head">
        <div>
          <h3>Progress clock</h3>
          <p className="cal-help">A danger closing in, a deadline or a long effort. Tick it as things happen, from here, the quest view or a session&apos;s Quests tab.</p>
        </div>
      </header>
      {!clock ? (
        <div>
          <button type="button" className="btn btn-sm" onClick={() => onClock({ segments: 6, filled: 0, label: "" })}>
            <Plus size={14} /> Add a clock
          </button>
        </div>
      ) : (
        <div className="qs-clock-edit">
          <ProgressClock clock={clock} size={96} onSet={(filled) => onClock({ ...clock, filled })} />
          <div className="qs-clock-fields">
            <label className="cal-field">
              <span className="field-label">What fills it</span>
              <input type="text" maxLength={80} value={clock.label} placeholder="The cult completes the ritual" onChange={(e) => onClock({ ...clock, label: e.target.value })} />
            </label>
            <label className="cal-field">
              <span className="field-label">Segments</span>
              <select value={clock.segments} onChange={(e) => onClock({ ...clock, segments: Number(e.target.value) as ClockSize, filled: Math.min(clock.filled, Number(e.target.value)) })}>
                {CLOCK_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onClock(null)}>
              <Trash2 size={14} /> Remove clock
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** What completing the quest is worth: XP, coins, items (offered to the session that completes it). */
export function RewardsTab({ rewards, currencies, candidates, onChange }: { rewards: Rewards; currencies: Currency[]; candidates: Candidate[] | null; onChange: (r: Rewards) => void }) {
  const items = (candidates ?? []).filter((c) => c.template === "item");
  const setCoin = (i: number, patch: Partial<Rewards["coins"][number]>) => onChange({ ...rewards, coins: rewards.coins.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const setItem = (id: string, patch: Partial<Rewards["items"][number]>) => onChange({ ...rewards, items: rewards.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  return (
    <div className="cel-section">
      <p className="cal-help">When a session logs this quest as completed, it offers to add these to that session&apos;s XP, coins and loot (to the party stash).</p>
      <label className="cal-field qs-reward-xp">
        <span className="field-label">XP</span>
        <input type="number" min={0} value={rewards.xp ?? ""} placeholder="None" onChange={(e) => onChange({ ...rewards, xp: e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value)) || 0) })} />
      </label>
      <h3>Coins</h3>
      {rewards.coins.map((c, i) => (
        <div key={i} className="ss-line qs-reward-row">
          <input type="number" min={1} aria-label={`Coin reward ${i + 1} amount`} value={c.amount || ""} onChange={(e) => setCoin(i, { amount: Math.max(0, Math.floor(Number(e.target.value)) || 0) })} />
          <select aria-label={`Coin reward ${i + 1} coin`} value={c.currencyId} onChange={(e) => setCoin(i, { currencyId: e.target.value })}>
            {currencies.map((cur) => (
              <option key={cur.id} value={cur.id}>
                {cur.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove coin reward ${i + 1}`} data-tooltip="Remove" onClick={() => onChange({ ...rewards, coins: rewards.coins.filter((_, j) => j !== i) })}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-sm" disabled={currencies.length === 0 || rewards.coins.length >= 20} onClick={() => onChange({ ...rewards, coins: [...rewards.coins, { currencyId: [...currencies].sort((a, b) => b.value - a.value)[0].id, amount: 0 }] })}>
          <Plus size={14} /> Add coins
        </button>
      </div>
      <h3>Items</h3>
      {rewards.items.map((it, i) => (
        <div key={it.id} className="ss-line qs-reward-row qs-reward-item">
          <input type="number" min={1} aria-label={`Item ${i + 1} quantity`} value={it.quantity} onChange={(e) => setItem(it.id, { quantity: Math.max(1, Math.floor(Number(e.target.value)) || 1) })} />
          <input type="text" aria-label={`Item ${i + 1} name`} maxLength={120} value={it.name} placeholder="A silver key" onChange={(e) => setItem(it.id, { name: e.target.value })} />
          <InfoPicker
            options={candidateOptions(items)}
            value={it.articleId}
            placeholder={candidates ? "Link an Item article" : "Loading…"}
            clearLabel="Not linked"
            ariaLabel={`Item ${i + 1} article`}
            disabled={!candidates}
            onChange={(id) => {
              const c = id ? items.find((x) => x.id === id) : null;
              setItem(it.id, c ? { template: c.template, articleId: c.id, name: c.name } : { template: null, articleId: null });
            }}
          />
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove item ${i + 1}`} data-tooltip="Remove" onClick={() => onChange({ ...rewards, items: rewards.items.filter((x) => x.id !== it.id) })}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-sm" disabled={rewards.items.length >= 20} onClick={() => onChange({ ...rewards, items: [...rewards.items, { id: newId("ri"), name: "", template: null, articleId: null, quantity: 1 }] })}>
          <Plus size={14} /> Add item
        </button>
      </div>
    </div>
  );
}

export interface QuestDays {
  startDay: number | null;
  deadlineDay: number | null;
  endDay: number | null;
}

/** In-world dates: when it started, its deadline, when it ended. Each shows on the campaign's calendar. */
export function DatesTab({ def, currentDay, days, onChange }: { def: CalendarDefinition | null; currentDay: number; days: QuestDays; onChange: (d: QuestDays) => void }) {
  if (!def) return <p className="cal-help">The campaign&apos;s calendar is missing: pick another one in the campaign&apos;s settings to give quests in-world dates.</p>;
  const rows: { key: keyof QuestDays; label: string; hint: string; min: number | null }[] = [
    { key: "startDay", label: "Started", hint: "When the party picked it up.", min: null },
    { key: "deadlineDay", label: "Deadline", hint: "When it's too late: the ritual completes, the caravan leaves. Shown on the calendar and the board.", min: days.startDay },
    { key: "endDay", label: "Ended", hint: "When it was completed, failed or given up.", min: days.startDay },
  ];
  return (
    <div className="cel-section">
      <p className="cal-help">In-world dates, in the campaign&apos;s calendar. They show on the Calendars page, on the day they fall. Today is {dayLabel(def, currentDay, { weekday: false })}.</p>
      {rows.map((r) => {
        const value = days[r.key];
        return (
          <div key={r.key} className="cal-field qs-date-row">
            <span className="field-label">{r.label}</span>
            {value === null ? (
              <div>
                <button type="button" className="btn btn-sm" onClick={() => onChange({ ...days, [r.key]: Math.max(currentDay, r.min ?? currentDay) })}>
                  <Plus size={14} /> Set {r.label.toLowerCase()}
                </button>
              </div>
            ) : (
              <span className="qs-date-pick">
                <WorldDatePicker def={def} label={r.label} value={value} min={r.min} currentDay={currentDay} onChange={(d) => onChange({ ...days, [r.key]: d })} />
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Clear ${r.label.toLowerCase()}`} data-tooltip="Clear" onClick={() => onChange({ ...days, [r.key]: null })}>
                  <X size={14} />
                </button>
              </span>
            )}
            <span className="cal-help">{r.hint}</span>
          </div>
        );
      })}
    </div>
  );
}
