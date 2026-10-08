import { cookies } from "next/headers";
import WorldsScreen from "@/components/worlds/WorldsScreen";
import { WORLD_COOKIE } from "@/server/world/world-cookie";
import { listWorlds } from "@/server/world/worlds";
import { serverT } from "@/i18n/server";

export async function generateMetadata() {
  const t = await serverT("worlds");
  return { title: t("metaTitle") };
}

export default async function WorldsPage() {
  const [worlds, store] = await Promise.all([listWorlds(), cookies()]);
  const active = store.get(WORLD_COOKIE)?.value ?? null;
  return <WorldsScreen initialWorlds={worlds} activeId={worlds.some((w) => w.id === active) ? active : null} />;
}
