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
          The full projected knockout run, all the way to the trophy. Every tie shows each side&apos;s
          head-to-head win odds — the two add to 100% — and the favourite advances to fill the next
          round. Hover a projected R16/QF/SF slot to see the other teams that could land there. Built
          from {meta.nSims.toLocaleString()} simulations.
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
