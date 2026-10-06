import type { Backstory } from "@/lib/character-on-demand/backstory";

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
 * the secret in a GM-only secret block.
 */
export function buildCharacterDocument(details: DetailLine[], backstory?: Backstory | null) {
  const content: unknown[] = [heading("Generated details"), bullets(details)];
  if (backstory) {
    content.push(
      heading("Appearance"),
      { type: "paragraph", content: [text(backstory.appearance)] },
      heading("Right now"),
      { type: "paragraph", content: [text(backstory.want)] },
      heading("Personality"),
      bullets([
        { label: "Quirk", value: backstory.quirk },
        { label: "Fear", value: backstory.fear },
      ]),
      { type: "secret", attrs: { revealed: false }, content: [labelled({ label: "Secret", value: backstory.secret })] },
    );
  }
  return { type: "doc", content };
}
