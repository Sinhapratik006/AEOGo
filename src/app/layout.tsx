import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { appUrl } from "@/lib/env";
import "./globals.css";

// Self-hosted so builds don't depend on reaching fonts.googleapis.com.
const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: "AEOGo: Get your website cited by AI answer engines",
    template: "%s · AEOGo",
  },
  description:
    "AEOGo audits your website for ChatGPT, Perplexity, Claude and Google AI Overviews, writes the fixes with AI, and keeps monitoring your AEO score automatically.",
  applicationName: "AEOGo",
  openGraph: {
    type: "website",
    siteName: "AEOGo",
    title: "AEOGo: Get your website cited by AI answer engines",
    description:
      "Automated Answer Engine Optimization: AI crawler access, structured data, llms.txt and AI-written fixes, monitored continuously.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#030617",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
