import { Moon, Orbit, Shapes, Sparkles, Star, Sun, Telescope, type LucideIcon } from "lucide-react";
import type { CelestialType } from "@/server/calendars/celestial";

export interface CelestialTypeInfo {
  type: CelestialType;
  label: string;
  /** Sky folder name. */
  plural: string;
  Icon: LucideIcon;
  symbol: string;
  color: string;
  detail: string;
}

/** Every celestial type, in display order (type chooser and Sky folders). */
export const CELESTIAL_TYPES: CelestialTypeInfo[] = [
  { type: "moon", label: "Moon", plural: "Moons", Icon: Moon, symbol: "☾", color: "#E8E3D5", detail: "Phases that repeat on a cycle: new, full and everything between." },
  { type: "sun", label: "Sun", plural: "Suns", Icon: Sun, symbol: "☀", color: "#E8BD7C", detail: "Lore, with optional states like eclipsed or blazing." },
  { type: "star", label: "Star", plural: "Stars", Icon: Star, symbol: "★", color: "#9CC3F5", detail: "A star whose brightness or visibility can change." },
  { type: "constellation", label: "Constellation", plural: "Constellations", Icon: Sparkles, symbol: "✧", color: "#7AD9C8", detail: "Visible during part of every year." },
  { type: "planet", label: "Planet", plural: "Planets", Icon: Orbit, symbol: "♁", color: "#D29C53", detail: "Appearance cycles and rare phenomena." },
  { type: "comet", label: "Comet", plural: "Comets", Icon: Telescope, symbol: "☄", color: "#F5A397", detail: "Appears on a date, and may return." },
  { type: "custom", label: "Custom", plural: "Custom", Icon: Shapes, symbol: "◈", color: "#A7ADB5", detail: "Anything else, with states of your own." },
];
