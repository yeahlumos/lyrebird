import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lyrebird（琴鸟）",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
