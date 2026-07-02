"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Team } from "@/lib/types";
import { useLiveData } from "@/lib/live";
import { DUR, SPRING, fadeRise, staggerChildren } from "@/lib/motion";
import { CONFED_COLOR, pct } from "@/lib/ui";
import Chip from "./ui/Chip";
import HeatPill from "./ui/HeatPill";
import Footnote from "./ui/Footnote";
import Flag from "./Flag";

// Each round maps to its reach-probability field on Team. `ko` = reach the
// knockouts (Round of 32). Caps shrink down the rounds to keep a funnel shape.
// `aria` completes the phrase "<team> — <odds> to ...".
const ROUNDS: { key: keyof Team; label: string; short: string; cap: number; aria: string }[] = [
  { key: "ko", label: "Round of 32", short: "R32", cap: 28, aria: "reach the round of 32" },
  { key: "r16", label: "Round of 16", short: "R16", cap: 18, aria: "reach the round of 16" },
  { key: "qf", label: "Quarter-finals", short: "QF", cap: 12, aria: "reach the quarter-finals" },
  { key: "sf", label: "Semi-finals", short: "SF", cap: 8, aria: "reach the semi-finals" },
  { key: "final", label: "Final", short: "FINAL", cap: 6, aria: "reach the final" },
  { key: "champion", label: "Champion", short: "CHAMP", cap: 6, aria: "win the title" },
];

const MIN_PROB = 0.002; // hide teams with a negligible chance of reaching a round

export default function BracketFunnel({ teams: initial, nSims }: { teams: Team[]; nSims: number }) {
  const teams = useLiveData("teams", initial);
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

  // Escape clears the hover/focus trace.
  useEffect(() => {
    if (hover === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setHover(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hover]);

  return (
    <div>
      {/* confederation filter — mirrors the rest of the site */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {confeds.map((c) => (
          <Chip
            key={c}
            active={confed === c}
            onClick={() => setConfed(c)}
            color={CONFED_COLOR[c] ?? "var(--color-accent)"}
          >
            {c}
          </Chip>
        ))}
      </div>

      <div className="panel overflow-x-auto p-3 sm:p-4">
        <motion.div
          variants={staggerChildren(0.04)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="flex min-w-[920px] gap-3"
        >
          {columns.map((col) => (
            <motion.div key={col.short} variants={staggerChildren(0.008)} className="flex-1">
              <div className="mb-3 flex items-baseline justify-between border-b hairline pb-2">
                <span className="eyebrow">{col.short}</span>
                <span className="mono text-2xs text-[var(--color-text-tertiary)]">
                  {col.teams.length}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <AnimatePresence mode="popLayout">
                  {col.teams.map((t) => {
                    const v = t[col.key] as number;
                    const isHover = hover === t.name;
                    const dim = hover !== null && !isHover;
                    return (
                      <motion.div
                        key={t.name}
                        layout
                        variants={fadeRise}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: DUR.fast } }}
                        transition={SPRING.snappy}
                        tabIndex={0}
                        aria-label={`${t.name} — ${pct(v, 0)} to ${col.aria}`}
                        onMouseEnter={() => setHover(t.name)}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover(t.name)}
                        onBlur={() => setHover(null)}
                        className="rounded-md transition-[background-color,box-shadow] duration-150"
                        style={{
                          background: isHover ? "var(--color-bg-elevated)" : "transparent",
                          boxShadow: isHover ? "var(--shadow-glow)" : "none",
                        }}
                      >
                        {/* dim lives on an inner layer so it never fights the
                            variant-driven entrance opacity on the row itself */}
                        <motion.div
                          animate={{ opacity: dim ? 0.28 : 1 }}
                          transition={{ duration: DUR.fast }}
                          className="flex items-center gap-2 px-1.5 py-1"
                        >
                          <Flag iso={t.iso} name={t.name} size={18} decorative />
                          <span className="min-w-0 flex-1 truncate text-sm leading-tight text-[var(--color-text-primary)]">
                            {t.name}
                          </span>
                          <HeatPill p={v} digits={0} className="shrink-0" />
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <Footnote className="max-w-3xl leading-relaxed">
        Each column: probability of reaching that round, across {nSims.toLocaleString("en-US")} simulations.
        Hover or focus a team to trace it through the bracket; Escape clears. Teams below 0.2% in a
        round are hidden.
      </Footnote>
    </div>
  );
}
