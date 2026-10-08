import type { Metadata } from "next";
import ShareView from "@/components/share/ShareView";
import { loadShare } from "@/server/share/load";
import { serverT } from "@/i18n/server";

export async function generateMetadata({ params }: PageProps<"/share/[token]">): Promise<Metadata> {
  const share = await loadShare((await params).token);
  const title = !share ? (await serverT("articles"))("share.unavailableTitle") : share.view.kind === "article" ? share.view.title : share.view.root.title;
  // Shared by link only: never listed by search engines.
  return { title, robots: { index: false, follow: false } };
}

export default async function SharePage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;
  return <ShareView token={token} />;
}
