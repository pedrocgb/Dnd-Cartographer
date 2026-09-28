"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, LayoutDashboard, Pencil, Plus, StickyNote, Trash2, Users, X } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import InfoPicker, { type PickerOption } from "@/components/articles/InfoPicker";
import { Skeleton } from "@/components/Skeleton";
import { TEMPLATE_LABELS } from "@/server/articles/templates";
import { isNoteId, MAX_BOARD_NAME, MAX_NOTE_TEXT, NOTE_PREFIX, type BoardCard, type BoardFilters } from "@/server/relations/boards";
import type { ClientBoard } from "@/server/relations/board-store";
import { webEdges } from "@/server/relations/graph";
import type { Point } from "@/server/relations/layout";
import { RELATION_GROUPS, type RelationGroup } from "@/server/relations/types";
import RelationsLegend from "./RelationsLegend";
import type { CanvasCard, CanvasLine } from "./RelationsCanvas";
import { useHideSecrets, useRelations } from "./relations-context";

const RelationsCanvas = dynamic(() => import("./RelationsCanvas"), { ssr: false, loading: () => <Skeleton height="100%" radius="var(--radius-md)" /> });

const NOTE_COLORS = ["#facc15", "#60a5fa", "#f87171", "#4ade80", "#c084fc"];
const SAVE_DELAY = 600;

async function send(url: string, method: string, body?: unknown): Promise<{ board?: ClientBoard; boards?: ClientBoard[]; error?: string }> {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "The board couldn't be saved.");
  return data;
}

/** Where a new card goes: right of the rightmost card, or near `near`. */
function spotFor(cards: BoardCard[], near?: Point, index = 0): Point {
  if (near) {
    const angle = (index * 2 * Math.PI) / 8;
    const ring = 260 + Math.floor(index / 8) * 120;
    return { x: Math.round(near.x + ring * Math.cos(angle)), y: Math.round(near.y + ring * Math.sin(angle)) };
  }
  if (!cards.length) return { x: 0, y: 0 };
  const right = Math.max(...cards.map((c) => c.x));
  return { x: right + 240, y: cards[cards.length - 1].y };
}

/**
 * Saved relationship boards: a free canvas where the user places articles
 * (their real relations drawn between them) and sticky notes. Cards save
 * as they move; the board's filters save with it.
 */
