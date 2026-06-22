import { getPaths } from "@/lib/data";
import PathsView from "@/components/PathsView";
import Reveal from "@/components/Reveal";

export const metadata = { title: "Paths — GAFFER" };

export default function PathsPage() {
  const paths = getPaths();
  return (
    <div className="py-12 sm:py-16">
      <Reveal>
        <div className="eyebrow">Who you draw, and how hard it is</div>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Paths</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          The model plays the real bracket every simulation, so it knows who each team is likely to
          meet. Pick a team to trace its road to the final, and see who got the kindest — and
          cruelest — draw.
        </p>
      </Reveal>
      <div className="mt-10">
        <PathsView paths={paths} />
      </div>
    </div>
  );
}
