import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { AnalyticsScripts } from "../components/AnalyticsScripts";
import { buildPageMetadata, siteMetadata } from "../lib/site-seo";
import "./styles.css";

const geistSans = Geist({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--op-font-sans",
  display: "swap"
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--op-font-mono",
  display: "swap"
});

export const metadata: Metadata = {
  ...buildPageMetadata("/"),
  title: {
    default: siteMetadata.title,
    template: `%s | ${siteMetadata.title}`
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AnalyticsScripts />
        {children}
      </body>
    </html>
  );
}
