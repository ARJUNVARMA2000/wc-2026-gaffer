import { Suspense } from "react";
import { getModelParams, getTeams } from "@/lib/data";
import HeadToHead from "@/components/HeadToHead";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Matchup — GAFFER" };

export default function H2HPage() {
  const params = getModelParams();
  const teams = getTeams();
  return (
    <div className="py-12 sm:py-16">
      <PageHeader
        eyebrow="Any two teams, on demand"
        title="Matchup"
        lede="Pick any two of the 48 teams and the model plays the game: win / draw / win odds, the most likely score, and the full scoreline grid. Computed live in your browser from the same Dixon-Coles model that drives the projections."
      />
      <div className="mt-10">
        {/* HeadToHead reads ?a= via useSearchParams — Suspense keeps the static export prerenderable. */}
        <Suspense fallback={<div className="min-h-[640px]" aria-hidden />}>
          <HeadToHead params={params} teams={teams} />
        </Suspense>
      </div>
    </div>
  );
}
