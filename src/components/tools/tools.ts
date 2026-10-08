import { CloudSun, Dices, type LucideIcon } from "lucide-react";

export interface Tool {
  /** Its key in the `tools` messages: `${id}.label`, `${id}.description`. */
  id: "characterOnDemand" | "weather";
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

/** The Advanced Tools: listed in the top bar's dropdown and the tools sidebar. `label`/`description` are the English fallback; show them through the `tools` messages. */
export const TOOLS: Tool[] = [
  { id: "characterOnDemand", href: "/tools/character-on-demand", label: "Character On Demand", description: "Random named characters", icon: Dices },
  { id: "weather", href: "/tools/weather", label: "Weather Generator", description: "Weather by climate and place", icon: CloudSun },
];
