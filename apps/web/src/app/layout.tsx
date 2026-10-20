import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, JetBrains_Mono } from "next/font/google";
import { SITE_URL } from "@/site";
import "./globals.css";

// No metric-adjusted local() fallbacks (they can draw wrong glyphs); fall back to deliberate system faces.
const geist = Geist({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
});
const mono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
});
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT"],
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Georgia", "serif"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Orderly · order emails in, draft orders out",
  description:
    "An order-entry system for a wholesaler's inbox. It reads order emails, checks every line, creates draft orders, and sends anything doubtful to a person with the reason. Model output is replayed from recorded samples; the lookups, checks, routing and masking are the real code.",
  openGraph: {
    title: "Orderly · order emails in, draft orders out",
    description: "Every value points to the words it came from. Anything doubtful goes to a person, with the reason.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#0b1220" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
