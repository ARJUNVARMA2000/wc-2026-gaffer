import { getBracket, getMeta, getTeams } from "@/lib/data";
import BracketTree from "@/components/BracketTree";
import BracketFunnel from "@/components/BracketFunnel";
import Reveal from "@/components/Reveal";

export const metadata = { title: "Bracket — GAFFER" };

export default function BracketPage() {
  const bracket = getBracket();
  const teams = getTeams();
  const meta = getMeta();
  return (
    <div className="py-12 sm:py-16">
      <Reveal>
        <div className="eyebrow">The most likely road to the trophy</div>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Bracket</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          The projected Round-of-32 knockout bracket — each slot filled with the team most likely to
          land there across {meta.nSims.toLocaleString()} simulations, seeded by strength and tagged
          with its title odds.
        </p>
      </Reveal>

      <div className="mt-10">
        <BracketTree bracket={bracket} />
      </div>

      <section className="mt-20">
        <Reveal>
          <div className="eyebrow">Round-by-round survival</div>
          <h2 className="display mt-2 text-3xl">Advancement funnel</h2>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--color-muted)]">
            Every team&apos;s chance of reaching each stage, narrowing toward the champion.
          </p>
        </Reveal>
        <div className="mt-8">
          <BracketFunnel teams={teams} nSims={meta.nSims} />
        </div>
      </section>
    </div>
  );
}
