"use client";

import { motion } from "framer-motion";
import type { GroupRow } from "@/lib/data";
import { heatColor, pct } from "@/lib/ui";
import Flag from "./Flag";

export default function GroupsGrid({ groups }: { groups: Record<string, GroupRow[]> }) {
  const letters = Object.keys(groups).sort();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {letters.map((g, gi) => (
        <motion.div
          key={g}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: Math.min(gi * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
          className="panel group p-5 transition-transform hover:-translate-y-0.5"
        >
          <div className="mb-4 flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="display text-3xl text-[var(--color-text)]">Group {g}</span>
            </div>
            <span className="eyebrow">Qualify odds</span>
          </div>

          <div className="flex flex-col gap-2.5">
            {groups[g].map((t, i) => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="mono w-4 text-[0.65rem] text-[var(--color-faint)]">{i + 1}</span>
                <Flag iso={t.iso} name={t.name} size={22} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium">{t.name}</span>
                    <span className="mono text-[11px] text-[var(--color-muted)]">
                      {t.played > 0 ? `${t.points} pts` : `${t.xPts.toFixed(1)} xPts`}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 bartrack">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: heatColor(t.advance) }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${t.advance * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                    <span className="mono w-10 text-right text-[11px] tabular-nums text-[var(--color-text)]">
                      {pct(t.advance, 0)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t hairline pt-3">
            <span className="eyebrow">Win group</span>
            <span className="mono text-[11px] text-[var(--color-muted)]">
              {groups[g]
                .slice()
                .sort((a, b) => b.winGroup - a.winGroup)[0].name}{" "}
              {pct(groups[g].slice().sort((a, b) => b.winGroup - a.winGroup)[0].winGroup, 0)}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
