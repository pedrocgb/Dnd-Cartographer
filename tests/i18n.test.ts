import { describe, expect, it } from "vitest";
import { LOCALES } from "../src/i18n/config";
import { MESSAGES, type Namespace } from "../src/i18n/messages";
import { createTranslator, translate } from "../src/i18n/translate";
import { formatRealDate } from "../src/server/settings/date-format";

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
