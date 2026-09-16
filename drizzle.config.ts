import { defineConfig } from "drizzle-kit";
import { DB_FILE } from "./src/server/data-dir";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: `file:${DB_FILE}`,
  },
});
