import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, JetBrains_Mono } from "next/font/google";
import { SITE_URL } from "@/site";
import "./globals.css";

const geist = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-jetbrains", display: "swap" });
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Orderly · order emails in, draft orders out",
  description:
    "A working order-entry agent for a wholesaler's inbox. It reads order emails, checks every line, creates draft orders, and sends anything doubtful to a person with the reason. Measured on 40 held-out emails.",
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
