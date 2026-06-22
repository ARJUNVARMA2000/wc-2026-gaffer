import { getHistory, getRatingsHistory, getTeams } from "@/lib/data";
import TrendsView from "@/components/TrendsView";
import Reveal from "@/components/Reveal";

export const metadata = { title: "Trends — GAFFER" };

export default function TrendsPage() {
  const teams = getTeams();
  const history = getHistory();
  const ratings = getRatingsHistory();
  return (
    <div className="py-12 sm:py-16">
      <Reveal>
        <div className="eyebrow">How the forecast moves</div>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Trends</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Pick a team to watch its title and advancement odds shift through the tournament, plus its
          Elo rating back to 2019. Build your own title race, and see who&apos;s climbing or sliding.
        </p>
      </Reveal>
      <div className="mt-10">
        <TrendsView teams={teams} history={history} ratings={ratings} />
      </div>
    </div>
  );
}
