import type { Metadata } from "next";
import { connection } from "next/server";
import { Inter } from "next/font/google";
import AppNav from "@/components/AppNav";
import TooltipLayer from "@/components/TooltipLayer";
import SettingsProvider from "@/components/settings/SettingsProvider";
import { ensureDefaultWorld } from "@/server/world/default-world";
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
  const settings = await getSettings(await ensureDefaultWorld());
  return (
    <html lang="en" className={`${inter.variable} ${mapFontVariables}`}>
      <body>
        <SettingsProvider initialSettings={settings}>
          <AppNav />
          <main className="app-main">{children}</main>
          <TooltipLayer />
        </SettingsProvider>
      </body>
    </html>
  );
}
