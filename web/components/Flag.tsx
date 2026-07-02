import { flagUrl } from "@/lib/ui";

export default function Flag({
  iso,
  name,
  size = 28,
  decorative = false,
}: {
  iso: string;
  name: string;
  size?: number;
  /** true when the team name is adjacent visible text — hides the img from
   *  screen readers to avoid "France France" double announcements. */
  decorative?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagUrl(iso, 80)}
      alt={decorative ? "" : name}
      aria-hidden={decorative || undefined}
      width={size}
      height={Math.round((size * 3) / 4)}
      loading="lazy"
      className="inline-block shrink-0 rounded-[var(--radius-xs)] object-cover ring-1 ring-[var(--color-border)]"
      style={{ width: size, height: Math.round((size * 3) / 4) }}
    />
  );
}
