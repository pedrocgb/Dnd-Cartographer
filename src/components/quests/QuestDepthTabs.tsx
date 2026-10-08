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
import { useT } from "@/i18n/useT";

/** The Three Clue Rule hint: how many clues are still out there, and whether that's enough. */
export function CoverageHint({ clues }: { clues: readonly Clue[] }) {
  const t = useT("campaign");
  const c = clueCoverage(clues);
  if (c.total === 0) return <p className="cal-help">{t("clues.none")}</p>;
  return (
    <p className={c.underThree ? "qs-coverage warn" : "qs-coverage"}>
      {t("clues.coverage", { count: c.placed, n: c.placed, revealed: c.revealed, total: c.total })}
      {c.underThree ? ` · ${t("clues.underThree")}` : ""}
    </p>
  );
}

/** Secrets & clues: one-line facts, where they can be found, whether they're out. */
export function CluesTab({ clues, candidates, onChange }: { clues: Clue[]; candidates: Candidate[] | null; onChange: (c: Clue[]) => void }) {
  const t = useT("campaign");
  const set = (id: string, patch: Partial<Clue>) => onChange(clues.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  return (
    <div className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>{t("clues.title")}</h3>
          <p className="cal-help">{t("clues.help")}</p>
        </div>
      </header>
      <CoverageHint clues={clues} />
      {clues.map((c, i) => (
        <div key={c.id} className="qs-clue-edit">
          <div className="ss-line">
            <label className="cal-check" data-tooltip={t("clues.revealedHint")}>
              <input type="checkbox" aria-label={t("clues.revealedN", { n: i + 1 })} checked={c.revealed} onChange={(e) => set(c.id, { revealed: e.target.checked, revealedSessionId: e.target.checked ? c.revealedSessionId : null })} />
            </label>
            <input type="text" aria-label={t("clues.clueN", { n: i + 1 })} value={c.text} maxLength={500} placeholder={t("clues.placeholder")} className={c.revealed ? "ss-resolved" : undefined} onChange={(e) => set(c.id, { text: e.target.value })} />
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("clues.removeN", { n: i + 1 })} data-tooltip={t("quest.remove")} onClick={() => onChange(clues.filter((x) => x.id !== c.id))}>
              <Trash2 size={14} />
            </button>
          </div>
          <PlacesEditor places={c.placedIn} candidates={candidates} onChange={(placedIn) => set(c.id, { placedIn })} />
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-sm" disabled={clues.length >= 50} onClick={() => onChange([...clues, { id: newId("cl"), text: "", placedIn: [], revealed: false, revealedSessionId: null }])}>
          <Plus size={14} /> {t("clues.add")}
        </button>
      </div>
    </div>
  );
}

function PlacesEditor({ places, candidates, onChange }: { places: ArticleRef[]; candidates: Candidate[] | null; onChange: (p: ArticleRef[]) => void }) {
  const t = useT("campaign");
  const picked = new Set(places.map((p) => p.articleId));
  return (
    <div className="qs-clue-places">
      <span className="field-label">{t("clues.foundWith")}</span>
      {places.map((p) => (
        <span key={p.articleId} className="article-tag">
          {nameOf(p, candidates) ?? t("quest.removed")}
          <button type="button" aria-label={t("clues.removeNamed", { name: nameOf(p, candidates) ?? t("clues.place") })} data-tooltip={t("quest.remove")} onClick={() => onChange(places.filter((x) => x.articleId !== p.articleId))}>
            <X size={11} strokeWidth={2.5} />
          </button>
        </span>
      ))}
      {places.length < 10 && (
        <InfoPicker
          options={candidateOptions(candidates ?? [], picked)}
          value={null}
          placeholder={candidates ? t("clues.addWhere") : t("quest.loadingArticles")}
          ariaLabel={t("clues.addWhereLabel")}
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
  const t = useT("campaign");
  return (
    <div className="cel-section">
      <div className="cal-field">
        <span className="field-label">{t("quest.front")}</span>
        <select value={frontId ?? ""} onChange={(e) => onFront(e.target.value || null)}>
          <option value="">{t("quest.none")}</option>
          {fronts.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <p className="cal-help">{fronts.length ? t("clockTab.frontHelp") : t("clockTab.noFronts")}</p>
      </div>
      <header className="cel-section-head">
        <div>
          <h3>{t("clockTab.title")}</h3>
          <p className="cal-help">{t("clockTab.help")}</p>
        </div>
      </header>
      {!clock ? (
        <div>
          <button type="button" className="btn btn-sm" onClick={() => onClock({ segments: 6, filled: 0, label: "" })}>
            <Plus size={14} /> {t("quest.addAClock")}
          </button>
        </div>
      ) : (
        <div className="qs-clock-edit">
          <ProgressClock clock={clock} size={96} onSet={(filled) => onClock({ ...clock, filled })} />
          <div className="qs-clock-fields">
            <label className="cal-field">
              <span className="field-label">{t("clockTab.whatFills")}</span>
              <input type="text" maxLength={80} value={clock.label} placeholder={t("clockTab.placeholder")} onChange={(e) => onClock({ ...clock, label: e.target.value })} />
            </label>
            <label className="cal-field">
              <span className="field-label">{t("quest.segments")}</span>
              <select value={clock.segments} onChange={(e) => onClock({ ...clock, segments: Number(e.target.value) as ClockSize, filled: Math.min(clock.filled, Number(e.target.value)) })}>
                {CLOCK_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onClock(null)}>
              <Trash2 size={14} /> {t("quest.removeClock")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** What completing the quest is worth: XP, coins, items (offered to the session that completes it). */
export function RewardsTab({ rewards, currencies, candidates, onChange }: { rewards: Rewards; currencies: Currency[]; candidates: Candidate[] | null; onChange: (r: Rewards) => void }) {
  const t = useT("campaign");
  const tc = useT("common");
  const items = (candidates ?? []).filter((c) => c.template === "item");
  const setCoin = (i: number, patch: Partial<Rewards["coins"][number]>) => onChange({ ...rewards, coins: rewards.coins.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const setItem = (id: string, patch: Partial<Rewards["items"][number]>) => onChange({ ...rewards, items: rewards.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  return (
    <div className="cel-section">
      <p className="cal-help">{t("rewards.help")}</p>
      <label className="cal-field qs-reward-xp">
        <span className="field-label">{t("rewards.xp")}</span>
        <input type="number" min={0} value={rewards.xp ?? ""} placeholder={t("rewards.none")} onChange={(e) => onChange({ ...rewards, xp: e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value)) || 0) })} />
      </label>
      <h3>{t("rewards.coins")}</h3>
      {rewards.coins.map((c, i) => (
        <div key={i} className="ss-line qs-reward-row">
          <input type="number" min={1} aria-label={t("rewards.coinAmountN", { n: i + 1 })} value={c.amount || ""} onChange={(e) => setCoin(i, { amount: Math.max(0, Math.floor(Number(e.target.value)) || 0) })} />
          <select aria-label={t("rewards.coinCoinN", { n: i + 1 })} value={c.currencyId} onChange={(e) => setCoin(i, { currencyId: e.target.value })}>
            {currencies.map((cur) => (
              <option key={cur.id} value={cur.id}>
                {cur.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("rewards.removeCoinN", { n: i + 1 })} data-tooltip={t("quest.remove")} onClick={() => onChange({ ...rewards, coins: rewards.coins.filter((_, j) => j !== i) })}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-sm" disabled={currencies.length === 0 || rewards.coins.length >= 20} onClick={() => onChange({ ...rewards, coins: [...rewards.coins, { currencyId: [...currencies].sort((a, b) => b.value - a.value)[0].id, amount: 0 }] })}>
          <Plus size={14} /> {t("rewards.addCoins")}
        </button>
      </div>
      <h3>{t("rewards.items")}</h3>
      {rewards.items.map((it, i) => (
        <div key={it.id} className="ss-line qs-reward-row qs-reward-item">
          <input type="number" min={1} aria-label={t("rewards.itemQuantityN", { n: i + 1 })} value={it.quantity} onChange={(e) => setItem(it.id, { quantity: Math.max(1, Math.floor(Number(e.target.value)) || 1) })} />
          <input type="text" aria-label={t("rewards.itemNameN", { n: i + 1 })} maxLength={120} value={it.name} placeholder={t("rewards.itemPlaceholder")} onChange={(e) => setItem(it.id, { name: e.target.value })} />
          <InfoPicker
            options={candidateOptions(items)}
            value={it.articleId}
            placeholder={candidates ? t("rewards.linkItem") : tc("loading")}
            clearLabel={t("rewards.notLinked")}
            ariaLabel={t("rewards.itemArticleN", { n: i + 1 })}
            disabled={!candidates}
            onChange={(id) => {
              const c = id ? items.find((x) => x.id === id) : null;
              setItem(it.id, c ? { template: c.template, articleId: c.id, name: c.name } : { template: null, articleId: null });
            }}
          />
          <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t("rewards.removeItemN", { n: i + 1 })} data-tooltip={t("quest.remove")} onClick={() => onChange({ ...rewards, items: rewards.items.filter((x) => x.id !== it.id) })}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-sm" disabled={rewards.items.length >= 20} onClick={() => onChange({ ...rewards, items: [...rewards.items, { id: newId("ri"), name: "", template: null, articleId: null, quantity: 1 }] })}>
          <Plus size={14} /> {t("rewards.addItem")}
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
  const t = useT("campaign");
  if (!def) return <p className="cal-help">{t("dates.noCalendar")}</p>;
  const rows: { key: keyof QuestDays; label: string; hint: string; min: number | null }[] = [
    { key: "startDay", label: t("dates.started"), hint: t("dates.startedHint"), min: null },
    { key: "deadlineDay", label: t("dates.deadline"), hint: t("dates.deadlineHint"), min: days.startDay },
    { key: "endDay", label: t("dates.ended"), hint: t("dates.endedHint"), min: days.startDay },
  ];
  return (
    <div className="cel-section">
      <p className="cal-help">{t("dates.help", { date: dayLabel(def, currentDay, { weekday: false }) })}</p>
      {rows.map((r) => {
        const value = days[r.key];
        return (
          <div key={r.key} className="cal-field qs-date-row">
            <span className="field-label">{r.label}</span>
            {value === null ? (
              <div>
                <button type="button" className="btn btn-sm" onClick={() => onChange({ ...days, [r.key]: Math.max(currentDay, r.min ?? currentDay) })}>
                  <Plus size={14} /> {t(`dates.set.${r.key}`)}
                </button>
              </div>
            ) : (
              <span className="qs-date-pick">
                <WorldDatePicker def={def} label={r.label} value={value} min={r.min} currentDay={currentDay} onChange={(d) => onChange({ ...days, [r.key]: d })} />
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={t(`dates.clear.${r.key}`)} data-tooltip={t("dates.clear")} onClick={() => onChange({ ...days, [r.key]: null })}>
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
