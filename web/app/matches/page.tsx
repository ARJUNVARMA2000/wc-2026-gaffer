import { getMatches, getMeta } from "@/lib/data";
import MatchesView from "@/components/MatchesView";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Matches — GAFFER" };

const STAGE_EYEBROW: Record<string, string> = {
  GROUP: "Group stage",
  R32: "Knockouts · Round of 32",
  R16: "Knockouts · Round of 16",
  QF: "Knockouts · Quarter-finals",
  SF: "Knockouts · Semi-finals",
  FINAL: "The Final",
  DONE: "Tournament complete",
};

export default function MatchesPage() {
  const matches = getMatches();
  const meta = getMeta();
  return (
    <div className="py-12 sm:py-16">
      <PageHeader
        eyebrow={`${STAGE_EYEBROW[meta.stage ?? "GROUP"]} · ${matches.length} fixtures`}
        title="Matches"
        lede="Final scores for games already played (knockout scores include extra time); model odds and projected scorelines for the rest. The bar splits home win · draw · away win."
      />
      <div className="mt-10">
        <MatchesView matches={matches} />
      </div>
    </div>
  );
}
