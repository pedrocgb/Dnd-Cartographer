import { personTemplate, type ArticleTemplateKey } from "@/server/articles/templates";
import { ARTICLE_TEMPLATES } from "./templates";
import type { PickerOption } from "./InfoPicker";

export interface Candidate {
  template: ArticleTemplateKey;
  id: string;
  name: string;
}

async function json<T>(res: Response): Promise<T> {
  return res.json();
}

/** Every live article, for article pickers. */
export async function loadCandidates(): Promise<Candidate[]> {
  const [t, p, o, a] = await Promise.all([
    fetch("/api/politics/territories").then((r) => json<{ territories: { id: string; name: string }[] }>(r)),
    fetch("/api/politics/people").then((r) => json<{ people: { id: string; name: string; kind: string }[] }>(r)),
    fetch("/api/politics/organizations").then((r) => json<{ organizations: { id: string; name: string }[] }>(r)),
    fetch("/api/articles").then((r) => json<{ articles: { id: string; title: string; template: ArticleTemplateKey }[] }>(r)),
  ]);
  return [
    ...t.territories.map((x) => ({ template: "territory" as const, id: x.id, name: x.name })),
    ...p.people.map((x) => ({ template: personTemplate(x.kind), id: x.id, name: x.name })),
    ...o.organizations.map((x) => ({ template: "organization" as const, id: x.id, name: x.name })),
    ...a.articles.map((x) => ({ template: x.template, id: x.id, name: x.title })),
  ];
}

/** Picker rows grouped by template in sidebar order, alphabetical within; `exclude` ids left out. */
export function candidateOptions(candidates: Candidate[], exclude: ReadonlySet<string> = new Set()): PickerOption[] {
  return ARTICLE_TEMPLATES.flatMap((t) =>
    candidates
      .filter((c) => c.template === t.key && !exclude.has(c.id))
      .sort((x, y) => x.name.localeCompare(y.name))
      .map((c) => ({ value: c.id, label: c.name, group: t.plural }))
  );
}
