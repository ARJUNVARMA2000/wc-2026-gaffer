"use client";
import { useSyncExternalStore } from "react";
import type { Meta } from "@/lib/types";
import { useLiveData, useLiveStatus } from "@/lib/live";
import { timeAgo } from "@/lib/ui";

// 30s clock as an external store: re-renders every half minute so the
// relative time ticks; server snapshot is null so the build-time HTML never
// bakes a clock-dependent string (that was a hydration mismatch).
const tick30s = (cb: () => void) => {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
};
const useClock = () =>
  useSyncExternalStore(
    tick30s,
    () => Math.floor(Date.now() / 30_000),
    () => null,
  );

const DOT: Record<string, string> = {
  idle: "var(--color-accent)",
  live: "var(--color-accent)",
  updating: "var(--color-warning)",
  error: "var(--color-text-tertiary)",
};

/** Nav pill: "Live · Xm ago" that ticks, recolors by poll status, and
 *  announces data swaps to screen readers exactly once per swap.
 *  timeAgo is mount-gated: the build-time string can never match the
 *  client's clock, so rendering it during hydration was a mismatch. */
export default function LiveStatus({ initialMeta }: { initialMeta: Meta }) {
  const meta = useLiveData("meta", initialMeta);
  const { status, updatedAt } = useLiveStatus();
  const now = useClock();

  return (
    <div className="hidden items-center gap-2 rounded-full border hairline px-3 py-1.5 sm:flex">
      <span
        className={status === "error" ? "h-1.5 w-1.5 rounded-full" : "live-dot h-1.5 w-1.5 rounded-full"}
        style={{ background: DOT[status] ?? DOT.live }}
      />
      <span className="mono text-2xs uppercase tracking-wider text-[var(--color-text-secondary)]">
        {status === "updating" ? "Updating…" : `Live · ${now === null ? "—" : timeAgo(meta.lastUpdated)}`}
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {updatedAt ? `Forecast updated, data through ${meta.dataThrough}` : ""}
      </span>
    </div>
  );
}
