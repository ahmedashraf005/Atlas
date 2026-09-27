import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import "@/styles/globals.css";

const sans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  display: "swap",
  subsets: ["latin"],
  variable: "--font-plex-sans",
});
const serif = IBM_Plex_Serif({
  weight: "500",
  display: "swap",
  subsets: ["latin"],
  variable: "--font-plex-serif",
});
const mono = IBM_Plex_Mono({
  weight: "400",
  display: "swap",
  subsets: ["latin"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: { default: "Atlas — Private shares, settled properly", template: "%s · Atlas" },
  description:
    "A marketplace for company-approved sales of existing shares in private UAE startups. Demo with fictional data.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = (await cookies()).get("atlas_theme")?.value === "dark" ? "dark" : "light";
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${sans.variable} ${serif.variable} ${mono.variable}`}
    >
      <body>
        {children}
        <Toaster position="bottom-right" theme={theme} />
      </body>
    </html>
  );
}
