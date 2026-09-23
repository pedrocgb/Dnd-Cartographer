import { portraitRouteHandlers } from "@/server/politics/portrait-routes";

export const runtime = "nodejs";

export const { POST, DELETE } = portraitRouteHandlers("organization");
