import { Suspense } from "react";
import { redirect } from "next/navigation";
import ArticlesManager from "@/components/articles/ArticlesManager";

export default async function ArticlesPage({ searchParams }: PageProps<"/articles">) {
  // Boards moved to the Campaign area; old `?type=boards[&id=]` links keep working.
  const { type, id } = await searchParams;
  if (type === "boards") redirect(typeof id === "string" ? `/boards?id=${encodeURIComponent(id)}` : "/boards");
  return (
    <Suspense fallback={null}>
      <ArticlesManager />
    </Suspense>
  );
}
