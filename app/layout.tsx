import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import FlightSky from "./_birds/flight";
import CursorBird from "./_birds/cursor-bird";
import "./globals.css";
import { GlobalTheme } from "./_theme/theme";

const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: "variable", variable: "--font-cormorant" });

export const metadata: Metadata = {
  title: "Lyrebird（琴鸟）",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={cormorant.variable}>
      <body><GlobalTheme />{children}<FlightSky /><CursorBird /></body>
    </html>
  );
}
