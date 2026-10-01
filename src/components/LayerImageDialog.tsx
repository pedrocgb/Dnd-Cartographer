"use client";

import { formatDecimal } from "@/server/settings/number-format";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair, ImageOff, ImageUp, LoaderCircle, Minus, Plus, RotateCcw } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import Modal from "./Modal";
import type { AlwaysDrawFlag, LayerPatch, MapLayerData } from "./layer-images";

export interface Frame {
  width: number;
  height: number;
}

const STEPS = [1, 10, 100] as const;
const SCALE_STEP = 0.5;

const ALWAYS_DRAW_OPTIONS: { flag: AlwaysDrawFlag; noun: string }[] = [
  { flag: "zonesAlwaysVisible", noun: "zones" },
  { flag: "markersAlwaysVisible", noun: "markers" },
  { flag: "textsAlwaysVisible", noun: "texts" },
  { flag: "linesAlwaysVisible", noun: "lines" },
  { flag: "routesAlwaysVisible", noun: "routes" },
];

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

const MAX_LAYER_NAME = 120;

/** The layer's name: saved on Enter or leaving the field, Esc restores it. */
function LayerNameField({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  const [lastName, setLastName] = useState(name);
  // Follow renames made elsewhere (the Layers list) without clobbering typing.
  if (name !== lastName) {
    setLastName(name);
    setDraft(name);
  }
  const commit = () => {
    const next = draft.trim();
    if (next && next !== name) onRename(next);
    else setDraft(name);
  };
  return (
    <label className="grid-field lid-name">
      <span className="field-label">Name</span>
      <input
        type="text"
        value={draft}
        maxLength={MAX_LAYER_NAME}
        aria-label="Layer name"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setDraft(name);
          }
        }}
      />
    </label>
  );
}

/** Reads "-12", "98,98" or "10.05"; null while the text isn't a number yet ("", "-", ","). */
function parseNumber(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * A text field for numbers: keeps what's typed (a lone "-", a trailing comma)
 * until it reads as a number, takes a comma or a dot as the decimal mark, and
 * steps with ↑/↓ (Shift: ten steps).
 */
function NumberField({ value, decimals, step, label, onCommit }: { value: number; decimals: number; step: number; label: string; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = formatDecimal(value, { maximumFractionDigits: decimals, grouping: false });
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={draft ?? shown}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = parseNumber(e.target.value);
        if (n !== null) onCommit(n);
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          setDraft(null);
          onCommit(value + (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1));
        }
      }}
    />
  );
}

/**
 * A layer's settings: its image (add, replace, delete), where the image sits
 * on the map (size with presets that fit the map's width, height or the
 * image's own pixels; position with a nudge pad, arrow keys and exact X/Y in
 * map pixels; opacity), all applied live, and what it keeps drawing while
 * another layer is active. Minimize it to check the result against the map.
 */
