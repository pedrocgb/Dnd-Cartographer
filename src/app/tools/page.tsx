import { redirect } from "next/navigation";
import { TOOLS } from "@/components/tools/tools";

/** /tools opens the first tool. */
export default function ToolsPage() {
  redirect(TOOLS[0].href);
}
