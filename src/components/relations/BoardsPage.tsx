"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, LayoutDashboard, Loader2, Pencil, Plus, StickyNote, Trash2, Users, X } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";
import { Skeleton } from "@/components/Skeleton";
import { templateLabel } from "@/server/articles/templates";
import { useT } from "@/i18n/useT";
import { activeT } from "@/i18n/active";
import { isNoteId, MAX_BOARD_NAME, NOTE_PREFIX, type BoardCard, type BoardFilters } from "@/server/relations/boards";
import type { ClientBoard } from "@/server/relations/board-store";
import { webEdges } from "@/server/relations/graph";
import type { Point } from "@/server/relations/layout";
import { RELATION_GROUPS, type RelationGroup } from "@/server/relations/types";
import RelationsLegend from "./RelationsLegend";
import type { CanvasCard, CanvasLine } from "./RelationsCanvas";
import { useHideSecrets, useRelations } from "./relations-context";
import { GROUP_COLORS, HideSecretsSwitch, RailHeader, RailSection, RailSwitch, RelWorkspace, StageEmpty } from "./workspace";

const RelationsCanvas = dynamic(() => import("./RelationsCanvas"), { ssr: false, loading: () => <Skeleton height="100%" radius="0" /> });

const NOTE_COLORS = [
  { color: "#facc15", name: "yellow" },
  { color: "#fb923c", name: "orange" },
  { color: "#f87171", name: "red" },
  { color: "#f472b6", name: "pink" },
  { color: "#c084fc", name: "purple" },
  { color: "#60a5fa", name: "blue" },
  { color: "#4ade80", name: "green" },
] as const;
const SAVE_DELAY = 600;

type SaveState = "idle" | "saving" | "saved" | "error";

async function send(url: string, method: string, body?: unknown): Promise<{ board?: ClientBoard; boards?: ClientBoard[] }> {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? activeT("relations")("boards.serverError", { status: res.status }));
  return data;
}

/** Where a new card goes: around `near` (ring by ring), or right of the rightmost card. */
function spotFor(cards: readonly BoardCard[], near?: Point, index = 0): Point {
  if (near) {
    const angle = (index * 2 * Math.PI) / 8 - Math.PI / 2;
    const ring = 240 + Math.floor(index / 8) * 120;
    return { x: Math.round(near.x + ring * Math.cos(angle)), y: Math.round(near.y + ring * Math.sin(angle)) };
  }
  if (!cards.length) return { x: 0, y: 0 };
  const right = cards.reduce((a, b) => (b.x > a.x ? b : a));
  return { x: right.x + 240, y: right.y };
}

function BoardRow({ board, active, onOpen, onRename, onDelete }: { board: ClientBoard; active: boolean; onOpen: () => void; onRename: (name: string) => void; onDelete: () => void }) {
  const t = useT("relations");
  const [name, setName] = useState<string | null>(null);
  const save = () => {
    const next = name?.trim();
    setName(null);
    if (next && next !== board.name) onRename(next);
  };
  if (name !== null) {
    return (
      <li className="rel-board-row editing">
        <input
          autoFocus
          maxLength={MAX_BOARD_NAME}
          value={name}
          aria-label={t("boards.name")}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              e.preventDefault();
              setName(null);
            }
          }}
        />
      </li>
    );
  }
  const notes = board.cards.filter((c) => isNoteId(c.id)).length;
  const articles = board.cards.length - notes;
  return (
    <li className={active ? "rel-board-row active" : "rel-board-row"}>
      <button type="button" className="rel-board-open" onClick={onOpen} onDoubleClick={() => setName(board.name)} aria-current={active ? "page" : undefined}>
        <LayoutDashboard size={14} aria-hidden />
        <span className="rel-board-name">{board.name}</span>
        <span className="rel-board-meta">
          {t("boards.articles", { count: articles })}
          {notes > 0 && ` · ${t("boards.notes", { count: notes })}`}
        </span>
      </button>
      <span className="rel-board-actions">
        <button type="button" className="rel-icon-btn" onClick={() => setName(board.name)} aria-label={t("boards.renameNamed", { name: board.name })} data-tooltip={t("boards.rename")}>
          <Pencil size={13} />
        </button>
        <button type="button" className="rel-icon-btn danger" onClick={onDelete} aria-label={t("boards.deleteNamed", { name: board.name })} data-tooltip={t("ui.delete")}>
          <Trash2 size={13} />
        </button>
      </span>
    </li>
  );
}

