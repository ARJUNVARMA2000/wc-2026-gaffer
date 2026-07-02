import { getTeams } from "@/lib/data";
import StrengthView from "@/components/StrengthView";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Team Strength — GAFFER" };

export default function StrengthPage() {
  const teams = getTeams();
  return (
    <div className="py-12 sm:py-16">
      <PageHeader
        eyebrow="Ratings · Elo + goal model + squad value"
        title="Team strength"
        lede={
          <>
            <span className="text-[var(--color-text-primary)]">Elo</span> is overall strength from
            150 years of results, weighted by match importance and margin.{" "}
            <span className="text-[var(--color-text-primary)]">RR Pts</span> is the average points a
            team would take per game against the full 48-team field.{" "}
            <span className="text-[var(--color-text-primary)]">Squad €</span> is total Transfermarkt
            market value, blended into the projections (trusted more across confederations).{" "}
            <span className="text-[var(--color-text-primary)]">Attack</span> /{" "}
            <span className="text-[var(--color-text-primary)]">Defense</span> are goals for and
            against an average opponent;{" "}
            <span className="text-[var(--color-text-primary)]">Tilt</span> is the difference.
          </>
        }
      />
      <div className="mt-10">
        <StrengthView teams={teams} />
      </div>
    </div>
  );
}
