"use client";

import RichEditor from "@/components/RichEditor";
import { outlineTree, type OutlineTreeNode } from "@/server/writer/logic";
import { NODE_KIND_LABELS, type OutlineNode } from "@/server/writer/types";

type Tree = OutlineTreeNode<OutlineNode>;

const anchorId = (id: string) => `wr-read-${id}`;

function findSubtree(list: Tree[], id: string): Tree | null {
  for (const t of list) {
    if (t.node.id === id) return t;
    const found = findSubtree(t.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * The story as a book, read only: the selected arc, chapter or scene with
 * everything inside it (or the whole story when nothing is selected), each
 * item's synopsis and text in reading order, with a table of contents.
 */
export default function StoryReader({ nodes, rootId, title, pitch, onReadAll }: { nodes: OutlineNode[]; rootId: string | null; title: string; pitch: string; onReadAll: () => void }) {
  const tree = outlineTree(nodes);
  const root = rootId ? findSubtree(tree, rootId) : null;
  const sections = root ? root.children : tree;

  if (!root && tree.length === 0) return <p className="cal-help wr-empty">Nothing to read yet. Write an arc in Edit mode first.</p>;

  return (
    <article className="wr-reader" aria-label={root ? root.node.title : title}>
      <header className="wr-reader-head">
        {root && <span className={`wr-kind wr-kind-${root.node.kind}`}>{NODE_KIND_LABELS[root.node.kind]}</span>}
        <h1 className="wr-reader-title">{root ? root.node.title : title}</h1>
        {(root ? root.node.synopsis : pitch) && <p className="wr-reader-lead">{root ? root.node.synopsis : pitch}</p>}
        {root && (
          <button type="button" className="btn-link wr-reader-all" onClick={onReadAll}>
            Read the whole story
          </button>
        )}
      </header>

      {sections.length > 0 && (
        <nav className="wr-reader-toc" aria-label="Contents">
          <h2 className="field-label">Contents</h2>
          <TocList list={sections} />
        </nav>
      )}

      {root && <ReaderText key={root.node.id} node={root.node} />}
      {sections.map((t) => (
        <ReaderSection key={t.node.id} tree={t} depth={2} />
      ))}
    </article>
  );
}

function TocList({ list }: { list: Tree[] }) {
  return (
    <ol>
      {list.map((t) => (
        <li key={t.node.id}>
          <button type="button" className="btn-link" onClick={() => document.getElementById(anchorId(t.node.id))?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            {t.node.title}
          </button>
          {t.children.length > 0 && <TocList list={t.children} />}
        </li>
      ))}
    </ol>
  );
}

function ReaderSection({ tree, depth }: { tree: Tree; depth: number }) {
  const Heading = (depth === 2 ? "h2" : depth === 3 ? "h3" : "h4") as "h2" | "h3" | "h4";
  return (
    <section className={`wr-reader-section wr-reader-${tree.node.kind}`} id={anchorId(tree.node.id)}>
      <Heading className="wr-reader-heading">{tree.node.title}</Heading>
      {tree.node.synopsis && <p className="wr-reader-lead">{tree.node.synopsis}</p>}
      <ReaderText node={tree.node} />
      {tree.children.map((c) => (
        <ReaderSection key={c.node.id} tree={c} depth={depth + 1} />
      ))}
    </section>
  );
}

/** The item's text, if it has any (read mode never creates one). */
function ReaderText({ node }: { node: OutlineNode }) {
  if (!node.documentId) return null;
  return <RichEditor documentId={node.documentId} editable={false} />;
}
