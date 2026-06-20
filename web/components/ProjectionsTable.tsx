"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Team } from "@/lib/data";
import { CONFED_COLOR, heatColor, heatText, pct } from "@/lib/ui";
import Flag from "./Flag";

type Key = "champion" | "final" | "sf" | "qf" | "r16" | "ko" | "elo" | "rr";

const COLS: { key: Key; label: string; short: string; heat?: boolean }[] = [
  { key: "champion", label: "Win Cup", short: "WIN" },
  { key: "final", label: "Final", short: "FIN", heat: true },
  { key: "sf", label: "Semis", short: "SF", heat: true },
  { key: "qf", label: "Quarters", short: "QF", heat: true },
  { key: "r16", label: "Last 16", short: "R16", heat: true },
  { key: "ko", label: "Knockouts", short: "KO", heat: true },
];

export default function ProjectionsTable({ teams }: { teams: Team[] }) {
  const [sort, setSort] = useState<Key>("champion");
  const [confed, setConfed] = useState<string>("ALL");

  const confeds = useMemo(
    () => ["ALL", ...Array.from(new Set(teams.map((t) => t.confederation)))],
    [teams]
  );

  const rows = useMemo(() => {
    const filtered = confed === "ALL" ? teams : teams.filter((t) => t.confederation === confed);
    return [...filtered].sort((a, b) => (b[sort] as number) - (a[sort] as number));
  }, [teams, sort, confed]);

  const maxChamp = Math.max(...teams.map((t) => t.champion));

  return (
    <div>
      {/* confederation filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {confeds.map((c) => (
          <button
            key={c}
            onClick={() => setConfed(c)}
            className="chip transition-colors"
            style={{
              color: confed === c ? "#07090d" : "var(--color-muted)",
              background: confed === c ? (CONFED_COLOR[c] ?? "var(--color-lime)") : "transparent",
              borderColor: confed === c ? "transparent" : "var(--color-line)",
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b hairline text-left">
              <th className="px-3 py-3 eyebrow font-normal">#</th>
              <th className="px-3 py-3 eyebrow font-normal">Team</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-2 py-3 text-right">
                  <button
                    onClick={() => setSort(c.key)}
                    className="eyebrow font-normal transition-colors hover:text-[var(--color-text)]"
                    style={{ color: sort === c.key ? "var(--color-lime)" : undefined }}
                  >
                    {c.short}
                    {sort === c.key ? " ↓" : ""}
                  </button>
                </th>
              ))}
              <th className="hidden px-3 py-3 text-right sm:table-cell">
                <button
                  onClick={() => setSort("elo")}
                  className="eyebrow font-normal transition-colors hover:text-[var(--color-text)]"
                  style={{ color: sort === "elo" ? "var(--color-lime)" : undefined }}
                >
                  ELO{sort === "elo" ? " ↓" : ""}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <motion.tr
                key={t.name}
                layout
                transition={{ type: "spring", stiffness: 520, damping: 42 }}
                className="row-glow border-b border-white/5"
              >
                <td className="px-3 py-2.5 mono text-sm text-[var(--color-faint)]">
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Flag iso={t.iso} name={t.name} size={26} />
                    <div className="flex flex-col">
                      <span className="flex items-center gap-2 text-sm font-semibold leading-tight">
                        {t.name}
                        {t.host && (
                          <span className="chip" style={{ color: "var(--color-lime)", borderColor: "var(--color-lime)" }}>
                            host
                          </span>
                        )}
                      </span>
                      <span
                        className="mono text-[0.6rem] uppercase tracking-wider"
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
                    <div className="hidden h-1.5 w-16 bartrack md:block">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: i < 3 ? "var(--color-gold)" : "var(--color-lime)" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(t.champion / maxChamp) * 100}%` }}
                        transition={{ duration: 0.8, delay: Math.min(i * 0.012, 0.3), ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                    <span
                      className="mono w-12 text-right text-sm font-semibold tabular-nums"
                      style={{ color: i < 3 ? "var(--color-gold)" : "var(--color-text)" }}
                    >
                      {pct(t.champion)}
                    </span>
                  </div>
                </td>

                {/* heatmap cells */}
                {COLS.slice(1).map((c) => {
                  const v = t[c.key] as number;
                  return (
                    <td key={c.key} className="px-1.5 py-2.5 text-right">
                      <span
                        className="mono inline-block w-full min-w-[44px] rounded-md py-1 text-center text-xs tabular-nums"
                        style={{ background: `${heatColor(v)}22`, color: heatText(v) === "#07090d" ? heatColor(v) : "var(--color-text)" }}
                      >
                        {pct(v, 0)}
                      </span>
                    </td>
                  );
                })}

                <td className="hidden px-3 py-2.5 text-right sm:table-cell">
                  <span className="mono text-sm text-[var(--color-muted)]">{Math.round(t.elo)}</span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 mono text-[0.62rem] text-[var(--color-faint)]">
        Cells show probability of reaching each stage · sort by any column · {rows.length} teams
      </p>
    </div>
  );
}
