"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Dices } from "lucide-react";
import Toggle from "@/components/Toggle";
import { generateCharacter, resolveSpecies } from "@/lib/character-on-demand/generate";
import type { HistoryEntry } from "@/lib/character-on-demand/history";
import { loadNames } from "@/lib/character-on-demand/load-names";
import { BACKGROUNDS, DEFAULT_OPTIONS, GENDERS, HAIRLESS_SPECIES, SPECIES, type GenerateOptions } from "@/lib/character-on-demand/options";
import CharacterModal from "./CharacterModal";
import { genderLabel, speciesLabel } from "@/lib/character-on-demand/labels";
import { optionLabel } from "@/server/articles/info-sets";
import { useT } from "@/i18n/useT";
import RecentList from "./RecentList";
import { useCharacterHistory } from "./useCharacterHistory";

function OptionRow({ id, label, hint, children, tooltip }: { id?: string; label: string; hint: string; children: React.ReactNode; tooltip?: string }) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        {id ? <label htmlFor={id}>{label}</label> : <span>{label}</span>}
        <p>{hint}</p>
      </div>
      <div className="settings-row-control" data-tooltip={tooltip}>
        {children}
      </div>
    </div>
  );
}

/** Advanced Tools › Character On Demand: rolls a quick named character and turns it into a Character article. */
export default function CharacterOnDemand({ worldId }: { worldId: string }) {
  const t = useT("character");
  const router = useRouter();
  const { entries, add, markArticle } = useCharacterHistory(worldId);
  const [opts, setOpts] = useState<GenerateOptions>(DEFAULT_OPTIONS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"generate" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof GenerateOptions>(key: K, value: GenerateOptions[K]) => setOpts((o) => ({ ...o, [key]: value }));
  const hairless = opts.species !== "random" && HAIRLESS_SPECIES.has(opts.species);
  const hairlessHint = hairless ? t("hairless") : undefined;
  const open = entries.find((e) => e.id === openId) ?? null;

  async function generate() {
    setBusy("generate");
    setError(null);
    try {
      const species = resolveSpecies(opts.species);
      const character = generateCharacter({ ...opts, species }, await loadNames(species));
      const entry: HistoryEntry = { id: crypto.randomUUID(), createdAt: Date.now(), character };
      add(entry);
      setOpenId(entry.id);
    } catch {
      setError(t("namesFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function createArticle(entry: HistoryEntry) {
    const c = entry.character;
    setBusy("create");
    setError(null);
    try {
      const res = await fetch("/api/tools/character-on-demand/article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: c.name,
          gender: c.gender,
          species: c.species,
          background: c.background,
          hairstyle: c.hairstyle,
          hairColor: c.hairColor,
          beard: c.beard,
          backstory: c.backstory,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.person?.id) throw new Error(data?.error ?? t("createFailed"));
      markArticle(entry.id, data.person.id);
      router.push(`/articles?type=character&id=${encodeURIComponent(data.person.id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("createFailed"));
      setBusy(null);
    }
  }

  return (
    <>
      <header className="settings-header">
        <div>
          <h1 className="tool-title">
            <Dices size={22} strokeWidth={2.25} aria-hidden />
            {t("title")}
          </h1>
          <p>{t("intro")}</p>
        </div>
      </header>

      <section className="settings-card">
        <div className="settings-card-head">
          <h2>{t("options")}</h2>
          <p>{t("optionsHint")}</p>
        </div>
        <div className="settings-card-body">
          <OptionRow id="cod-gender" label={t("opt.gender")} hint={t("opt.genderHint")}>
            <select id="cod-gender" value={opts.gender} onChange={(e) => set("gender", e.target.value as GenerateOptions["gender"])}>
              <option value="random">{t("ui.random")}</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {genderLabel(g, t)}
                </option>
              ))}
            </select>
          </OptionRow>
          <OptionRow id="cod-species" label={t("opt.species")} hint={t("opt.speciesHint")}>
            <select id="cod-species" value={opts.species} onChange={(e) => set("species", e.target.value as GenerateOptions["species"])}>
              <option value="random">{t("ui.random")}</option>
              {SPECIES.map((s) => (
                <option key={s.key} value={s.key}>
                  {speciesLabel(s.key, t)}
                </option>
              ))}
            </select>
          </OptionRow>
          <OptionRow id="cod-background" label={t("opt.background")} hint={t("opt.backgroundHint")}>
            <select id="cod-background" value={opts.background} onChange={(e) => set("background", e.target.value as GenerateOptions["background"])}>
              <option value="random">{t("ui.random")}</option>
              <option value="none">{t("ui.none")}</option>
              {BACKGROUNDS.map((b) => (
                <option key={b} value={b}>
                  {optionLabel(b)}
                </option>
              ))}
            </select>
          </OptionRow>
          <OptionRow id="cod-middle" label={t("opt.middle")} hint={t("opt.middleHint")}>
            <select id="cod-middle" value={opts.middleName} onChange={(e) => set("middleName", e.target.value as GenerateOptions["middleName"])}>
              <option value="random">{t("ui.random")}</option>
              <option value="always">{t("opt.always")}</option>
              <option value="never">{t("opt.never")}</option>
            </select>
          </OptionRow>
          <OptionRow label={t("opt.hair")} hint={t("opt.hairHint")} tooltip={hairlessHint}>
            <Toggle checked={opts.hair && !hairless} disabled={hairless} label={t("ui.generate")} onChange={(on) => set("hair", on)} />
          </OptionRow>
          <OptionRow id="cod-beard" label={t("opt.beard")} hint={t("opt.beardHint")} tooltip={hairlessHint}>
            <select id="cod-beard" value={opts.beard} disabled={hairless} onChange={(e) => set("beard", e.target.value as GenerateOptions["beard"])}>
              <option value="male">{t("opt.beardMale")}</option>
              <option value="female">{t("opt.beardFemale")}</option>
              <option value="both">{t("opt.beardBoth")}</option>
              <option value="none">{t("ui.none")}</option>
            </select>
          </OptionRow>
          <OptionRow label={t("opt.backstory")} hint={t("opt.backstoryHint")}>
            <Toggle checked={opts.backstory} label={t("ui.generate")} onChange={(on) => set("backstory", on)} />
          </OptionRow>
        </div>
      </section>

      <div className="tool-actions">
        <button type="button" className="btn btn-primary" onClick={generate} disabled={busy !== null}>
          <Dices size={16} strokeWidth={2.25} aria-hidden />
          {t("ui.generate")}
        </button>
      </div>

      {error && !open && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <RecentList
        title={t("recent")}
        noun={t("noun")}
        onOpen={setOpenId}
        items={entries.map((e) => ({
          id: e.id,
          createdAt: e.createdAt,
          title: e.character.name,
          meta: [t("meta", { gender: genderLabel(e.character.gender, t), species: speciesLabel(e.character.species, t) }), ...(e.character.background ? [optionLabel(e.character.background)] : [])].join(" · "),
          extra: e.personId && (
            <span className="tool-history-badge" data-tooltip={t("articleBadgeHint")}>
              <Check size={13} strokeWidth={2.5} aria-hidden />
              {t("articleBadge")}
            </span>
          ),
        }))}
      />

      <CharacterModal
        entry={open}
        busy={busy}
        error={error}
        onClose={() => {
          setOpenId(null);
          setError(null);
        }}
        onRegenerate={generate}
        onCreateArticle={createArticle}
      />
    </>
  );
}
