import { describe, expect, it } from "vitest";
import { LOCALES } from "../src/i18n/config";
import { MESSAGES, type Namespace } from "../src/i18n/messages";
import { allTranslations, createTranslator, translate } from "../src/i18n/translate";
import { formatRealDate } from "../src/server/settings/date-format";
import { InvalidReparentError } from "../src/server/maps/hierarchy";
import { CalendarError, problemText, validateDefinition } from "../src/server/calendars/engine";
import { celestialIssues, EIGHT_PHASES } from "../src/server/calendars/celestial";

const NAMESPACES = Object.keys(MESSAGES["en-US"]) as Namespace[];
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("message catalogs", () => {
  for (const locale of LOCALES) {
    for (const ns of NAMESPACES) {
      it(`${locale}/${ns} has exactly the en-US keys, with the same placeholders`, () => {
        const source = MESSAGES["en-US"][ns];
        const target = MESSAGES[locale][ns];
        expect(Object.keys(target).sort()).toEqual(Object.keys(source).sort());
        for (const key of Object.keys(source)) {
          expect(target[key].trim(), `${locale}/${ns}:${key} is empty`).not.toBe("");
          expect(placeholders(target[key]), `${locale}/${ns}:${key}`).toEqual(placeholders(source[key]));
        }
      });
    }
  }

  it("every plural entry has an _other form", () => {
    for (const ns of NAMESPACES) {
      for (const key of Object.keys(MESSAGES["en-US"][ns])) {
        const base = /^(.*)_(zero|one)$/.exec(key)?.[1];
        if (base) expect(MESSAGES["en-US"][ns], `${ns}:${key}`).toHaveProperty(`${base}_other`);
      }
    }
  });
});

describe("translate", () => {
  it("reads the locale's message", () => {
    expect(translate("en-US", "settings", "general.title")).toBe("General");
    expect(translate("pt-BR", "settings", "general.title")).toBe("Geral");
    expect(createTranslator("pt-BR", "common")("saveSettingFailed")).toBe("Não foi possível salvar a configuração.");
  });

  it("fills {params}, leaving unknown ones as written", () => {
    expect(translate("en-US", "worlds", "opening", { name: "Eldoria" })).toBe("Opening Eldoria…");
    expect(translate("pt-BR", "worlds", "opening", { name: "Eldoria" })).toBe("Abrindo Eldoria…");
    expect(translate("en-US", "worlds", "opening")).toBe("Opening {name}…");
  });

  it("picks the plural form by count and the locale's rules", () => {
    const maps = (locale: "en-US" | "pt-BR", count: number) => translate(locale, "worlds", "stats.maps", { count, n: String(count) });
    expect(maps("en-US", 1)).toBe("1 map");
    expect(maps("en-US", 0)).toBe("0 maps");
    expect(maps("en-US", 2)).toBe("2 maps");
    expect(maps("pt-BR", 1)).toBe("1 mapa");
    expect(maps("pt-BR", 2)).toBe("2 mapas");
  });

  it("falls back to the key when it is missing everywhere", () => {
    // @ts-expect-error: unknown keys are a type error; at runtime they show as-is.
    expect(translate("pt-BR", "common", "nope.missing")).toBe("nope.missing");
  });
});

describe("formatRealDate month names", () => {
  it("follows the language", () => {
    const date = new Date(2026, 2, 12);
    expect(formatRealDate(date, "D MMMM YYYY", { language: "en-US" })).toBe("12 March 2026");
    expect(formatRealDate(date, "D MMMM YYYY", { language: "pt-BR" })).toBe("12 março 2026");
  });
});

describe("allTranslations", () => {
  it("lists a default name in every locale", () => {
    expect(allTranslations("maps", "defaults.newMarker")).toEqual(["New marker", "Novo marcador"]);
    expect(allTranslations("maps", "defaults.zone", { n: 2 })).toEqual(["Zone 2", "Zona 2"]);
  });
});

