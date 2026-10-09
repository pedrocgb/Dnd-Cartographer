import { redirect } from "next/navigation";
import SettlementGenerator from "@/components/tools/SettlementGenerator";
import { activeWorld } from "@/server/world/active-world";

export default async function SettlementGeneratorPage() {
  // The history is kept per world.
  const world = await activeWorld();
  if (!world) redirect("/worlds");
  return <SettlementGenerator worldId={world.id} />;
}
