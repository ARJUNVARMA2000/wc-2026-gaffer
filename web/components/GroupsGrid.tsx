"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { GroupRow } from "@/lib/types";
import { useLiveData } from "@/lib/live";
import { EASE_OUT, DUR, SPRING, fadeRise, staggerChildren } from "@/lib/motion";
import { heat, pct } from "@/lib/ui";
import Bar from "./ui/Bar";
import HeatPill from "./ui/HeatPill";
import Flag from "./Flag";

export default function GroupsGrid({ groups: initial }: { groups: Record<string, GroupRow[]> }) {
  const groups = useLiveData("groups", initial);

  const letters = useMemo(() => Object.keys(groups).sort(), [groups]);

  // Most-likely group winner, computed once per group (single pass, no sorts).
  const winners = useMemo(() => {
    const out: Record<string, GroupRow | undefined> = {};
    for (const [g, rows] of Object.entries(groups)) {
      out[g] = rows.reduce<GroupRow | undefined>(
        (best, t) => (best === undefined || t.winGroup > best.winGroup ? t : best),
        undefined,
      );
    }
    return out;
  }, [groups]);

  return (
    <motion.div
      variants={staggerChildren(0.05)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {letters.map((g) => {
        const winner = winners[g];
        return (
          <motion.div
            key={g}
            variants={fadeRise}
            whileHover={{ y: -2, boxShadow: "var(--shadow-raised)" }}
            transition={{ duration: DUR.fast, ease: EASE_OUT }}
            className="panel p-5"
          >
            <div className="mb-4 flex items-baseline justify-between">
              <span className="display text-3xl text-[var(--color-text-primary)]">Group {g}</span>
              <span className="eyebrow">Qualify odds</span>
            </div>

            <div className="flex flex-col gap-2.5">
              {groups[g].map((t, i) => (
                <motion.div
                  key={t.name}
                  layout
                  transition={SPRING.snappy}
                  className="flex items-center gap-3"
                >
                  <span className="mono w-4 text-2xs text-[var(--color-text-tertiary)]">
                    {i + 1}
                  </span>
                  <Flag iso={t.iso} name={t.name} size={22} decorative />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                        {t.name}
                      </span>
                      <span className="mono text-2xs text-[var(--color-text-secondary)]">
                        {t.played > 0 ? `${t.points} pts` : `${t.xPts.toFixed(1)} xPts`}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Bar value={t.advance} color={heat(t.advance)} className="flex-1" />
                      <HeatPill p={t.advance} digits={0} className="shrink-0" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {winner && (
              <div className="mt-4 flex items-center justify-between border-t hairline pt-3">
                <span className="eyebrow">Win group</span>
                <span className="mono text-2xs text-[var(--color-text-secondary)]">
                  {winner.name} {pct(winner.winGroup, 0)}
                </span>
              </div>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
