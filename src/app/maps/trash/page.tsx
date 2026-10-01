import { redirect } from "next/navigation";

/** The trash moved to Settings → Trash. */
export default function TrashPage() {
  redirect("/settings/trash");
}
