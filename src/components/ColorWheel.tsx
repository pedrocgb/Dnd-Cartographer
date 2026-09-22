"use client";

import { useEffect, useRef, useState } from "react";

const WHEEL_SIZE = 140;
const RADIUS = WHEEL_SIZE / 2;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/.exec(hex.trim());
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rf) h = ((gf - bf) / d) % 6;
    else if (max === gf) h = (bf - rf) / d + 2;
    else h = (rf - gf) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/**
 * A self-contained hue/saturation wheel (angle = hue, radius = saturation)
 * plus a value/lightness slider, hex input, and RGB inputs — no external
 * color-picker dependency. Value is applied as a CSS filter over the wheel
 * for the visual only; the actual stored color always comes from
 * hsvToHex(h, s, v), never the filtered pixel.
 */
export default function ColorWheel({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState(() => {
    const rgb = hexToRgb(value);
    return rgb ? rgbToHsv(...rgb) : { h: 0, s: 1, v: 1 };
  });
  const [hexText, setHexText] = useState(value);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  // Re-sync from an external hex prop, but only when it actually changed
  // since the last render — adjusting state during render (React's
  // documented pattern for "state depends on a changed prop") rather than
  // in an effect, so it never fires on every re-render our own onChange
  // causes while a drag is fighting the parent's echoed value.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setHexText(value);
    const rgb = hexToRgb(value);
    if (rgb) setHsv(rgbToHsv(...rgb));
  }

  function setFromPointer(clientX: number, clientY: number) {
    const el = wheelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const s = clamp(dist / RADIUS, 0, 1);
    let h = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (h < 0) h += 360;
    const next = { h, s, v: hsv.v };
    setHsv(next);
    const hex = hsvToHex(next.h, next.s, next.v);
    setHexText(hex);
    onChange(hex);
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      setFromPointer(e.clientX, e.clientY);
    }
    function onUp() {
      draggingRef.current = false;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hsv.v]);

  function updateValue(v: number) {
    const next = { ...hsv, v };
    setHsv(next);
    const hex = hsvToHex(next.h, next.s, next.v);
    setHexText(hex);
    onChange(hex);
  }

  function commitHex(raw: string) {
    const trimmed = raw.trim();
    const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    const rgb = hexToRgb(withHash);
    if (!rgb) {
      setHexText(value);
      return;
    }
    const hex = withHash.toUpperCase();
    setHsv(rgbToHsv(...rgb));
    setHexText(hex);
    onChange(hex);
  }

  function updateRgbChannel(index: 0 | 1 | 2, raw: string) {
    const n = clamp(Math.round(Number(raw) || 0), 0, 255);
    const rgb = hexToRgb(hexText.startsWith("#") ? hexText : `#${hexText}`) ?? [0, 0, 0];
    rgb[index] = n;
    const hex = `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    setHsv(rgbToHsv(rgb[0], rgb[1], rgb[2]));
    setHexText(hex);
    onChange(hex);
  }

  const dotAngleRad = (hsv.h * Math.PI) / 180;
  const dotDist = hsv.s * RADIUS;
  const dotX = RADIUS + dotDist * Math.cos(dotAngleRad);
  const dotY = RADIUS + dotDist * Math.sin(dotAngleRad);
  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const rgb = hexToRgb(currentHex) ?? [0, 0, 0];

  return (
    <div className="color-wheel">
      <div
        ref={wheelRef}
        className="color-wheel-disc"
        style={{
          width: WHEEL_SIZE,
          height: WHEEL_SIZE,
          filter: `brightness(${hsv.v})`,
          // Hue wheel: a conic gradient sweeps hue by angle, rotated so hue 0
          // lands at the same screen-space "east" direction atan2(dy,dx)=0
          // uses below, matching setFromPointer's math exactly. Layered over
          // it, a white-to-transparent radial gradient represents saturation
          // (opaque white at the center fully hides the hue; fully
          // transparent at the rim shows it undiluted) — the classic
          // angle=hue, radius=saturation color-wheel disc.
          backgroundImage:
            "radial-gradient(circle, #fff 0%, rgba(255,255,255,0) 100%), conic-gradient(from 90deg, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))",
        }}
        onMouseDown={(e) => {
          draggingRef.current = true;
          setFromPointer(e.clientX, e.clientY);
        }}
      >
        <div className="color-wheel-dot" style={{ left: dotX, top: dotY, background: currentHex }} />
      </div>

      <div className="color-wheel-controls">
        <label className="color-wheel-field">
          <span className="field-label">Value</span>
          <input type="range" min={0} max={1} step={0.01} value={hsv.v} onChange={(e) => updateValue(Number(e.target.value))} />
        </label>

        <div className="color-wheel-preview" style={{ background: currentHex }} />

        <label className="color-wheel-field">
          <span className="field-label">Hex</span>
          <input
            type="text"
            value={hexText}
            onChange={(e) => setHexText(e.target.value)}
            onBlur={(e) => commitHex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </label>

        <div className="color-wheel-rgb">
          {(["R", "G", "B"] as const).map((label, i) => (
            <label key={label} className="color-wheel-field">
              <span className="field-label">{label}</span>
              <input
                type="number"
                min={0}
                max={255}
                value={rgb[i]}
                onChange={(e) => updateRgbChannel(i as 0 | 1 | 2, e.target.value)}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
