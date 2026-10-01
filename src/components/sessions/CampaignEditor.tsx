"use client";

import { formatDecimal } from "@/server/settings/number-format";
import { useEffect, useMemo, useState } from "react";
import { Coins, Plus, ScrollText, Trash2, Users } from "lucide-react";
import Modal from "@/components/Modal";
import ConfirmDialog from "@/components/ConfirmDialog";
import InfoPicker from "@/components/articles/InfoPicker";
import { candidateOptions, loadCandidates, type Candidate } from "@/components/articles/candidates";
import { api, newId } from "@/components/calendars/api";
import type { ClientCalendar } from "@/components/calendars/types";
import { D_AND_D_COINS, type Currency } from "@/server/sessions/types";
import { Avatar, STATUS_LABELS } from "./parts";
import type { ClientCampaign, RosterMember } from "./types";

type Tab = "general" | "coins" | "party";

/** "1 gp = 100 cp" for each coin against the smallest one. */
function exchangeLine(coin: Currency, coins: readonly Currency[]): string | null {
  const smallest = [...coins].sort((a, b) => a.value - b.value)[0];
  if (!smallest || smallest.id === coin.id || !coin.value) return null;
  return `1 ${coin.short || coin.name} = ${formatDecimal(coin.value)} ${smallest.short || smallest.name}`;
}

