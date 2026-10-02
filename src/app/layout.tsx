import type { Metadata } from "next";
import { connection } from "next/server";
import { Inter } from "next/font/google";
import AppNav from "@/components/AppNav";
import TooltipLayer from "@/components/TooltipLayer";
import SettingsProvider from "@/components/settings/SettingsProvider";
import { cookies } from "next/headers";
import { activeWorld } from "@/server/world/active-world";
import { WORLD_COOKIE } from "@/server/world/world-cookie";
import ForgetStaleWorld from "@/components/worlds/ForgetStaleWorld";
import { getSettings } from "@/server/settings/store";
import { mapFontVariables } from "./map-fonts";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "World Wiki — Maps",
  description: "Local map & marker workspace",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The user's settings come with every page, so formatted dates and units are right on first paint.
  await connection();
  const [settings, world, store] = await Promise.all([getSettings(), activeWorld(), cookies()]);
  // The cookie names a world that is gone (deleted in another browser).
  const stale = Boolean(store.get(WORLD_COOKIE)?.value) && !world;
  return (
    <html lang="en" className={`${inter.variable} ${mapFontVariables}`}>
      <body data-world={world?.id}>
        <SettingsProvider initialSettings={settings}>
          <AppNav world={world} />
          <main className="app-main">{children}</main>
          <TooltipLayer />
          {stale && <ForgetStaleWorld />}
        </SettingsProvider>
      </body>
    </html>
  );
}
