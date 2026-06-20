import { flagUrl } from "@/lib/ui";

export default function Flag({
  iso,
  name,
  size = 28,
}: {
  iso: string;
  name: string;
  size?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagUrl(iso, 80)}
      alt={name}
      width={size}
      height={Math.round((size * 3) / 4)}
      loading="lazy"
      className="inline-block shrink-0 rounded-[3px] object-cover ring-1 ring-white/10"
      style={{ width: size, height: Math.round((size * 3) / 4) }}
    />
  );
}
