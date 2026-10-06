"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Dices } from "lucide-react";
import Toggle from "@/components/Toggle";
import { generateCharacter, resolveSpecies } from "@/lib/character-on-demand/generate";
import type { HistoryEntry } from "@/lib/character-on-demand/history";
import { loadNames } from "@/lib/character-on-demand/load-names";
import { BACKGROUNDS, DEFAULT_OPTIONS, GENDERS, HAIRLESS_SPECIES, SPECIES, type GenerateOptions } from "@/lib/character-on-demand/options";
import CharacterModal, { speciesLabel } from "./CharacterModal";
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
  const router = useRouter();
  const { entries, add, markArticle } = useCharacterHistory(worldId);
  const [opts, setOpts] = useState<GenerateOptions>(DEFAULT_OPTIONS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"generate" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof GenerateOptions>(key: K, value: GenerateOptions[K]) => setOpts((o) => ({ ...o, [key]: value }));
  const hairless = opts.species !== "random" && HAIRLESS_SPECIES.has(opts.species);
  const hairlessHint = hairless ? "Dragonborn have no hair or beard" : undefined;
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
      setError("Couldn't load the names for that species. Try again.");
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
      if (!res.ok || !data?.person?.id) throw new Error(data?.error ?? "Couldn't create the article.");
      markArticle(entry.id, data.person.id);
      router.push(`/articles?type=character&id=${encodeURIComponent(data.person.id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the article.");
      setBusy(null);
    }
  }

  return (
    <>
      <header className="settings-header">
        <div>
          <h1 className="tool-title">
            <Dices size={22} strokeWidth={2.25} aria-hidden />
            Character On Demand
          </h1>
          <p>Roll a quick character with a name, look and background in one click. Pick what matters, leave the rest to chance, and turn the result into a Character article when you like it.</p>
        </div>
      </header>

      <section className="settings-card">
        <div className="settings-card-head">
          <h2>Generation options</h2>
          <p>Species decides which name list is used; gender picks male or female first names.</p>
        </div>
        <div className="settings-card-body">
          <OptionRow id="cod-gender" label="Gender" hint="Chooses between male and female names.">
            <select id="cod-gender" value={opts.gender} onChange={(e) => set("gender", e.target.value as GenerateOptions["gender"])}>
              <option value="random">Random</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </OptionRow>
          <OptionRow id="cod-species" label="Species" hint="The name list to draw from.">
            <select id="cod-species" value={opts.species} onChange={(e) => set("species", e.target.value as GenerateOptions["species"])}>
              <option value="random">Random</option>
              {SPECIES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </OptionRow>
          <OptionRow id="cod-background" label="Background" hint="Optional. Fills the Social Background of the article.">
            <select id="cod-background" value={opts.background} onChange={(e) => set("background", e.target.value as GenerateOptions["background"])}>
              <option value="random">Random</option>
              <option value="none">None</option>
              {BACKGROUNDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </OptionRow>
          <OptionRow id="cod-middle" label="Middle name" hint="Random gives about one character in three a middle name.">
            <select id="cod-middle" value={opts.middleName} onChange={(e) => set("middleName", e.target.value as GenerateOptions["middleName"])}>
              <option value="random">Random</option>
              <option value="always">Always</option>
              <option value="never">Never</option>
            </select>
          </OptionRow>
          <OptionRow label="Hairstyle" hint="A hairstyle that fits the gender, and a hair color." tooltip={hairlessHint}>
            <Toggle checked={opts.hair && !hairless} disabled={hairless} label="Generate" onChange={(on) => set("hair", on)} />
          </OptionRow>
          <OptionRow id="cod-beard" label="Beard" hint="Who gets a beard (clean-shaven can come up too)." tooltip={hairlessHint}>
            <select id="cod-beard" value={opts.beard} disabled={hairless} onChange={(e) => set("beard", e.target.value as GenerateOptions["beard"])}>
              <option value="male">Male only</option>
              <option value="female">Female only</option>
              <option value="both">Both</option>
              <option value="none">None</option>
            </select>
          </OptionRow>
          <OptionRow label="Backstory" hint="Clothes that fit the background, what they want right now, a quirk, a fear and a secret.">
            <Toggle checked={opts.backstory} label="Generate" onChange={(on) => set("backstory", on)} />
          </OptionRow>
        </div>
      </section>

      <div className="tool-actions">
        <button type="button" className="btn btn-primary" onClick={generate} disabled={busy !== null}>
          <Dices size={16} strokeWidth={2.25} aria-hidden />
          Generate
        </button>
      </div>

      {error && !open && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <RecentList
        title="Recent characters"
        noun="characters"
        onOpen={setOpenId}
        items={entries.map((e) => ({
          id: e.id,
          createdAt: e.createdAt,
          title: e.character.name,
          meta: `${e.character.gender} ${speciesLabel(e.character.species)}${e.character.background ? ` · ${e.character.background}` : ""}`,
          extra: e.personId && (
            <span className="tool-history-badge" data-tooltip="An article was created from this character">
              <Check size={13} strokeWidth={2.5} aria-hidden />
              Article
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
