import { getMeta, getTeams } from "@/lib/data";
import ProjectionsTable from "@/components/ProjectionsTable";
import HomeHero from "@/components/HomeHero";
import FavoriteSpotlight from "@/components/FavoriteSpotlight";
import { SectionHeader } from "@/components/ui/PageHeader";

export default function Home() {
  const teams = getTeams();
  const meta = getMeta();

  return (
    <div className="py-12 sm:py-16">
      {/* HERO */}
      <section className="grid grid-cols-1 gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <HomeHero meta={meta} />
        <FavoriteSpotlight teams={teams} />
      </section>

      {/* PROJECTIONS */}
      <section className="mt-20">
        <div className="mb-6">
          <SectionHeader eyebrow="The full board" title="Title & advancement odds" />
        </div>
        <ProjectionsTable teams={teams} />
      </section>
    </div>
  );
}
