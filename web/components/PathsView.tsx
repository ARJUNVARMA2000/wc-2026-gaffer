"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PathOpp, TeamPath } from "@/lib/data";
import { useLiveData } from "@/lib/live";
import { CONFED_COLOR, heat, pct } from "@/lib/ui";
import { DUR, EASE_OUT, SPRING, fadeRise, staggerChildren } from "@/lib/motion";
import Bar from "./ui/Bar";
import Chip from "./ui/Chip";
import Footnote from "./ui/Footnote";
import HeatPill from "./ui/HeatPill";
import { SectionHeader } from "./ui/PageHeader";
import Select from "./ui/Select";
import SortButton from "./ui/SortButton";
import CountUp from "./CountUp";
import Flag from "./Flag";

type SortKey = "pathRank" | "pathDifficulty" | "reachQF";

/** Rank/difficulty read kindest-first (ascending); reach-QF strongest-first. */
const SORT_DIR: Record<SortKey, "ascending" | "descending"> = {
  pathRank: "ascending",
  pathDifficulty: "ascending",
  reachQF: "descending",
};

const cardHover = { y: -2, boxShadow: "var(--shadow-raised)" } as const;

export default function PathsView({ paths: initial }: { paths: TeamPath[] }) {
  const paths = useLiveData("paths", initial);
  const byReach = useMemo(() => [...paths].sort((a, b) => b.reachQF - a.reachQF), [paths]);
  const [sel, setSel] = useState(byReach[0]?.name ?? "");
  const [confed, setConfed] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("pathRank");

  const confeds = useMemo(
    () => ["ALL", ...Array.from(new Set(paths.map((p) => p.confederation)))],
    [paths]
  );

  const rows = useMemo(() => {
    const f = confed === "ALL" ? paths : paths.filter((p) => p.confederation === confed);
    const dir = SORT_DIR[sort] === "descending" ? -1 : 1;
    return [...f].sort((a, b) => (a[sort] - b[sort]) * dir);
  }, [paths, confed, sort]);

  // A live swap can drop the selected team — fall back instead of crashing.
  const cur = paths.find((p) => p.name === sel) ?? rows[0] ?? byReach[0];
  if (!cur) return null;

  const cols: { key: string; label: string; reach: number; opps: PathOpp[] }[] = [
    { key: "R32", label: "Round of 32", reach: cur.reachR32, opps: cur.rounds.R32 },
    { key: "R16", label: "Round of 16", reach: cur.reachR16, opps: cur.rounds.R16 },
    { key: "QF", label: "Quarter-final", reach: cur.reachQF, opps: cur.rounds.QF },
    { key: "SF", label: "Semi-final", reach: cur.reachSF, opps: cur.rounds.SF },
  ];

  const alphabetical = [...paths].sort((a, b) => a.name.localeCompare(b.name));
  // Entrance stagger scaled so the full row cascade lands inside ~0.35s.
  const rowStagger = Math.min(0.03, 0.35 / Math.max(rows.length, 1));

  return (
    <div className="flex flex-col gap-14">
      {/* ---- Road to the Final ---- */}
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select value={cur.name} onChange={setSel} label="Choose a team" className="w-48">
            {alphabetical.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </Select>
          <div className="flex flex-wrap gap-1.5">
            {byReach.slice(0, 8).map((p) => (
              <Chip key={p.name} active={cur.name === p.name} onClick={() => setSel(p.name)}>
                {p.name}
              </Chip>
            ))}
          </div>
        </div>

        <motion.div
          variants={staggerChildren(0.06)}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-3 lg:grid-cols-5"
        >
          {cols.map((c) => (
            <motion.div
              key={c.key}
              variants={fadeRise}
              whileHover={cardHover}
              transition={{ duration: DUR.fast, ease: EASE_OUT }}
              className="panel p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="eyebrow">{c.label}</span>
                <span
                  className="mono text-2xs text-[var(--color-text-secondary)]"
                  title={`Chance ${cur.name} reaches this round`}
                >
                  <CountUp value={c.reach * 100} decimals={0} suffix="%" duration={0.6} />
                </span>
              </div>
              <div className="relative mt-3 flex min-h-[88px] flex-col gap-2.5">
                <AnimatePresence mode="popLayout" initial={false}>
                  {c.opps.length === 0 && (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: DUR.base, ease: EASE_OUT }}
                      className="mono text-2xs text-[var(--color-text-tertiary)]"
                    >
                      — unlikely to reach —
                    </motion.div>
                  )}
                  {c.opps.slice(0, 3).map((o) => (
                    <motion.div
                      key={o.opp}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: DUR.base, ease: EASE_OUT }}
                      className="flex items-center gap-2"
                    >
                      <Flag iso={o.oppIso} name={o.opp} size={18} decorative />
                      <span className="flex-1 truncate text-sm">{o.opp}</span>
                      <span
                        className="mono text-2xs text-[var(--color-text-tertiary)]"
                        title={`Chance of facing ${o.opp}`}
                      >
                        {pct(o.prob, 0)}
                      </span>
                      <span title={`${cur.name}'s win probability vs ${o.opp}`}>
                        <HeatPill p={o.winProb} digits={0} className="!min-w-[40px]" />
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}

          {/* Title tile */}
          <motion.div
            variants={fadeRise}
            whileHover={cardHover}
            transition={{ duration: DUR.fast, ease: EASE_OUT }}
            className="panel flex flex-col items-center justify-center p-4 text-center"
            style={{
              background: "linear-gradient(180deg, rgb(211 184 98 / 0.08), var(--color-bg-subtle))",
            }}
          >
            <span className="eyebrow" style={{ color: "var(--color-warning)" }}>
              Title
            </span>
            <span className="display mt-2 text-3xl" style={{ color: "var(--color-warning)" }}>
              <CountUp value={cur.champion * 100} decimals={1} suffix="%" duration={0.8} />
            </span>
            <span className="mono mt-1 text-2xs text-[var(--color-text-tertiary)]">
              to win it all
            </span>
          </motion.div>
        </motion.div>
        <Footnote>
          Top likely opponents per round · grey % = chance of the meeting · tinted pill ={" "}
          {cur.name}&rsquo;s win probability if it happens
        </Footnote>
      </section>

      {/* ---- Draw difficulty leaderboard ---- */}
      <section>
        <SectionHeader
          eyebrow="Kindest → cruelest draw"
          title="Path difficulty"
          right={
            <div className="flex flex-wrap gap-1.5">
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
          }
        />

        <div className="panel mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b hairline text-left">
                <th
                  scope="col"
                  aria-sort={sort === "pathRank" ? SORT_DIR.pathRank : "none"}
                  className="px-3 py-3 font-normal"
                >
                  <SortButton
                    active={sort === "pathRank"}
                    onClick={() => setSort("pathRank")}
                    label="Sort by draw rank, kindest first"
                  >
                    #
                  </SortButton>
                </th>
                <th scope="col" className="eyebrow px-3 py-3 font-normal">
                  Team
                </th>
                <th
                  scope="col"
                  aria-sort={sort === "pathDifficulty" ? SORT_DIR.pathDifficulty : "none"}
                  className="px-3 py-3 font-normal"
                >
                  <SortButton
                    active={sort === "pathDifficulty"}
                    onClick={() => setSort("pathDifficulty")}
                    label="Sort by draw difficulty"
                  >
                    Difficulty
                  </SortButton>
                </th>
                <th scope="col" className="eyebrow px-3 py-3 font-normal">
                  Likely R32
                </th>
                <th
                  scope="col"
                  aria-sort={sort === "reachQF" ? SORT_DIR.reachQF : "none"}
                  className="px-3 py-3 text-right font-normal"
                >
                  <SortButton
                    active={sort === "reachQF"}
                    onClick={() => setSort("reachQF")}
                    label="Sort by chance of reaching the quarter-finals"
                  >
                    Reach QF
                  </SortButton>
                </th>
              </tr>
            </thead>
            <motion.tbody
              variants={staggerChildren(rowStagger)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {rows.map((p) => {
                  const r32 = p.rounds.R32[0];
                  return (
                    <motion.tr
                      key={p.name}
                      layout
                      variants={fadeRise}
                      exit={{ opacity: 0, transition: { duration: DUR.fast } }}
                      transition={SPRING.snappy}
                      className="row-glow border-b hairline"
                    >
                      <td className="mono px-3 py-2.5 text-sm text-[var(--color-text-tertiary)]">
                        {p.pathRank}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setSel(p.name)}
                          aria-label={`Trace ${p.name}'s road to the final`}
                          className="flex cursor-pointer items-center gap-3 text-left"
                        >
                          <Flag iso={p.iso} name={p.name} size={24} decorative />
                          <span className="text-sm font-medium">{p.name}</span>
                          <span
                            className="mono text-2xs uppercase tracking-wider"
                            style={{ color: CONFED_COLOR[p.confederation] }}
                          >
                            {p.group}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-24">
                            <Bar
                              value={p.pathDifficulty / 100}
                              color={heat(p.pathDifficulty / 100)}
                            />
                          </div>
                          <span className="mono text-xs tabular-nums text-[var(--color-text-secondary)]">
                            {p.pathDifficulty.toFixed(0)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {r32 ? (
                          <div className="flex items-center gap-2">
                            <Flag iso={r32.oppIso} name={r32.opp} size={18} decorative />
                            <span className="truncate text-sm">{r32.opp}</span>
                            <span className="mono text-2xs text-[var(--color-text-tertiary)]">
                              {pct(r32.prob, 0)}
                            </span>
                          </div>
                        ) : (
                          <span className="mono text-2xs text-[var(--color-text-tertiary)]">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <HeatPill p={p.reachQF} digits={0} />
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </motion.tbody>
          </table>
        </div>
        <Footnote>
          Difficulty 0 = kindest draw, 100 = cruelest — the expected strength of likely R32 + R16
          opponents, relative to the field. Click a team to trace its road to the final.
        </Footnote>
      </section>
    </div>
  );
}
