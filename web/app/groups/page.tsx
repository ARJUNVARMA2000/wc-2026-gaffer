import { getGroups } from "@/lib/data";
import GroupsGrid from "@/components/GroupsGrid";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = { title: "Groups — GAFFER" };

export default function GroupsPage() {
  const groups = getGroups();
  return (
    <div className="py-12 sm:py-16">
      <PageHeader
        eyebrow="12 groups · top 2 + 8 best thirds advance"
        title="Group stage"
        lede="Live standings blended with the model's read on each remaining match. The bar is each team's probability of reaching the knockout rounds."
      />
      <div className="mt-10">
        <GroupsGrid groups={groups} />
      </div>
    </div>
  );
}
