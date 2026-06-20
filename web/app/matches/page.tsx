import { getMatches } from "@/lib/data";
import MatchesView from "@/components/MatchesView";
import Reveal from "@/components/Reveal";

export const metadata = { title: "Matches — GAFFER" };

export default function MatchesPage() {
  const matches = getMatches();
  return (
    <div className="py-12 sm:py-16">
      <Reveal>
        <div className="eyebrow">Group stage · 72 fixtures</div>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Matches</h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Final scores for games already played; model odds and projected scorelines for the rest.
          The bar splits home win · draw · away win.
        </p>
      </Reveal>
      <div className="mt-10">
        <MatchesView matches={matches} />
      </div>
    </div>
  );
}
