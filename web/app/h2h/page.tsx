import { getModelParams, getTeams } from "@/lib/data";
import HeadToHead from "@/components/HeadToHead";
import Reveal from "@/components/Reveal";

export const metadata = { title: "Matchup — GAFFER" };

export default function H2HPage() {
  const params = getModelParams();
  const teams = getTeams();
  return (
    <div className="py-12 sm:py-16">
      <Reveal>
        <div className="eyebrow">Any two teams, on demand</div>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Matchup</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Pick any two of the 48 teams and the model plays the game: win / draw / win odds, the most
          likely score, and the full scoreline grid. Computed live in your browser from the same
          Dixon-Coles model that drives the projections.
        </p>
      </Reveal>
      <div className="mt-10">
        <HeadToHead params={params} teams={teams} />
      </div>
    </div>
  );
}