/**
 * Saved relationship boards: a free canvas where the user places articles
 * (their real relations drawn between them) and sticky notes. Cards save
 * as they move; the board's filters save with it.
 */
export default function BoardsPage({ boardId, onOpenBoard }: { boardId: string | null; onOpenBoard: (id: string | null) => void }) {
  const t = useT("relations");
  const ta = useT("articles");
  const { relations, derived, catalog, openArticle } = useRelations();
  const [hideSecrets] = useHideSecrets();
  const [boards, setBoards] = useState<ClientBoard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [selected, setSelected] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ClientBoard | null>(null);
  const pending = useRef<{ id: string; patch: Partial<ClientBoard> } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const job = pending.current;
    pending.current = null;
    if (!job) return;
    try {
      await send(`/api/relation-boards/${job.id}`, "PATCH", job.patch);
      if (!pending.current) setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    send("/api/relation-boards", "GET")
      .then((data) => !cancelled && setBoards(data.boards ?? []))
      .catch((err) => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => () => void flush(), [flush, boardId]);

  const board = boards?.find((b) => b.id === boardId) ?? null;

  /** Updates a board locally at once and saves it shortly after (moves come in bursts). */
  const change = (id: string, patch: Partial<Pick<ClientBoard, "cards" | "filters" | "name">>, now = false) => {
    setBoards((prev) => prev?.map((b) => (b.id === id ? { ...b, ...patch } : b)) ?? prev);
    if (pending.current && pending.current.id !== id) void flush();
    pending.current = { id, patch: { ...(pending.current?.id === id ? pending.current.patch : {}), ...patch } };
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    if (now) void flush();
    else timer.current = setTimeout(() => void flush(), SAVE_DELAY);
  };

  const cards = useMemo(() => board?.cards ?? [], [board]);
  const filters = useMemo<BoardFilters>(() => board?.filters ?? {}, [board]);
  const groups = useMemo(() => filters.groups ?? [], [filters]);
  const setCards = (next: BoardCard[]) => board && change(board.id, { cards: next });
  const setFilters = (next: BoardFilters) => board && change(board.id, { filters: next });

  const create = async () => {
    setError(null);
    try {
      const { board: created } = await send("/api/relation-boards", "POST", { name: t("boards.newName", { n: (boards?.length ?? 0) + 1 }) });
      if (!created) return;
      setBoards((prev) => [...(prev ?? []), created]);
      onOpenBoard(created.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const remove = async () => {
    if (!deleting) return;
    try {
      await send(`/api/relation-boards/${deleting.id}`, "DELETE");
      if (pending.current?.id === deleting.id) pending.current = null;
      setBoards((prev) => prev?.filter((b) => b.id !== deleting.id) ?? prev);
      if (deleting.id === boardId) onOpenBoard(null);
      setDeleting(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const present = useMemo(() => new Set(cards.map((c) => c.id)), [cards]);
  const allEdges = useMemo(
    () => webEdges(catalog, relations, derived, { hideSecrets, groups, showDerived: filters.showDerived ?? false, showLinked: false }),
    [catalog, relations, derived, hideSecrets, groups, filters.showDerived]
  );
  const edges = useMemo(() => allEdges.filter((e) => present.has(e.fromId) && present.has(e.toId)), [allEdges, present]);
  const tiesOf = useCallback(
    (id: string) => [...new Set(allEdges.flatMap((e) => (e.fromId === id ? [e.toId] : e.toId === id ? [e.fromId] : [])))].filter((other) => !present.has(other)),
    [allEdges, present]
  );

  const canvasCards = useMemo<CanvasCard[]>(
    () =>
      cards.flatMap((c): CanvasCard[] => {
        const position = { x: c.x, y: c.y };
        if (isNoteId(c.id)) return [{ kind: "note", id: c.id, position, text: c.text ?? "", color: c.color }];
        const entry = catalog.get(c.id);
        return entry ? [{ kind: "record", id: c.id, position, entry }] : [];
      }),
    [cards, catalog]
  );
  const lines = useMemo<CanvasLine[]>(() => edges.map((edge) => ({ kind: "graph", edge })), [edges]);
  const missing = cards.filter((c) => !isNoteId(c.id) && !catalog.has(c.id)).length;

  const recordOptions = useMemo<PickerOption[]>(
    () =>
      [...catalog.values()]
        .filter((e) => !present.has(e.id))
        .sort((a, b) => a.template.localeCompare(b.template) || a.name.localeCompare(b.name))
        .map((e) => ({ value: e.id, label: e.name, group: templateLabel(e.template, ta) })),
    [catalog, present, ta]
  );

  const selectedCard = cards.find((c) => c.id === selected);
  const addRecord = (id: string | null) => {
    if (!id || present.has(id)) return;
    setCards([...cards, { id, ...spotFor(cards, selectedCard, cards.length) }]);
  };
  const addNote = () => {
    const id = `${NOTE_PREFIX}${crypto.randomUUID()}`;
    setCards([...cards, { id, ...spotFor(cards, selectedCard, cards.length), text: "", color: NOTE_COLORS[0].color }]);
  };
  const addTies = (id: string) => {
    const from = cards.find((c) => c.id === id);
    if (!from) return;
    setCards([...cards, ...tiesOf(id).map((other, i) => ({ id: other, ...spotFor(cards, from, i) }))]);
  };
  const removeCards = (ids: string[]) => {
    setCards(cards.filter((c) => !ids.includes(c.id)));
    if (selected && ids.includes(selected)) setSelected(null);
  };
  const editCard = (id: string, patch: Partial<BoardCard>) => setCards(cards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const moved = (moves: Record<string, Point>) => setCards(cards.map((c) => (moves[c.id] ? { ...c, ...moves[c.id] } : c)));
  const toggleGroup = (g: RelationGroup) => setFilters({ ...filters, groups: groups.includes(g) ? groups.filter((x) => x !== g) : [...groups, g] });

  // Floats by the selected card: above an article, below a note.
  const renderToolbar = (card: CanvasCard) => {
    if (card.kind === "note") {
      return (
        <>
          <span className="rel-swatches" role="radiogroup" aria-label={t("boards.noteColor")}>
            {NOTE_COLORS.map((c) => (
              <button
                key={c.color}
                type="button"
                role="radio"
                aria-checked={card.color === c.color}
                aria-label={t(`boards.color.${c.name}`)}
                data-tooltip={t(`boards.color.${c.name}`)}
                className={card.color === c.color ? "rel-swatch active" : "rel-swatch"}
                style={{ background: c.color }}
                onClick={() => editCard(card.id, { color: c.color })}
              />
            ))}
          </span>
          <span className="rel-float-sep" aria-hidden />
          <button type="button" className="rel-float-btn danger" onClick={() => removeCards([card.id])} aria-label={t("boards.deleteNote")} data-tooltip={t("boards.deleteNote")}>
            <Trash2 size={14} />
          </button>
        </>
      );
    }
    if (card.kind !== "record") return null;
    const ties = tiesOf(card.id).length;
    return (
      <>
        <button type="button" className="rel-float-btn" onClick={() => openArticle(card.entry.template, card.entry.id)} data-tooltip={t("boards.openArticle")}>
          <ExternalLink size={14} /> {t("ui.open")}
        </button>
        <button type="button" className="rel-float-btn" disabled={!ties} onClick={() => addTies(card.id)} data-tooltip={ties ? t("boards.addTiesHint") : t("boards.allTiesOn")}>
          <Users size={14} /> {t("boards.addTies")}
          {ties > 0 && <span className="rel-chip-count">{ties}</span>}
        </button>
        <span className="rel-float-sep" aria-hidden />
        <button type="button" className="rel-float-btn danger" onClick={() => removeCards([card.id])} aria-label={t("boards.removeFromBoard")} data-tooltip={t("boards.removeFromBoardHint")}>
          <X size={14} />
        </button>
      </>
    );
  };

  const rail = (
    <>
      <RailHeader Icon={LayoutDashboard} title={t("boards.title")} subtitle={t("boards.subtitle")} />
      <RailSection
        title={t("boards.yours")}
        action={
          <button type="button" className="btn-link" onClick={create}>
            <Plus size={13} /> {t("boards.new")}
          </button>
        }
      >
        {boards === null ? (
          <Skeleton height={36} />
        ) : boards.length === 0 ? (
          <p className="rel-muted">{t("boards.none")}</p>
        ) : (
          <ul className="rel-board-list">
            {boards.map((b) => (
              <BoardRow key={b.id} board={b} active={b.id === boardId} onOpen={() => onOpenBoard(b.id)} onRename={(name) => change(b.id, { name }, true)} onDelete={() => setDeleting(b)} />
            ))}
          </ul>
        )}
      </RailSection>
      {board && (
        <>
          <RailSection title={t("boards.addTo")}>
            <InfoPicker options={recordOptions} value={null} placeholder={t("boards.addArticlePick")} ariaLabel={t("boards.addArticle")} collapsibleGroups onChange={addRecord} />
            <button type="button" className="btn btn-sm rel-rail-btn" onClick={addNote}>
              <StickyNote size={14} /> {t("boards.addNote")}
            </button>
          </RailSection>
          <RailSection title={t("boards.tiesDrawn")} action={groups.length > 0 && <button type="button" className="btn-link" onClick={() => setFilters({ ...filters, groups: [] })}>{t("ui.all")}</button>}>
            <div className="rel-chip-grid">
              {RELATION_GROUPS.map((g) => {
                const on = groups.includes(g.key);
                return (
                  <button key={g.key} type="button" className={on ? "rel-filter-chip active" : "rel-filter-chip"} aria-pressed={on} onClick={() => toggleGroup(g.key)} style={{ ["--chip" as string]: GROUP_COLORS[g.key] }}>
                    <span className="rel-dot" aria-hidden />
                    {g.label}
                  </button>
                );
              })}
            </div>
            <RailSwitch label={t("ui.fromOtherInfo")} hint={t("ui.fromOtherInfoHint")} checked={filters.showDerived ?? false} onChange={(on) => setFilters({ ...filters, showDerived: on })} />
            <RailSwitch label={t("ui.colorByAttitude")} hint={t("ui.colorByAttitudeHint")} checked={filters.attitudeMode ?? false} onChange={(on) => setFilters({ ...filters, attitudeMode: on })} />
            <HideSecretsSwitch />
          </RailSection>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {board && <p className="rel-rail-tip">{t("boards.tip")}</p>}
    </>
  );

  return (
    <RelWorkspace rail={rail}>
      {!board ? (
        <StageEmpty Icon={LayoutDashboard} title={boards?.length ? t("boards.openTitle") : t("boards.firstTitle")}>
          {boards?.length ? t("boards.openBody") : t("boards.firstBody")}
        </StageEmpty>
      ) : canvasCards.length === 0 ? (
        <StageEmpty Icon={StickyNote} title={t("boards.emptyTitle")}>
          {t("boards.emptyBody")}
        </StageEmpty>
      ) : (
        <>
          <RelationsCanvas
            key={board.id}
            cards={canvasCards}
            lines={lines}
            attitudeMode={filters.attitudeMode ?? false}
            onOpen={(e) => openArticle(e.template, e.id)}
            onMoved={moved}
            onSelect={setSelected}
            onDelete={removeCards}
            onNoteText={(id, text) => editCard(id, { text })}
            renderToolbar={renderToolbar}
          />
          {edges.length > 0 && (
            <details className="rel-legend-panel">
              <summary>{t("ui.legend")}</summary>
              <RelationsLegend edges={edges} attitudeMode={filters.attitudeMode ?? false} />
            </details>
          )}
        </>
      )}
      {!board && (
        <button type="button" className="btn btn-create rel-stage-cta" onClick={create}>
          <Plus size={14} /> {t("boards.newBoard")}
        </button>
      )}
      {board && (
        <div className="rel-focus-pill">
          <LayoutDashboard size={13} aria-hidden /> {board.name}
          <span className={`rel-save rel-save-${saveState}`} aria-live="polite">
            {saveState === "saving" && (
              <>
                <Loader2 size={12} className="rel-spin" /> {t("boards.saving")}
              </>
            )}
            {saveState === "saved" && (
              <>
                <Check size={12} /> {t("boards.saved")}
              </>
            )}
            {saveState === "error" && t("boards.notSaved")}
          </span>
          {missing > 0 && (
            <span className="rel-muted" data-tooltip={t("boards.missingHint")}>
              {t("boards.missing", { n: missing })}
            </span>
          )}
        </div>
      )}
      <ConfirmDialog open={deleting !== null} title={t("boards.deleteTitle")} confirmLabel={t("boards.deleteConfirm")} onConfirm={remove} onCancel={() => setDeleting(null)}>
        <p>{t("boards.deleteBody", { name: deleting?.name ?? "" })}</p>
      </ConfirmDialog>
    </RelWorkspace>
  );
}
