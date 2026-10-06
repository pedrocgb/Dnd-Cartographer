import { redirect } from "next/navigation";
import CharacterOnDemand from "@/components/tools/CharacterOnDemand";
import { activeWorld } from "@/server/world/active-world";

export default async function CharacterOnDemandPage() {
  // The history is kept per world.
  const world = await activeWorld();
  if (!world) redirect("/worlds");
  return <CharacterOnDemand worldId={world.id} />;
}
