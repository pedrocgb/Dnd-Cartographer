import { Suspense } from "react";
import ArticlesManager from "@/components/articles/ArticlesManager";

export default function ArticlesPage() {
  return (
    <Suspense fallback={null}>
      <ArticlesManager />
    </Suspense>
  );
}
