import { Moon, Orbit, Shapes, Sparkles, Star, Sun, Telescope, type LucideIcon } from "lucide-react";
import type { CelestialType } from "@/server/calendars/celestial";
import { activeT } from "@/i18n/active";

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

/** `label`, `plural` and `detail` are worded on read, in the active language. */
function typeInfo(type: CelestialType, Icon: LucideIcon, symbol: string, color: string): CelestialTypeInfo {
  return {
    type,
    Icon,
    symbol,
    color,
    get label() {
      return activeT("calendars")(`type.${type}.label`);
    },
    get plural() {
      return activeT("calendars")(`type.${type}.plural`);
    },
    get detail() {
      return activeT("calendars")(`type.${type}.detail`);
    },
  };
}

/** Every celestial type, in display order (type chooser and Sky folders). */
export const CELESTIAL_TYPES: CelestialTypeInfo[] = [
  typeInfo("moon", Moon, "☾", "#E8E3D5"),
  typeInfo("sun", Sun, "☀", "#E8BD7C"),
  typeInfo("star", Star, "★", "#9CC3F5"),
  typeInfo("constellation", Sparkles, "✧", "#7AD9C8"),
  typeInfo("planet", Orbit, "♁", "#D29C53"),
  typeInfo("comet", Telescope, "☄", "#F5A397"),
  typeInfo("custom", Shapes, "◈", "#A7ADB5"),
];
