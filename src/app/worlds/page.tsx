import { cookies } from "next/headers";
import WorldsScreen from "@/components/worlds/WorldsScreen";
import { WORLD_COOKIE } from "@/server/world/world-cookie";
import { listWorlds } from "@/server/world/worlds";

export const metadata = { title: "World Wiki — Choose your world" };

export default async function WorldsPage() {
  const [worlds, store] = await Promise.all([listWorlds(), cookies()]);
  const active = store.get(WORLD_COOKIE)?.value ?? null;
  return <WorldsScreen initialWorlds={worlds} activeId={worlds.some((w) => w.id === active) ? active : null} />;
}