export default function LayerImageDialog({
  layer,
  frame,
  processing,
  uploadError,
  onUpdate,
  onReplace,
  onRemoveImage,
  onClose,
}: {
  layer: MapLayerData;
  frame: Frame;
  /** A new image is still being processed. */
  processing: boolean;
  uploadError: string | null;
  onUpdate: (patch: LayerPatch) => void;
  onReplace: (file: File) => void;
  onRemoveImage: () => void;
  onClose: () => void;
}) {
  const [minimized, setMinimized] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [step, setStep] = useState<(typeof STEPS)[number]>(10);
  const asset = layer.asset;
  const ready = Boolean(asset) && !processing;

  // Positions are stored in map widths; the dialog speaks map pixels.
  const x = round1(layer.imageX * frame.width);
  const y = round1(layer.imageY * frame.width);
  const scale = round2(layer.imageScale * 100);
  const aspect = asset?.width && asset.height ? asset.height / asset.width : null;
  const shownWidth = Math.round(layer.imageScale * frame.width);
  const shownHeight = aspect ? Math.round(shownWidth * aspect) : null;

  const moveTo = (px: number, py: number) => onUpdate({ imageX: px / frame.width, imageY: py / frame.width });
  const nudge = (dx: number, dy: number, big = false) => moveTo(x + dx * step * (big ? 10 : 1), y + dy * step * (big ? 10 : 1));
  const setScale = (percent: number) => Number.isFinite(percent) && percent >= 1 && onUpdate({ imageScale: round2(percent) / 100 });
  const presets = [
    { key: "width", label: "Map width", hint: "As wide as the map", scale: 1 },
    { key: "height", label: "Map height", hint: "As tall as the map", scale: aspect ? frame.height / frame.width / aspect : null },
    { key: "pixels", label: "Actual size", hint: "One image pixel per map pixel", scale: asset?.width ? asset.width / frame.width : null },
  ];
  const center = () => {
    const w = layer.imageScale * frame.width;
    moveTo((frame.width - w) / 2, aspect ? (frame.height - w * aspect) / 2 : y);
  };

  // Arrow keys nudge the image (Shift: ten steps), except while typing in a field.
  useEffect(() => {
    if (!ready || minimized || confirmRemove) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!dir) return;
      e.preventDefault();
      nudge(dir[0], dir[1], e.shiftKey);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <Modal open onClose={onClose} title={`Layer settings · ${layer.name}`} minimized={minimized} onMinimize={setMinimized}>
        <div className="lid">
          <LayerNameField name={layer.name} onRename={(name) => onUpdate({ name })} />
          <div className="lid-summary">
            {asset ? (
              // eslint-disable-next-line @next/next/no-img-element -- small local thumbnail
              <img className="lid-thumb" src={`/api/thumbnails/${asset.id}`} alt="" />
            ) : (
              <div className="lid-thumb lid-thumb-empty" />
            )}
            <dl className="lid-sizes">
              <div>
                <dt>Image</dt>
                <dd>{asset?.width && asset.height ? `${asset.width} × ${asset.height} px` : "—"}</dd>
              </div>
              <div>
                <dt>Map</dt>
                <dd>
                  {frame.width} × {frame.height} px
                </dd>
              </div>
              <div>
                <dt>Shown at</dt>
                <dd>{asset && shownHeight ? `${shownWidth} × ${shownHeight} px` : "—"}</dd>
              </div>
            </dl>
            <div className="lid-image-actions">
              <label className={processing ? "btn btn-sm disabled" : "btn btn-sm"}>
                <ImageUp size={13} strokeWidth={2.25} />
                {asset ? "Replace" : "Add image"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  disabled={processing}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) onReplace(file);
                  }}
                />
              </label>
              {asset && (
                <button type="button" className="btn btn-sm btn-danger" disabled={processing} onClick={() => setConfirmRemove(true)}>
                  <ImageOff size={13} strokeWidth={2.25} />
                  Delete
                </button>
              )}
            </div>
          </div>
          {uploadError && (
            <p className="form-error" role="alert">
              {uploadError}
            </p>
          )}

          {processing ? (
            <p className="lid-processing" role="status">
              <LoaderCircle size={16} className="lid-spin" aria-hidden />
              Processing the new image… You can line it up as soon as it&apos;s ready.
            </p>
          ) : !ready ? (
            <p className="lid-processing">This layer has no image yet. Add one to place it on the map.</p>
          ) : (
            <>
              <section className="lid-section" aria-labelledby="lid-size">
                <header className="lid-section-head">
                  <h3 id="lid-size">Size</h3>
                  <div className="lid-stepper">
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Smaller" onClick={() => setScale(scale - SCALE_STEP)}>
                      <Minus size={13} strokeWidth={2.25} />
                    </button>
                    <NumberField value={scale} decimals={2} step={0.1} label="Scale in percent" onCommit={setScale} />
                    <span className="lid-unit">%</span>
                    <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Bigger" onClick={() => setScale(scale + SCALE_STEP)}>
                      <Plus size={13} strokeWidth={2.25} />
                    </button>
                  </div>
                </header>
                <input className="lid-range" type="range" min={10} max={300} step={0.5} value={Math.min(300, Math.max(10, scale))} aria-label="Scale" onChange={(e) => setScale(Number(e.target.value))} />
                <div className="lid-chips" role="group" aria-label="Size presets">
                  {presets.map((p) =>
                    p.scale === null ? null : (
                      <button key={p.key} type="button" className={Math.abs(p.scale - layer.imageScale) < 0.0005 ? "lid-chip active" : "lid-chip"} data-tooltip={p.hint} onClick={() => onUpdate({ imageScale: p.scale! })}>
                        {p.label}
                      </button>
                    )
                  )}
                </div>
              </section>

              <section className="lid-section" aria-labelledby="lid-position">
                <header className="lid-section-head">
                  <h3 id="lid-position">Position</h3>
                  <div className="lid-chips" role="radiogroup" aria-label="Nudge step">
                    {STEPS.map((s) => (
                      <button key={s} type="button" role="radio" aria-checked={step === s} className={step === s ? "lid-chip active" : "lid-chip"} onClick={() => setStep(s)}>
                        {s} px
                      </button>
                    ))}
                  </div>
                </header>
                <div className="lid-position">
                  <div className="lid-pad" role="group" aria-label="Nudge the image">
                    <span />
                    <button type="button" aria-label={`Up ${step} px`} onClick={(e) => nudge(0, -1, e.shiftKey)}>
                      <ArrowUp size={15} strokeWidth={2.25} />
                    </button>
                    <span />
                    <button type="button" aria-label={`Left ${step} px`} onClick={(e) => nudge(-1, 0, e.shiftKey)}>
                      <ArrowLeft size={15} strokeWidth={2.25} />
                    </button>
                    <button type="button" className="lid-pad-center" aria-label="Center on the map" data-tooltip="Center on the map" onClick={center}>
                      <Crosshair size={15} strokeWidth={2.25} />
                    </button>
                    <button type="button" aria-label={`Right ${step} px`} onClick={(e) => nudge(1, 0, e.shiftKey)}>
                      <ArrowRight size={15} strokeWidth={2.25} />
                    </button>
                    <span />
                    <button type="button" aria-label={`Down ${step} px`} onClick={(e) => nudge(0, 1, e.shiftKey)}>
                      <ArrowDown size={15} strokeWidth={2.25} />
                    </button>
                    <span />
                  </div>
                  <div className="lid-coords">
                    <label>
                      <span>X</span>
                      <NumberField value={x} decimals={1} step={1} label="X in map pixels" onCommit={(v) => moveTo(v, y)} />
                      <span className="lid-unit">px</span>
                    </label>
                    <label>
                      <span>Y</span>
                      <NumberField value={y} decimals={1} step={1} label="Y in map pixels" onCommit={(v) => moveTo(x, v)} />
                      <span className="lid-unit">px</span>
                    </label>
                    <p className="lid-hint">Arrow keys nudge too · Shift moves 10×</p>
                  </div>
                </div>
              </section>

              <section className="lid-section" aria-labelledby="lid-opacity">
                <header className="lid-section-head">
                  <h3 id="lid-opacity">Opacity</h3>
                  <span className="lid-value">{Math.round(layer.imageOpacity * 100)}%</span>
                </header>
                <input className="lid-range" type="range" min={0} max={100} value={Math.round(layer.imageOpacity * 100)} aria-label="Image opacity" onChange={(e) => onUpdate({ imageOpacity: Number(e.target.value) / 100 })} />
              </section>
            </>
          )}

          <section className="lid-section" aria-labelledby="lid-always">
            <header className="lid-section-head">
              <h3 id="lid-always">While another layer is active</h3>
            </header>
            <div className="lid-checks">
              {asset && (
                <label className="lid-check" data-tooltip="Draw this image under every layer, not only when this layer is active">
                  <input type="checkbox" checked={layer.imageAlwaysVisible} onChange={(e) => onUpdate({ imageAlwaysVisible: e.target.checked })} />
                  Always draw this image
                </label>
              )}
              {ALWAYS_DRAW_OPTIONS.map((o) => (
                <label key={o.flag} className="lid-check" data-tooltip={`Draw this layer's ${o.noun} even while another layer is active (display only)`}>
                  <input type="checkbox" checked={layer[o.flag]} onChange={(e) => onUpdate({ [o.flag]: e.target.checked })} />
                  Always draw {o.noun}
                </label>
              ))}
            </div>
          </section>

          <footer className="lid-footer">
            <button type="button" className="btn btn-sm btn-ghost" disabled={!ready || (layer.imageX === 0 && layer.imageY === 0 && layer.imageScale === 1)} onClick={() => onUpdate({ imageX: 0, imageY: 0, imageScale: 1 })}>
              <RotateCcw size={13} strokeWidth={2.25} />
              Reset
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
              Done
            </button>
          </footer>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmRemove}
        title={`Delete the image of ${layer.name}?`}
        confirmLabel="Delete image"
        onConfirm={() => {
          setConfirmRemove(false);
          onRemoveImage();
        }}
        onCancel={() => setConfirmRemove(false)}
      >
        The layer stays, with its markers, zones, texts and lines. Only its image is removed.
      </ConfirmDialog>
    </>
  );
}
