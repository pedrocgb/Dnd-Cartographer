import { Suspense } from "react";
import CalendarsManager from "@/components/calendars/CalendarsManager";

export default function CalendarsPage() {
  return (
    <Suspense fallback={null}>
      <CalendarsManager />
    </Suspense>
  );
}
