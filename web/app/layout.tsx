import type { Metadata } from "next";
import { Anton, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getMeta } from "@/lib/data";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });
const jb = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb" });

export const metadata: Metadata = {
  title: "GAFFER — World Cup 2026 Forecast Engine",
  description:
    "A team-strength model for the 2026 FIFA World Cup: Elo ratings, a Dixon-Coles goal model and 50,000 Monte Carlo tournament simulations. Live title odds, advancement probabilities and group projections.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const meta = getMeta();
  return (
    <html lang="en" className={`${anton.variable} ${hanken.variable} ${jb.variable}`}>
      <body>
        <div className="atmosphere" />
        <Nav meta={meta} />
        <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-6">{children}</main>
        <Footer meta={meta} />
      </body>
    </html>
  );
}
