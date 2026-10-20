import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { SITE_URL } from "@/site";
import "./globals.css";

// No metric-adjusted local() fallbacks (they can draw wrong glyphs); fall back to deliberate system faces.
const sans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});
const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Orderly: order emails turned into checked draft orders",
  description:
    "An order-entry system for a wholesaler's inbox. It reads order emails, checks every line, creates draft orders, and sends anything doubtful to a person with the reason. Model output is replayed from recorded samples; the lookups, checks, routing and masking are the real code.",
  openGraph: {
    title: "Orderly: order emails turned into checked draft orders",
    description: "Every value points to the words it came from. Anything doubtful goes to a person, with the reason.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#f4f2ec" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
