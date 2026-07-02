import { getMatches } from "@/lib/data";
import MatchesView from "@/components/MatchesView";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Matches — GAFFER" };

export default function MatchesPage() {
  const matches = getMatches();
  return (
    <div className="py-12 sm:py-16">
      <PageHeader
        eyebrow="Group stage · 72 fixtures"
        title="Matches"
        lede="Final scores for games already played; model odds and projected scorelines for the rest. The bar splits home win · draw · away win."
      />
      <div className="mt-10">
        <MatchesView matches={matches} />
      </div>
    </div>
  );
}
