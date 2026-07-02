"use client";
import { motion } from "framer-motion";
import { DUR } from "@/lib/motion";

/** Sortable column-header button. The chevron is always rendered (opacity 0
 *  when inactive) so toggling sort never shifts layout. Wrap in
 *  <th scope="col" aria-sort={active ? "descending" : "none"}>. */
export default function SortButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string; // accessible name, e.g. "Sort by Elo"
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`eyebrow inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-[var(--color-text-primary)] ${
        active ? "!text-[var(--color-accent)]" : ""
      }`}
    >
      {children}
      <motion.svg
        width="8"
        height="8"
        viewBox="0 0 8 8"
        aria-hidden
        animate={{ opacity: active ? 1 : 0, y: active ? 0 : -2 }}
        transition={{ duration: DUR.fast }}
        className="shrink-0"
      >
        <path d="M4 6L1 2h6L4 6z" fill="currentColor" />
      </motion.svg>
    </button>
  );
}
