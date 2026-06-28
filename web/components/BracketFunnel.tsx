"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Team } from "@/lib/data";
import { CONFED_COLOR, heatColor, heatText, pct } from "@/lib/ui";
import Flag from "./Flag";

// Each round maps to its reach-probability field on Team. `ko` = reach the
// knockouts (Round of 32). Caps shrink down the rounds to keep a funnel shape.
const ROUNDS: { key: keyof Team; label: string; short: string; cap: number }[] = [
  { key: "ko", label: "Round of 32", short: "R32", cap: 28 },
  { key: "r16", label: "Round of 16", short: "R16", cap: 18 },
  { key: "qf", label: "Quarter-finals", short: "QF", cap: 12 },
  { key: "sf", label: "Semi-finals", short: "SF", cap: 8 },
  { key: "final", label: "Final", short: "FINAL", cap: 6 },
  { key: "champion", label: "Champion", short: "CHAMP", cap: 6 },
];

const MIN_PROB = 0.002; // hide teams with a negligible chance of reaching a round

export default function BracketFunnel({ teams, nSims }: { teams: Team[]; nSims: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const [confed, setConfed] = useState("ALL");

  const confeds = useMemo(
    () => ["ALL", ...Array.from(new Set(teams.map((t) => t.confederation)))],
    [teams]
  );

  const columns = useMemo(() => {
    const pool = confed === "ALL" ? teams : teams.filter((t) => t.confederation === confed);
    return ROUNDS.map((r) => {
      const ranked = [...pool]
        .filter((t) => (t[r.key] as number) >= MIN_PROB)
        .sort((a, b) => (b[r.key] as number) - (a[r.key] as number))
        .slice(0, r.cap);
      return { ...r, teams: ranked };
    });
  }, [teams, confed]);

  return (
    <div>
      {/* confederation filter — mirrors the rest of the site */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
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

      <div className="panel overflow-x-auto p-3 sm:p-4">
        <div className="flex min-w-[920px] gap-3">
          {columns.map((col, ci) => (
            <div key={col.short} className="flex-1">
              <div className="mb-3 flex items-baseline justify-between border-b hairline pb-2">
                <span className="eyebrow">{col.short}</span>
                <span className="mono text-[0.6rem] text-[var(--color-faint)]">{col.teams.length}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {col.teams.map((t, ti) => {
                  const v = t[col.key] as number;
                  const isHover = hover === t.name;
                  const dim = hover !== null && !isHover;
                  return (
                    <motion.div
                      key={t.name}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: dim ? 0.28 : 1, y: 0 }}
                      transition={{ duration: 0.35, delay: Math.min(ci * 0.04 + ti * 0.008, 0.5), ease: [0.16, 1, 0.3, 1] }}
                      onMouseEnter={() => setHover(t.name)}
                      onMouseLeave={() => setHover(null)}
                      className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors"
                      style={{
                        background: isHover ? "rgba(255,255,255,0.06)" : "transparent",
                        boxShadow: isHover ? "inset 0 0 0 1px var(--color-lime)" : "none",
                      }}
                    >
                      <Flag iso={t.iso} name={t.name} size={18} />
                      <span className="flex-1 truncate text-[12.5px] leading-tight">{t.name}</span>
                      <span
                        className="mono w-[42px] shrink-0 rounded text-center text-[0.62rem] tabular-nums"
                        style={{
                          background: `${heatColor(v)}22`,
                          color: heatText(v) === "#07090d" ? heatColor(v) : "var(--color-text)",
                          padding: "2px 0",
                        }}
                      >
                        {pct(v, 0)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 mono text-[0.62rem] text-[var(--color-faint)]">
        Each column: probability of reaching that round, across {nSims.toLocaleString()} simulations.
        Hover a team to trace it through the bracket. Teams below 0.2% in a round are hidden.
      </p>
    </div>
  );
}
