"use client";

import { emptyRequiredInfo } from "@/server/articles/info-fields";
import { INFO_FIELD_SETS } from "@/server/articles/info-sets";
import { isPersonTemplate, type ArticleTemplateKey, type GenericTemplateKey } from "@/server/articles/templates";
import { useT } from "@/i18n/useT";
import type { ArticleLists } from "./ArticlesSidebar";
import { PersonForm } from "./CharacterArticle";
import CreateArticleModal from "./CreateArticleModal";
import { InfoForm, type InfoLookups } from "./InfoBar";
import { OrganizationForm } from "./OrganizationArticle";
import { TerritoryForm } from "./TerritoryArticle";
import type { HierarchyProfile, Territory } from "./types";

/** What a record's link info fields can point at. */
export function buildInfoLookups(lists: ArticleLists, seasonProfiles: { id: string; name: string; detail: string }[]): InfoLookups {
  const lookups: InfoLookups = {
    character: lists.people.filter((p) => p.kind !== "player"),
    playerCharacter: lists.people.filter((p) => p.kind === "player"),
    organization: lists.organizations,
    territory: lists.territories,
    seasonProfile: seasonProfiles,
  };
  for (const a of lists.articles) (lookups[a.template] ??= []).push({ id: a.id, name: a.title });
  return lookups;
}

/**
 * "Create new article" with every template's create form: the chooser, then
 * a title (generic) or the template's form. `onCreated` gets the new record.
 */
export default function CreateArticleFlow({
  initialTemplate,
  territories,
  profiles,
  lookups,
  onClose,
  onCreated,
}: {
  initialTemplate: ArticleTemplateKey | null;
  territories: Territory[];
  profiles: HierarchyProfile[];
  lookups: InfoLookups;
  onClose: () => void;
  onCreated: (template: ArticleTemplateKey, id: string) => void;
}) {
  const t = useT("articles");
  const tc = useT("common");

  async function createGeneric(template: GenericTemplateKey, title: string): Promise<string | null> {
    const res = await fetch("/api/articles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template, title }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? t("manager.createFailed");
    onCreated(template, data.article.id);
    return null;
  }

  /** A template's create form, shown in the create modal: name plus its required fields. */
  function renderForm(template: ArticleTemplateKey, onBack: () => void) {
    if (template === "territory") {
      return <TerritoryForm profiles={profiles} territories={territories} onSaved={(r) => onCreated("territory", r.id)} onCancel={onClose} onBack={onBack} />;
    }
    if (isPersonTemplate(template)) {
      return <PersonForm kind={template === "playerCharacter" ? "player" : "npc"} onSaved={(p) => onCreated(template, p.id)} onCancel={onClose} onBack={onBack} />;
    }
    if (template === "organization") return <OrganizationForm onSaved={(o) => onCreated("organization", o.id)} onCancel={onClose} onBack={onBack} />;
    const set = INFO_FIELD_SETS[template];
    if (!set) return null;
    // Title plus the template's required info fields (in their set order); nothing else until created.
    return (
      <InfoForm
        key={template}
        set={set}
        name=""
        initialValues={emptyRequiredInfo(set)}
        lookups={lookups}
        allowAdding={false}
        saveLabel={tc("create")}
        savingLabel={tc("creating")}
        onSave={(title, info) => fetch("/api/articles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template, title, info }) })}
        onSaved={async (res) => onCreated(template, (await res.json()).article.id)}
        onCancel={onClose}
        onBack={onBack}
      />
    );
  }

  return <CreateArticleModal initialTemplate={initialTemplate} onClose={onClose} onCreate={createGeneric} renderForm={renderForm} />;
}