describe("keyed server errors", () => {
  it("keep an errors key and an en-US message", () => {
    const err = new InvalidReparentError("mapCycle");
    expect(err.key).toBe("mapCycle");
    expect(err.message).toBe("This move would create a cycle.");
    expect(translate("pt-BR", "errors", err.key)).toBe("Esta mudança criaria um ciclo.");
  });
});

describe("info field labels", () => {
  it("are worded in the active language, while stored values stay English", async () => {
    const { setActiveSettings } = await import("../src/server/settings/active");
    const { DEFAULT_SETTINGS } = await import("../src/server/settings/settings");
    const { TERRITORY_INFO, optionLabel } = await import("../src/server/articles/info-sets");
    const field = TERRITORY_INFO.fields.find((f) => f.key === "governmentForm")!;
    try {
      setActiveSettings({ ...DEFAULT_SETTINGS, language: "pt-BR" });
      expect(field.label).toBe(translate("pt-BR", "info", "field.governmentForm"));
      expect(TERRITORY_INFO.groups.find((g) => g.key === "government")!.label).toBe(translate("pt-BR", "info", "group.government"));
      expect(optionLabel("Monarchy")).toBe(translate("pt-BR", "info", "option.Monarchy"));
      expect(optionLabel("Some older value")).toBe("Some older value");
      expect(field.options).toContain("Monarchy");
    } finally {
      setActiveSettings(DEFAULT_SETTINGS);
    }
    expect(field.label).toBe("Government Form");
  });
});

describe("calendar problems", () => {
  it("word nested problems and plurals in the given language, with English messages on errors", () => {
    const def = {
      weekdays: [{ id: "w1", name: "Um", short: "" }],
      weekReset: "continuous" as const,
      weekAnchor: { date: { year: 1, periodId: "m1", day: 1 }, weekdayId: "w1" },
      periods: [{ id: "m1", name: "Alder", short: "", kind: "month" as const, days: 20, inWeek: true, condition: null }],
      leapRules: [],
      year: { hasYearZero: false, suffix: "" },
      sync: { date: { year: 1, periodId: "m1", day: 21 }, worldDay: 0 },
    };
    const [issue] = validateDefinition(def);
    expect(problemText(issue.problem, "pt-BR")).toBe("Data de sincronização: Alder tem 20 dias no ano 1.");
    expect(issue.message).toBe("Synchronization date: Alder has 20 days in year 1.");
    expect(new CalendarError({ key: "problem.noYearZero" }).message).toBe("This calendar has no year 0.");
  });
});

