"use client";

import { useEffect, useState } from "react";
import { Link2Off, PanelRightClose, TextAlignStart, Footprints, type LucideIcon } from "lucide-react";
import ReadOnlyRich from "@/components/rich-editor/ReadOnlyRich";
import { templateOf } from "@/components/articles/templates";
import { NODE_KIND_LABELS } from "@/server/writer/types";
import type { SharedSection, ShareView as View } from "@/server/share/load";
import { sectionAnchor as anchorId, type JsonNode } from "@/server/share/transform";

type Loaded = { state: "loading" } | { state: "gone" } | { state: "ready"; view: View };

/** The view, null when the link is gone, undefined when the request failed (offline). */
async function fetchView(token: string): Promise<View | null | undefined> {
  try {
    const res = await fetch(`/api/share/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (res.status === 404) return null;
    return res.ok ? ((await res.json()).view as View) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A shared article or story, read only, for someone outside the app: the
 * live text, with unrevealed secrets already left out by the server. It
 * follows the share's event stream and refetches whenever the owner
 * changes anything in it, so viewers never need to reload.
 */
export default function ShareView({ token }: { token: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    let events: EventSource | null = null;
    // Only the latest refetch lands (changes can arrive faster than fetches).
    let latest = 0;
    const refresh = async () => {
      const ticket = ++latest;
      const view = await fetchView(token);
      if (cancelled || ticket !== latest || view === undefined) return;
      if (view) setLoaded({ state: "ready", view });
      else {
        setLoaded({ state: "gone" });
        events?.close();
      }
    };
    void refresh().then(() => {
      if (cancelled) return;
      events = new EventSource(`/api/share/${encodeURIComponent(token)}/events`);
      events.addEventListener("change", () => void refresh());
      events.addEventListener("gone", () => {
        events?.close();
        setLoaded({ state: "gone" });
      });
      // Back from a dropped connection: catch up on anything missed meanwhile.
      events.addEventListener("open", () => void refresh());
    });
    return () => {
      cancelled = true;
      events?.close();
    };
  }, [token]);

  if (loaded.state === "loading") return <p className="share-status" role="status">Loading…</p>;
  if (loaded.state === "gone") {
    return (
      <div className="share-status share-gone" role="alert">
        <Link2Off size={20} strokeWidth={2} aria-hidden />
        <p>This link is no longer available.</p>
      </div>
    );
  }
  const { view } = loaded;
  return <div className="share-page">{view.kind === "article" ? <SharedArticle view={view} /> : <SharedStory view={view} />}</div>;
}

function SharedCard({ variant, Icon, label, doc }: { variant: string; Icon: LucideIcon; label: string; doc: JsonNode | null }) {
  return (
    <section className={`article-card article-card-${variant}`} aria-label={label}>
      <header className="article-card-header">
        <span className="article-card-label">
          <Icon size={13} strokeWidth={2.25} aria-hidden />
          <span className="field-label">{label}</span>
        </span>
      </header>
      {doc ? <ReadOnlyRich content={doc} /> : <p className="article-card-placeholder">Nothing here yet.</p>}
    </section>
  );
}

function SharedArticle({ view }: { view: Extract<View, { kind: "article" }> }) {
  const { Icon } = templateOf(view.template);
  return (
    <article className="article-view">
      <header className="article-header">
        <h1 className="article-title">
          <Icon size={24} strokeWidth={2} aria-label={view.templateLabel} />
          <span className="article-title-text">{view.title}</span>
        </h1>
      </header>
      {view.portraitUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- served by the share's own route, not a static asset
        <img className="share-portrait" src={view.portraitUrl} alt={view.title} />
      )}
      <div className={view.footer ? "article-cards has-footer" : "article-cards"}>
        <SharedCard variant="body" Icon={TextAlignStart} label="Body" doc={view.body} />
        <SharedCard variant="sidebar" Icon={PanelRightClose} label="Sidebar" doc={view.sidebar} />
        {view.footer && <SharedCard variant="footer" Icon={Footprints} label="Footer" doc={view.footer} />}
      </div>
    </article>
  );
}

function SharedStory({ view }: { view: Extract<View, { kind: "writer" }> }) {
  const { root, sections } = view;
  return (
    <article className="wr-reader" aria-label={root.title}>
      <header className="wr-reader-head">
        {root.kind ? <span className={`wr-kind wr-kind-${root.kind}`}>{NODE_KIND_LABELS[root.kind]}</span> : <span className="field-label">Campaign</span>}
        <h1 className="wr-reader-title">{root.title}</h1>
        {root.lead && <p className="wr-reader-lead">{root.lead}</p>}
      </header>

      {sections.length > 0 && (
        <nav className="wr-reader-toc" aria-label="Contents">
          <h2 className="field-label">Contents</h2>
          <TocList list={sections} />
        </nav>
      )}

      {root.doc && <ReadOnlyRich content={root.doc} />}
      {sections.map((s) => (
        <StorySection key={s.id} section={s} depth={2} />
      ))}
    </article>
  );
}

function TocList({ list }: { list: SharedSection[] }) {
  return (
    <ol>
      {list.map((s) => (
        <li key={s.id}>
          <button type="button" className="btn-link" onClick={() => document.getElementById(anchorId(s.id))?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            {s.title}
          </button>
          {s.children.length > 0 && <TocList list={s.children} />}
        </li>
      ))}
    </ol>
  );
}

function StorySection({ section, depth }: { section: SharedSection; depth: number }) {
  const Heading = (depth === 2 ? "h2" : depth === 3 ? "h3" : "h4") as "h2" | "h3" | "h4";
  return (
    <section className={`wr-reader-section wr-reader-${section.kind}`} id={anchorId(section.id)}>
      <Heading className="wr-reader-heading">{section.title}</Heading>
      {section.synopsis && <p className="wr-reader-lead">{section.synopsis}</p>}
      {section.doc && <ReadOnlyRich content={section.doc} />}
      {section.children.map((c) => (
        <StorySection key={c.id} section={c} depth={depth + 1} />
      ))}
    </section>
  );
}
