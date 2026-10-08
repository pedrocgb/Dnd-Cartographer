import type { Backstory } from "@/lib/character-on-demand/backstory";
import type { Translator } from "@/i18n/translate";

/** One "Label: value" line of a generated character's details. */
export interface DetailLine {
  label: string;
  value: string;
}

const text = (value: string) => ({ type: "text", text: value });
const heading = (title: string) => ({ type: "heading", attrs: { level: 2 }, content: [text(title)] });
const labelled = ({ label, value }: DetailLine) => ({
  type: "paragraph",
  content: [{ ...text(`${label}: `), marks: [{ type: "bold" }] }, text(value)],
});
const bullets = (lines: DetailLine[]) => ({
  type: "bulletList",
  content: lines.map((line) => ({ type: "listItem", content: [labelled(line)] })),
});

/**
 * The body of a character made by Character On Demand: its details as a
 * list, then the backstory (appearance, what they want, personality) with
 * the secret in a GM-only secret block. Headings are in the language of `t`.
 */
export function buildCharacterDocument(details: DetailLine[], backstory: Backstory | null | undefined, t: Translator<"character">) {
  const content: unknown[] = [heading(t("doc.details")), bullets(details)];
  if (backstory) {
    content.push(
      heading(t("modal.appearance")),
      { type: "paragraph", content: [text(backstory.appearance)] },
      heading(t("modal.rightNow")),
      { type: "paragraph", content: [text(backstory.want)] },
      heading(t("doc.personality")),
      bullets([
        { label: t("modal.quirk"), value: backstory.quirk },
        { label: t("modal.fear"), value: backstory.fear },
      ]),
      { type: "secret", attrs: { revealed: false }, content: [labelled({ label: t("modal.secret"), value: backstory.secret })] },
    );
  }
  return { type: "doc", content };
}
