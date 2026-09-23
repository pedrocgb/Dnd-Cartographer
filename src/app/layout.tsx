import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AppNav from "@/components/AppNav";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${mapFontVariables}`}>
      <body>
        <AppNav />
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
