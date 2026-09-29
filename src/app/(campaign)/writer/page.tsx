import { Suspense } from "react";
import WriterManager from "@/components/writer/WriterManager";

export default function WriterPage() {
  return (
    <Suspense fallback={null}>
      <WriterManager />
    </Suspense>
  );
}
