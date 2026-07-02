"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Team } from "@/lib/data";
import { useLiveData } from "@/lib/live";
import { CONFED_COLOR, pct } from "@/lib/ui";
import { DUR, SPRING, fadeRise, staggerChildren } from "@/lib/motion";
import Bar from "./ui/Bar";
import Chip from "./ui/Chip";
import Footnote from "./ui/Footnote";
import HeatPill from "./ui/HeatPill";
import SortButton from "./ui/SortButton";
import Flag from "./Flag";

type Key = "champion" | "final" | "sf" | "qf" | "r16" | "ko" | "elo";

const COLS: { key: Key; label: string; short: string }[] = [
  { key: "champion", label: "Win Cup", short: "WIN" },
  { key: "final", label: "Final", short: "FIN" },
  { key: "sf", label: "Semis", short: "SF" },
  { key: "qf", label: "Quarters", short: "QF" },
  { key: "r16", label: "Last 16", short: "R16" },
  { key: "ko", label: "Knockouts", short: "KO" },
];

export default function ProjectionsTable({ teams: initial }: { teams: Team[] }) {
  const teams = useLiveData("teams", initial);
  const [sort, setSort] = useState<Key>("champion");
  const [confed, setConfed] = useState<string>("ALL");

  const confeds = useMemo(
    () => ["ALL", ...Array.from(new Set(teams.map((t) => t.confederation)))],
    [teams]
  );

  const rows = useMemo(() => {
    const filtered = confed === "ALL" ? teams : teams.filter((t) => t.confederation === confed);
    return [...filtered].sort((a, b) => b[sort] - a[sort]);
  }, [teams, sort, confed]);

  const maxChamp = Math.max(...teams.map((t) => t.champion));
  // Entrance stagger scaled so the full cascade lands inside ~0.35s.
  const stagger = Math.min(0.03, 0.35 / Math.max(rows.length, 1));

  return (
    <div>
      {/* confederation filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {confeds.map((c) => (
          <Chip
            key={c}
            active={confed === c}
            onClick={() => setConfed(c)}
            color={c === "ALL" ? "var(--color-accent)" : CONFED_COLOR[c]}
          >
            {c}
          </Chip>
        ))}
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b hairline text-left">
              <th scope="col" className="eyebrow px-3 py-3 font-normal">
                #
              </th>
              <th scope="col" className="eyebrow px-3 py-3 font-normal">
                Team
              </th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={sort === c.key ? "descending" : "none"}
                  className="px-2 py-3 text-right font-normal"
                >
                  <SortButton
                    active={sort === c.key}
                    onClick={() => setSort(c.key)}
                    label={`Sort by ${c.label}`}
                  >
                    {c.short}
                  </SortButton>
                </th>
              ))}
              <th
                scope="col"
                aria-sort={sort === "elo" ? "descending" : "none"}
                className="hidden px-3 py-3 text-right font-normal sm:table-cell"
              >
                <SortButton
                  active={sort === "elo"}
                  onClick={() => setSort("elo")}
                  label="Sort by Elo rating"
                >
                  ELO
                </SortButton>
              </th>
            </tr>
          </thead>
          <motion.tbody
            variants={staggerChildren(stagger)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {rows.map((t, i) => (
                <motion.tr
                  key={t.name}
                  layout
                  variants={fadeRise}
                  exit={{ opacity: 0, transition: { duration: DUR.fast } }}
                  transition={SPRING.snappy}
                  className="row-glow border-b hairline"
                >
                  <td
                    className="mono px-3 py-2.5 text-sm"
                    style={{
                      color: i < 3 ? "var(--color-warning)" : "var(--color-text-tertiary)",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <Flag iso={t.iso} name={t.name} size={26} decorative />
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2 text-sm font-semibold leading-tight">
                          {t.name}
                          {t.host && (
                            <span
                              className="chip"
                              style={{
                                color: "var(--color-accent)",
                                borderColor: "var(--color-accent-muted)",
                              }}
                            >
                              host
                            </span>
                          )}
                        </span>
                        <span
                          className="mono text-2xs uppercase tracking-wider"
                          style={{ color: CONFED_COLOR[t.confederation] }}
                        >
                          {t.confederation} · Grp {t.group}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Win the cup — bar + value */}
                  <td className="px-2 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden w-16 md:block">
                        <Bar
                          value={maxChamp > 0 ? t.champion / maxChamp : 0}
                          color={i < 3 ? "var(--color-warning)" : "var(--color-accent)"}
                        />
                      </div>
                      <span
                        className="mono w-12 text-right text-sm font-semibold tabular-nums"
                        style={{
                          color: i < 3 ? "var(--color-warning)" : "var(--color-text-primary)",
                        }}
                      >
                        {pct(t.champion)}
                      </span>
                    </div>
                  </td>

                  {/* heatmap cells */}
                  {COLS.slice(1).map((c) => (
                    <td key={c.key} className="px-1.5 py-2.5 text-right">
                      <HeatPill p={t[c.key]} digits={0} className="w-full" />
                    </td>
                  ))}

                  <td className="hidden px-3 py-2.5 text-right sm:table-cell">
                    <span className="mono text-sm text-[var(--color-text-secondary)]">
                      {Math.round(t.elo)}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </motion.tbody>
        </table>
      </div>
      <Footnote>
        Cells show probability of reaching each stage · sort by any column · {rows.length} teams
      </Footnote>
    </div>
  );
}
