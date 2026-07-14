import { getScorecard } from "@/lib/data";
import ScorecardView from "@/components/ScorecardView";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "vs Market — GAFFER" };

export default function AccuracyPage() {
  const sc = getScorecard();
  return (
    <div className="py-12 sm:py-16">
      <PageHeader
        eyebrow="GAFFER vs the market · Kalshi"
        title="Were we right?"
        lede="Every match — group and knockout — our pre-match odds set against Kalshi's pre-match price. Two scorelines: who forecast better (de-vigged Brier & log-loss), and how a bankroll backing our disagreements into Kalshi's real, vig-inclusive prices would have done."
      />
      <div className="mt-10">
        <ScorecardView sc={sc} />
      </div>
    </div>
  );
}
