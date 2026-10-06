import { CloudSun, Dices, type LucideIcon } from "lucide-react";

export interface Tool {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

/** The Advanced Tools: listed in the top bar's dropdown and the tools sidebar. */
export const TOOLS: Tool[] = [
  { href: "/tools/character-on-demand", label: "Character On Demand", description: "Random named characters", icon: Dices },
  { href: "/tools/weather", label: "Weather Generator", description: "Weather by climate and place", icon: CloudSun },
];