function CoinsTab({ coins, onChange }: { coins: Currency[]; onChange: (c: Currency[]) => void }) {
  const set = (id: string, patch: Partial<Currency>) => onChange(coins.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  return (
    <div className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>Coins</h3>
          <p className="cal-help">Each coin&apos;s value is counted in the smallest coin (value 1).</p>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => onChange(D_AND_D_COINS.map((c) => ({ ...c })))}>
          Use D&amp;D coins
        </button>
      </header>
      <div className="ss-coin-table" role="table" aria-label="Coins">
        <div className="ss-coin-row ss-coin-head" role="row">
          <span role="columnheader">Name</span>
          <span role="columnheader">Short</span>
          <span role="columnheader">Value</span>
          <span />
        </div>
        {coins.map((c) => (
          <div key={c.id} className="ss-coin-row" role="row">
            <input type="text" aria-label="Coin name" value={c.name} maxLength={40} placeholder="Gold piece" onChange={(e) => set(c.id, { name: e.target.value })} />
            <input type="text" aria-label="Short name" value={c.short} maxLength={8} placeholder="gp" onChange={(e) => set(c.id, { short: e.target.value })} />
            <span className="ss-coin-value">
              <input type="number" aria-label="Value" min={1} value={c.value} onChange={(e) => set(c.id, { value: Math.max(1, Math.floor(Number(e.target.value)) || 1) })} />
              <span className="cal-help">{exchangeLine(c, coins)}</span>
            </span>
            <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${c.name || "coin"}`} disabled={coins.length === 1} onClick={() => onChange(coins.filter((x) => x.id !== c.id))}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <div>
        <button type="button" className="btn btn-sm" disabled={coins.length >= 10} onClick={() => onChange([...coins, { id: newId("coin"), name: "", short: "", value: 1 }])}>
          <Plus size={14} /> Add a coin
        </button>
      </div>
    </div>
  );
}

function PartyTab({ campaign, onChanged }: { campaign: ClientCampaign; onChanged: () => void }) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<RosterMember | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadCandidates()
      .then((c) => !cancelled && setCandidates(c.filter((x) => x.template === "playerCharacter")))
      .catch(() => !cancelled && setError("Could not load the player characters."));
    return () => {
      cancelled = true;
    };
  }, []);
  const inParty = useMemo(() => new Set(campaign.roster.map((m) => m.personId)), [campaign.roster]);

  async function call(method: string, url: string, body?: unknown) {
    setError(null);
    const res = await api(method, url, body);
    if (res.ok) onChanged();
    else setError(res.data.error ?? "Could not update the party.");
    return res;
  }
  async function remove() {
    if (!removing) return;
    const res = await api("DELETE", `/api/campaigns/${campaign.id}/characters/${removing.id}`);
    if (res.ok) {
      setRemoving(null);
      onChanged();
    } else setRemoveError(res.data.error ?? "Could not remove them.");
  }

  return (
    <div className="cel-section">
      <header className="cel-section-head">
        <div>
          <h3>Party</h3>
          <p className="cal-help">Party members are Player Character articles; each one&apos;s player comes from its Controlling Player field. Changes here are saved right away.</p>
        </div>
      </header>
      {campaign.roster.length === 0 ? (
        <p className="cel-empty">No characters in the party yet.</p>
      ) : (
        <ul className="ss-roster-edit">
          {campaign.roster.map((m) => (
            <li key={m.id}>
              <Avatar member={m} size={34} />
              <strong className="ss-roster-name">{m.name ?? "(deleted character)"}</strong>
              <span className={m.playerName ? "ss-roster-player" : "ss-roster-player empty"}>{m.playerName || "No Controlling Player set"}</span>
              <select aria-label="Status" value={m.status} onChange={(e) => call("PATCH", `/api/campaigns/${campaign.id}/characters/${m.id}`, { status: e.target.value })}>
                {(Object.keys(STATUS_LABELS) as RosterMember["status"][]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${m.name ?? "character"} from the party`} onClick={() => setRemoving(m)}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="cel-link-add">
        <InfoPicker
          options={candidateOptions(candidates ?? [], inParty)}
          value={null}
          placeholder={candidates ? "Add a player character to the party…" : "Loading player characters…"}
          ariaLabel="Add a player character to the party"
          disabled={!candidates}
          onChange={(personId) => personId && call("POST", `/api/campaigns/${campaign.id}/characters`, { personId })}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {removing && (
        <ConfirmDialog
          open
          danger
          title={`Remove ${removing.name ?? "this character"}?`}
          confirmLabel="Remove"
          error={removeError}
          onConfirm={remove}
          onCancel={() => {
            setRemoving(null);
            setRemoveError(null);
          }}
        >
          They leave the party. Someone who already played or received loot can&apos;t be removed: mark them retired instead.
        </ConfirmDialog>
      )}
    </div>
  );
}

/**
 * Create or edit a campaign: name, description and calendar (General), its
 * coins, and its party. A new campaign is created first; the Party tab
 * opens once it exists.
 */
export default function CampaignEditor({ campaign, calendars, defaultCalendarId, onSaved, onChanged, onDeleted, onClose }: { campaign: ClientCampaign | null; calendars: ClientCalendar[]; defaultCalendarId: string | null; onSaved: (c: ClientCampaign) => void; onChanged: () => void; onDeleted: () => void; onClose: () => void }) {
  const live = calendars.filter((c) => !c.trashed || c.id === campaign?.calendarId);
  const [tab, setTab] = useState<Tab>("general");
  const [name, setName] = useState(campaign?.name ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");
  const [calendarId, setCalendarId] = useState(campaign?.calendarId ?? live.find((c) => c.id === defaultCalendarId)?.id ?? live[0]?.id ?? "");
  const [coins, setCoins] = useState<Currency[]>(campaign?.currencies ?? D_AND_D_COINS.map((c) => ({ ...c })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setTab("general");
      setError("Give the campaign a name.");
      return;
    }
    setSaving(true);
    setError(null);
    const body = { name, description, calendarId, currencies: coins };
    const res = campaign ? await api<{ campaign: ClientCampaign }>("PATCH", `/api/campaigns/${campaign.id}`, body) : await api<{ campaign: ClientCampaign }>("POST", "/api/campaigns", body);
    setSaving(false);
    if (res.ok) onSaved(res.data.campaign);
    else setError(res.data.error ?? "Could not save the campaign.");
  }
  async function patch(body: Record<string, unknown>) {
    if (!campaign) return;
    const res = await api<{ campaign: ClientCampaign }>("PATCH", `/api/campaigns/${campaign.id}`, body);
    if (res.ok) onChanged();
    else setError(res.data.error ?? "Could not save the campaign.");
  }
  async function remove() {
    if (!campaign) return;
    const res = await api("DELETE", `/api/campaigns/${campaign.id}`);
    if (res.ok) onDeleted();
    else setDeleteError(res.data.error ?? "Could not delete it.");
  }

  const tabs: { key: Tab; label: string; Icon: typeof Users; count?: number }[] = [
    { key: "general", label: "General", Icon: ScrollText },
    { key: "coins", label: "Coins", Icon: Coins, count: coins.length },
    ...(campaign ? [{ key: "party" as const, label: "Party", Icon: Users, count: campaign.roster.length }] : []),
  ];

  return (
    <Modal open onClose={onClose} title={campaign ? `Edit ${campaign.name}` : "New campaign"} size="wide">
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
          {tab === "general" && (
            <div className="cel-section">
              <label className="cal-field">
                <span className="field-label">Name</span>
                <input type="text" value={name} maxLength={80} autoFocus placeholder="e.g. The Sunroot Succession" onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="cal-field">
                <span className="field-label">Description</span>
                <textarea rows={4} value={description} maxLength={4000} placeholder="The premise, the table, the tone…" onChange={(e) => setDescription(e.target.value)} />
              </label>
              <label className="cal-field">
                <span className="field-label">In-world dates read in</span>
                <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
                  {live.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {campaign && (
                <div className="ss-inline">
                  <button type="button" className="btn btn-sm" onClick={() => patch({ status: campaign.status === "active" ? "finished" : "active" })}>
                    {campaign.status === "active" ? "Mark as finished" : "Mark as active"}
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => patch({ archived: !campaign.archived })}>
                    {campaign.archived ? "Unarchive" : "Archive"}
                  </button>
                </div>
              )}
            </div>
          )}
          {tab === "coins" && <CoinsTab coins={coins} onChange={setCoins} />}
          {tab === "party" && campaign && <PartyTab campaign={campaign} onChanged={onChanged} />}
        </div>
        {!campaign && <p className="cal-help">Once it&apos;s created you can add the party&apos;s characters.</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="cel-footer">
          {campaign && (
            <button type="button" className="btn btn-sm btn-danger cel-footer-delete" onClick={() => setConfirmDelete(true)} disabled={saving}>
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={saving}>
            {campaign ? "Close" : "Cancel"}
          </button>
          <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : campaign ? "Save" : "Create campaign"}
          </button>
        </div>
      </div>
      {campaign && (
        <ConfirmDialog
          open={confirmDelete}
          danger
          title={`Delete ${campaign.name}?`}
          confirmLabel="Delete"
          error={deleteError}
          onConfirm={remove}
          onCancel={() => {
            setConfirmDelete(false);
            setDeleteError(null);
          }}
        >
          The campaign and its party list are removed for good. A campaign that still has sessions can&apos;t be deleted: archive it instead.
        </ConfirmDialog>
      )}
    </Modal>
  );
}
