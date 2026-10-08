import type { ArticleTemplateKey } from "@/server/articles/templates";
import { ARTICLE_TEMPLATES } from "./templates";
import type { Candidate } from "./candidates";
import { activeT } from "@/i18n/active";

/**
 * Templates an article can be created for with just a name, straight from
 * another page (e.g. a map marker). Territory is left out: it needs a type
 * and a place in a hierarchy, so it goes through the Articles page's form.
 */
export const QUICK_CREATE_TEMPLATES = ARTICLE_TEMPLATES.filter((t) => t.key !== "territory");

/** Creates an empty article named `name`; throws with the server's message on failure. */
export async function quickCreateArticle(template: ArticleTemplateKey, name: string): Promise<Candidate> {
  const person = template === "character" || template === "playerCharacter";
  const [url, body, key] = person
    ? ["/api/politics/people", { name, kind: template === "playerCharacter" ? "player" : "npc" }, "person"]
    : template === "organization"
      ? ["/api/politics/organizations", { name }, "organization"]
      : ["/api/articles", { template, title: name }, "article"];
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? activeT("articles")("manager.createFailed"));
  return { template, id: data[key].id, name };
}