describe("campaign problems and labels", () => {
  it("word campaign Problems in the given language, nested params included", () => {
    const problem = { ns: "campaign" as const, key: "problem.wholeNumber" as const, params: { what: { ns: "campaign" as const, key: "problem.what.rewardXp" as const }, min: 0, max: 10 } };
    expect(problemText(problem, "pt-BR")).toBe("O XP da recompensa deve ser um número inteiro de 0 a 10.");
    expect(new CalendarError(problem).message).toBe("Reward XP must be a whole number from 0 to 10.");
  });

  it("word quest label maps on read, in the active language", async () => {
    const { setActiveSettings } = await import("../src/server/settings/active");
    const { DEFAULT_SETTINGS } = await import("../src/server/settings/settings");
    const { QUEST_STATUS_LABELS } = await import("../src/server/quests/types");
    setActiveSettings({ ...DEFAULT_SETTINGS, language: "pt-BR" });
    expect(QUEST_STATUS_LABELS.onHold).toBe("Em espera");
    setActiveSettings(DEFAULT_SETTINGS);
    expect(QUEST_STATUS_LABELS.onHold).toBe("On hold");
  });

  it("seed story structures and word writer warnings in the given language", async () => {
    const { templateChildren, healthWarnings } = await import("../src/server/writer/logic");
    const pt = createTranslator("pt-BR", "writer");
    expect(templateChildren("three-act", null, pt)?.[0]).toMatchObject({ kind: "arc", title: "Ato I: Preparação", beatKey: "setup" });
    const [warning] = healthWarnings([{ id: "t1", name: "O anel", kind: "chekhov", status: "open" }], [], [], [], pt);
    expect(warning.text).toBe("“O anel” ainda não está em nenhuma cena.");
  });

  it("word relation types on read and name them in relation errors", async () => {
    const { setActiveSettings } = await import("../src/server/settings/active");
    const { DEFAULT_SETTINGS } = await import("../src/server/settings/settings");
    const { labelFor } = await import("../src/server/relations/types");
    const { relationTypeName } = await import("../src/server/relations/store");
    setActiveSettings({ ...DEFAULT_SETTINGS, language: "pt-BR" });
    expect(labelFor({ type: "parent", fromId: "a", toId: "b" }, "b")).toBe("Filho de");
    setActiveSettings(DEFAULT_SETTINGS);
    expect(labelFor({ type: "parent", fromId: "a", toId: "b" }, "b")).toBe("Child of");
    expect(relationTypeName("liege", "pt-BR")).toBe("Suserano de");
    expect(relationTypeName("gone", "pt-BR")).toBe("gone");
  });

  it("name the default D&D coins in the given language", async () => {
    const { dndCoins } = await import("../src/server/sessions/types");
    expect(dndCoins(createTranslator("pt-BR", "campaign")).find((c) => c.id === "gp")).toEqual({ id: "gp", name: "Peça de ouro", short: "po", value: 100 });
  });

  it("word a generated character's stored English values in the given language", async () => {
    const { genderLabel, hairLabel, speciesLabel, beardLabel } = await import("../src/lib/character-on-demand/labels");
    const pt = createTranslator("pt-BR", "character");
    expect(hairLabel("Ponytail", "Auburn", pt)).toBe("Rabo de cavalo, cabelo acobreado escuro");
    expect(hairLabel("Ponytail", "Auburn", createTranslator("en-US", "character"))).toBe("Ponytail, auburn");
    expect([genderLabel("Female", pt), speciesLabel("dragonborn", pt), beardLabel("Goatee", pt), beardLabel("Old Beard", pt)]).toEqual(["Feminino", "Draconato", "Cavanhaque", "Old Beard"]);
  });

  it("store weather as codes and word them on display, leaving older English days as stored", async () => {
    const { generateWeatherDay } = await import("../src/lib/weather/generate");
    const { weatherText, geographyLabel, beaufortLabel } = await import("../src/lib/weather/labels");
    const pt = createTranslator("pt-BR", "weather");
    const day = generateWeatherDay({ climate: "Temperate", geography: "Coastal", season: "Autumn", minTemp: null, maxTemp: null }, () => 0.3);
    const texts = [...day.hours.flatMap((h) => [h.sky, h.precipitationLabel, h.label, ...h.effects]), ...day.effects.map((e) => e.text)];
    for (const text of texts) expect(MESSAGES["en-US"].weather[text], text).toBeDefined();
    expect(weatherText("precip.rain.heavy.thunder", pt)).toBe("Chuva forte com trovoada");
    expect(weatherText("Light rain", pt)).toBe("Light rain");
    expect(geographyLabel("Rocky Shore", pt)).toBe("Costão rochoso");
    expect(beaufortLabel(0, pt)).toBe("Calmaria");
  });
});

describe("celestial presets", () => {
  it("seed moon phase names in the active language", async () => {
    const { setActiveSettings } = await import("../src/server/settings/active");
    const { DEFAULT_SETTINGS } = await import("../src/server/settings/settings");
    setActiveSettings({ ...DEFAULT_SETTINGS, language: "pt-BR" });
    try {
      expect(EIGHT_PHASES.map((p) => p.name)).toContain("Lua Cheia");
      expect(problemText(celestialIssues("moon", { phases: [{ id: "a", name: "", icon: "", days: 0 }] })[1])).toBe("Uma fase precisa de 1 dia ou mais — fases não podem durar 0 dias.");
    } finally {
      setActiveSettings(DEFAULT_SETTINGS);
    }
    expect(EIGHT_PHASES[0].name).toBe("New Moon");
  });
});
