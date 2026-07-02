import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";
import LiveUpdater from "@/components/LiveUpdater";
import { getMeta, getTeams } from "@/lib/data";

// Inter with the optical-size axis: browsers apply font-optical-sizing and we
// get true display letterforms at headline sizes from one family.
const inter = Inter({ subsets: ["latin"], axes: ["opsz"], variable: "--font-inter" });
const jb = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb" });

const DESC =
  "A team-strength model for the 2026 FIFA World Cup: Elo ratings, a Dixon-Coles goal model and 50,000 Monte Carlo simulations. Live title odds, advancement probabilities and group projections.";

export const metadata: Metadata = {
  metadataBase: new URL("https://gaffer-wc26.web.app"),
  title: "GAFFER — World Cup 2026 Forecast Engine",
  description: DESC,
  openGraph: {
    title: "GAFFER — World Cup 2026 Forecast",
    description: DESC,
    url: "/",
    siteName: "GAFFER",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GAFFER — World Cup 2026 Forecast",
    description: DESC,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const meta = getMeta();
  const paletteTeams = getTeams().map((t) => ({ name: t.name, iso: t.iso }));
  return (
    <html lang="en" className={`${inter.variable} ${jb.variable}`}>
      <body>
        <div className="aurora" />
        <LiveUpdater meta={meta} />
        <Providers teams={paletteTeams}>
          <Nav meta={meta} />
          <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6">{children}</main>
          <Footer meta={meta} />
        </Providers>
      </body>
    </html>
  );
}
