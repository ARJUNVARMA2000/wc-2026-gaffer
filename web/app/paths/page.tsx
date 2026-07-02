import { getPaths } from "@/lib/data";
import PathsView from "@/components/PathsView";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Paths — GAFFER" };

export default function PathsPage() {
  const paths = getPaths();
  return (
    <div className="py-12 sm:py-16">
      <PageHeader
        eyebrow="Who you draw, and how hard it is"
        title="Paths"
        lede="The model plays the real bracket every simulation, so it knows who each team is likely to meet. Pick a team to trace its road to the final, and see who got the kindest — and cruelest — draw."
      />
      <div className="mt-10">
        <PathsView paths={paths} />
      </div>
    </div>
  );
}
