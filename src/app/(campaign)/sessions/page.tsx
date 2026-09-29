import { Suspense } from "react";
import SessionsManager from "@/components/sessions/SessionsManager";

export default function SessionsPage() {
  return (
    <Suspense fallback={null}>
      <SessionsManager />
    </Suspense>
  );
}
