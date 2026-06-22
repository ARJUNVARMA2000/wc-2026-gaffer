import { getScorecard } from "@/lib/data";
import ScorecardView from "@/components/ScorecardView";
import Reveal from "@/components/Reveal";

export const metadata = { title: "vs Market — GAFFER" };

export default function AccuracyPage() {
  const sc = getScorecard();
  return (
    <div className="py-12 sm:py-16">
      <Reveal>
        <div className="eyebrow">GAFFER vs the market · Kalshi</div>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Were we right?</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Every group game, our pre-match odds set against Kalshi&apos;s pre-match price. Two
          scorelines: who forecast better (de-vigged Brier &amp; log-loss), and how a bankroll
          backing our disagreements into Kalshi&apos;s real, vig-inclusive prices would have done.
        </p>
      </Reveal>
      <div className="mt-10">
        <ScorecardView sc={sc} />
      </div>
    </div>
  );
}
