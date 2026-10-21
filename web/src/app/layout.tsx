import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { appUrl } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  themeColor: "#4f46e5",
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
