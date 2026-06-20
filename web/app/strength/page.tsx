import { getTeams } from "@/lib/data";
import StrengthView from "@/components/StrengthView";
import Reveal from "@/components/Reveal";

export const metadata = { title: "Team Strength — GAFFER" };

export default function StrengthPage() {
  const teams = getTeams();
  return (
    <div className="py-12 sm:py-16">
      <Reveal>
        <div className="eyebrow">Ratings · Elo + goal model + squad value</div>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Team strength</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          <span className="text-[var(--color-text)]">Elo</span> is overall strength from 150 years of
          results, weighted by match importance and margin.{" "}
          <span className="text-[var(--color-text)]">RR Pts</span> is the average points a team would
          take per game against the full 48-team field. <span className="text-[var(--color-text)]">Squad €</span>{" "}
          is total Transfermarkt market value, blended into the projections (trusted more across
          confederations). <span className="text-[var(--color-text)]">Attack</span> /{" "}
          <span className="text-[var(--color-text)]">Defense</span> are goals for and against an average
          opponent; <span className="text-[var(--color-text)]">Tilt</span> is the difference.
        </p>
      </Reveal>
      <div className="mt-10">
        <StrengthView teams={teams} />
      </div>
    </div>
  );
}
