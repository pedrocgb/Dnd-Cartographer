import { Suspense } from "react";
import BoardsScreen from "@/components/relations/BoardsScreen";

export default function BoardsRoute() {
  return (
    <Suspense fallback={null}>
      <BoardsScreen />
    </Suspense>
  );
}
