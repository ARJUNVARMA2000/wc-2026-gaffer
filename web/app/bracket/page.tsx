import { getMeta, getTeams } from "@/lib/data";
import BracketFunnel from "@/components/BracketFunnel";
import Reveal from "@/components/Reveal";

export const metadata = { title: "Bracket — GAFFER" };

export default function BracketPage() {
  const teams = getTeams();
  const meta = getMeta();
  return (
    <div className="py-12 sm:py-16">
      <Reveal>
        <div className="eyebrow">How far each team is expected to go</div>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Bracket</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          The tournament funnel — every round from the Round of 32 to the trophy, with each team&apos;s
          chance of getting there. As the simulations thin the field out, the columns narrow toward
          the champion.
        </p>
      </Reveal>
      <div className="mt-10">
        <BracketFunnel teams={teams} nSims={meta.nSims} />
      </div>
    </div>
  );
}
