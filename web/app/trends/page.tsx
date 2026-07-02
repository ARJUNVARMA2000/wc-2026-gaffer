import { getHistory, getRatingsHistory, getTeams } from "@/lib/data";
import TrendsView from "@/components/TrendsView";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Trends — GAFFER" };

export default function TrendsPage() {
  const teams = getTeams();
  const history = getHistory();
  const ratings = getRatingsHistory();
  return (
    <div className="py-12 sm:py-16">
      <PageHeader
        eyebrow="How the forecast moves"
        title="Trends"
        lede="Pick a team to watch its title and advancement odds shift through the tournament, plus its Elo rating back to 2019. Build your own title race, and see who's climbing or sliding."
      />
      <div className="mt-10">
        <TrendsView teams={teams} history={history} ratings={ratings} />
      </div>
    </div>
  );
}
