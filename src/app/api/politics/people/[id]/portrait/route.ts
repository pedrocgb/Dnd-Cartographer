import { portraitRouteHandlers } from "@/server/politics/portrait-routes";

export const runtime = "nodejs";

export const { GET, POST, PUT, DELETE } = portraitRouteHandlers("person");
