import { redirect } from "next/navigation";
import WeatherGenerator from "@/components/tools/WeatherGenerator";
import { activeWorld } from "@/server/world/active-world";

export default async function WeatherGeneratorPage() {
  // The history is kept per world.
  const world = await activeWorld();
  if (!world) redirect("/worlds");
  return <WeatherGenerator worldId={world.id} />;
}
