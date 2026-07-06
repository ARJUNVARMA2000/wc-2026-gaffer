import { getBracket, getMeta, getTeams } from "@/lib/data";
import BracketTree from "@/components/BracketTree";
import BracketFunnel from "@/components/BracketFunnel";
import PageHeader, { SectionHeader } from "@/components/ui/PageHeader";

export const metadata = { title: "Bracket — GAFFER" };

export default function BracketPage() {
  const bracket = getBracket();
  const teams = getTeams();
  const meta = getMeta();
  return (
    <div className="py-12 sm:py-16">
      <PageHeader
        eyebrow="The most likely road to the trophy"
        title="Bracket"
        lede={
          <>
            The knockout bracket as it stands: decided ties show the real score and winner; open
            ties show each side&apos;s head-to-head win odds — the two add to 100% — with the
            favourite advancing to fill the next round. Hover a projected slot to see the other
            teams that could land there. Built from {meta.nSims.toLocaleString("en-US")}{" "}
            simulations.
          </>
        }
      />

      <div className="mt-10">
        <BracketTree bracket={bracket} />
      </div>

      <section className="mt-20">
        <SectionHeader
          eyebrow="Round-by-round survival"
          title="Advancement funnel"
          lede="Every team's chance of reaching each stage, narrowing toward the champion."
        />
        <div className="mt-8">
          <BracketFunnel teams={teams} nSims={meta.nSims} />
        </div>
      </section>
    </div>
  );
}