export default function BoardsPage({ boardId, onOpenBoard }: { boardId: string | null; onOpenBoard: (id: string | null) => void }) {
  const { relations, derived, catalog, openArticle } = useRelations();
  const [hideSecrets, setHideSecrets] = useHideSecrets();
  const [boards, setBoards] = useState<ClientBoard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
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
    } catch (err) {
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

  /** Updates the board locally at once and saves it shortly after (moves come in bursts). */
  const change = (patch: Partial<Pick<ClientBoard, "cards" | "filters" | "name">>, now = false) => {
    if (!board) return;
    setBoards((prev) => prev?.map((b) => (b.id === board.id ? { ...b, ...patch } : b)) ?? prev);
    pending.current = { id: board.id, patch: { ...(pending.current?.id === board.id ? pending.current.patch : {}), ...patch } };
    if (timer.current) clearTimeout(timer.current);
    if (now) void flush();
    else timer.current = setTimeout(() => void flush(), SAVE_DELAY);
  };
  const setCards = (cards: BoardCard[]) => change({ cards });
  const setFilters = (filters: BoardFilters) => change({ filters });

  const create = async () => {
    setError(null);
    try {
      const { board: created } = await send("/api/relation-boards", "POST", { name: `Board ${(boards?.length ?? 0) + 1}` });
      if (!created) return;
      setBoards((prev) => [...(prev ?? []), created]);
      onOpenBoard(created.id);
      setRenaming(created.name);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const saveName = () => {
    const name = renaming?.trim();
    setRenaming(null);
    if (name && board && name !== board.name) change({ name }, true);
  };
  const remove = async () => {
    if (!board) return;
    try {
      await send(`/api/relation-boards/${board.id}`, "DELETE");
      pending.current = null;
      setBoards((prev) => prev?.filter((b) => b.id !== board.id) ?? prev);
      setDeleting(false);
      onOpenBoard(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const cards = useMemo(() => board?.cards ?? [], [board]);
  const present = useMemo(() => new Set(cards.map((c) => c.id)), [cards]);
  const filters = useMemo<BoardFilters>(() => board?.filters ?? {}, [board]);
  const groups = useMemo(() => filters.groups ?? [], [filters]);
  const edges = useMemo(
    () =>
      webEdges(catalog, relations, derived, { hideSecrets, groups, showDerived: filters.showDerived ?? false, showLinked: false }).filter(
        (e) => present.has(e.fromId) && present.has(e.toId)
      ),
    [catalog, relations, derived, hideSecrets, groups, filters.showDerived, present]
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

  const boardOptions = useMemo<PickerOption[]>(() => (boards ?? []).map((b) => ({ value: b.id, label: b.name })), [boards]);
  const recordOptions = useMemo<PickerOption[]>(
    () =>
      [...catalog.values()]
        .filter((e) => !present.has(e.id))
        .sort((a, b) => a.template.localeCompare(b.template) || a.name.localeCompare(b.name))
        .map((e) => ({ value: e.id, label: e.name, group: TEMPLATE_LABELS[e.template] })),
    [catalog, present]
  );

  const selectedCard = cards.find((c) => c.id === selected) ?? null;
  const addRecord = (id: string | null) => id && !present.has(id) && setCards([...cards, { id, ...spotFor(cards) }]);
  const addNote = () => {
    const id = `${NOTE_PREFIX}${crypto.randomUUID()}`;
    setCards([...cards, { id, ...spotFor(cards), text: "", color: NOTE_COLORS[0] }]);
    setSelected(id);
  };
  const addNeighbours = () => {
    if (!selectedCard) return;
    const all = webEdges(catalog, relations, derived, { hideSecrets, groups, showDerived: filters.showDerived ?? false, showLinked: false });
    const ids = [...new Set(all.flatMap((e) => (e.fromId === selectedCard.id ? [e.toId] : e.toId === selectedCard.id ? [e.fromId] : [])))].filter((id) => !present.has(id));
    setCards([...cards, ...ids.map((id, i) => ({ id, ...spotFor(cards, selectedCard, i) }))]);
  };
  const removeSelected = () => {
    if (!selectedCard) return;
    setCards(cards.filter((c) => c.id !== selectedCard.id));
    setSelected(null);
  };
  const editNote = (patch: Partial<BoardCard>) => selectedCard && setCards(cards.map((c) => (c.id === selectedCard.id ? { ...c, ...patch } : c)));
  const moved = (moves: Record<string, Point>) => setCards(cards.map((c) => (moves[c.id] ? { ...c, ...moves[c.id] } : c)));
  const toggleGroup = (g: RelationGroup) => setFilters({ ...filters, groups: groups.includes(g) ? groups.filter((x) => x !== g) : [...groups, g] });

  // Remount only when cards come or go: dragging keeps React Flow's own state.
  const canvasKey = [board?.id, ...canvasCards.map((c) => c.id)].join("|");

  return (
    <div className="rel-page">
      <header className="rel-page-header">
        <h1>
          <LayoutDashboard size={20} strokeWidth={2.25} aria-hidden /> Boards
        </h1>
        <div className="rel-toolbar">
          {boards === null ? (
            <Skeleton height="32px" width="240px" />
          ) : renaming !== null && board ? (
            <input
              autoFocus
              maxLength={MAX_BOARD_NAME}
              value={renaming}
              aria-label="Board name"
              onChange={(e) => setRenaming(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  e.preventDefault();
                  setRenaming(null);
                }
              }}
            />
          ) : (
            <InfoPicker options={boardOptions} value={board?.id ?? null} placeholder={boards.length ? "Open a board…" : "No boards yet"} ariaLabel="Board" disabled={!boards.length} onChange={onOpenBoard} />
          )}
          <button type="button" className="btn btn-sm" onClick={create}>
            <Plus size={14} /> New board
          </button>
          {board && (
            <>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRenaming(board.name)} data-tooltip="Rename this board">
                <Pencil size={14} /> Rename
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDeleting(true)} data-tooltip="Delete this board (its articles stay)">
                <Trash2 size={14} /> Delete
              </button>
            </>
          )}
          <button type="button" className={hideSecrets ? "btn btn-sm active" : "btn btn-sm"} aria-pressed={hideSecrets} onClick={() => setHideSecrets(!hideSecrets)} data-tooltip="Hide secret ties everywhere (for sharing your screen)">
            {hideSecrets ? <EyeOff size={14} /> : <Eye size={14} />} {hideSecrets ? "Secrets hidden" : "Hide secrets"}
          </button>
        </div>
        {board && (
          <div className="rel-toolbar">
            <InfoPicker options={recordOptions} value={null} placeholder="Add an article…" ariaLabel="Add an article" collapsibleGroups onChange={addRecord} />
            <button type="button" className="btn btn-sm" onClick={addNote}>
              <StickyNote size={14} /> Add note
            </button>
            <button type="button" className="btn btn-sm btn-ghost" disabled={!selectedCard || isNoteId(selectedCard.id)} onClick={addNeighbours} data-tooltip="Add everything tied to the selected article">
              <Users size={14} /> Add its ties
            </button>
            <button type="button" className="btn btn-sm btn-ghost" disabled={!selectedCard} onClick={removeSelected} data-tooltip="Take the selected card off the board">
              <X size={14} /> Remove from board
            </button>
            {RELATION_GROUPS.map((g) => (
              <button key={g.key} type="button" className={groups.includes(g.key) ? "rel-chip active" : "rel-chip"} aria-pressed={groups.includes(g.key)} onClick={() => toggleGroup(g.key)}>
                {g.label}
              </button>
            ))}
            <label className="cal-check">
              <input type="checkbox" checked={filters.showDerived ?? false} onChange={(e) => setFilters({ ...filters, showDerived: e.target.checked })} /> From other information
            </label>
            <label className="cal-check">
              <input type="checkbox" checked={filters.attitudeMode ?? false} onChange={(e) => setFilters({ ...filters, attitudeMode: e.target.checked })} /> Attitude colors
            </label>
          </div>
        )}
        {selectedCard && isNoteId(selectedCard.id) && (
          <div className="rel-toolbar rel-board-note">
            <textarea
              rows={3}
              maxLength={MAX_NOTE_TEXT}
              value={selectedCard.text ?? ""}
              placeholder="Write the note…"
              aria-label="Note text"
              onChange={(e) => editNote({ text: e.target.value })}
            />
            <div className="info-color-editor" role="group" aria-label="Note color">
              {NOTE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={selectedCard.color === color ? "color-swatch active" : "color-swatch"}
                  style={{ background: color }}
                  aria-label={`Color ${color}`}
                  aria-pressed={selectedCard.color === color}
                  onClick={() => editNote({ color })}
                />
              ))}
            </div>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </header>
      {board && <RelationsLegend edges={edges} attitudeMode={filters.attitudeMode ?? false} />}
      <div className="rel-canvas">
        {!board ? (
          <p className="cal-help rel-empty">{boards?.length ? "Open a board, or start a new one." : "Boards are canvases you arrange yourself: put articles and notes on one, and their relationships draw themselves."}</p>
        ) : canvasCards.length === 0 ? (
          <p className="cal-help rel-empty">An empty board. Add an article or a note above.</p>
        ) : (
          <RelationsCanvas
            key={canvasKey}
            cards={canvasCards}
            lines={lines}
            attitudeMode={filters.attitudeMode ?? false}
            onOpen={(e) => openArticle(e.template, e.id)}
            onMoved={moved}
            onSelect={setSelected}
          />
        )}
      </div>
      <p className="cal-help">
        Drag cards to arrange them; double-click an article to open it. Select a card to add its ties or remove it.
        {missing > 0 && ` ${missing} card(s) point to deleted articles and stay hidden until they're restored.`}
      </p>
      <ConfirmDialog open={deleting} title="Delete board?" confirmLabel="Delete board" onConfirm={remove} onCancel={() => setDeleting(false)}>
        <p>“{board?.name}” and its notes will be deleted. The articles and their relationships stay.</p>
      </ConfirmDialog>
    </div>
  );
}
