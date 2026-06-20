import { getGroups } from "@/lib/data";
import GroupsGrid from "@/components/GroupsGrid";
import Reveal from "@/components/Reveal";

export const metadata = { title: "Groups — GAFFER" };

export default function GroupsPage() {
  const groups = getGroups();
  return (
    <div className="py-12 sm:py-16">
      <Reveal>
        <div className="eyebrow">12 groups · top 2 + 8 best thirds advance</div>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Group stage</h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Live standings blended with the model&apos;s read on each remaining match. The bar is
          each team&apos;s probability of reaching the knockout rounds.
        </p>
      </Reveal>
      <div className="mt-10">
        <GroupsGrid groups={groups} />
      </div>
    </div>
  );
}
