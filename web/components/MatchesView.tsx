"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Match } from "@/lib/data";
import { useLiveData } from "@/lib/live";
import { fmtDate, pct } from "@/lib/ui";
import { DUR, EASE_OUT, SPRING, fadeRise, staggerChildren } from "@/lib/motion";
import Chip from "./ui/Chip";
import SegmentedControl from "./ui/SegmentedControl";
import { SegmentedBar } from "./ui/Bar";
import { SectionHeader } from "./ui/PageHeader";
import Flag from "./Flag";

type StatusFilter = "ALL" | "UPCOMING" | "PLAYED";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "PLAYED", label: "Played" },
];

/** Neutral middle segment of the W/D/L strip (draws carry no team color). */
const DRAW_GREY = "rgba(255, 255, 255, 0.14)";

const matchKey = (m: Match) => `${m.date}|${m.home}|${m.away}`;

/** Shared card motion: snappy layout FLIP, fast hover lift, fast exits.
 *  Entrance timing comes from the fadeRise variant itself. */
const cardHover = { y: -1, boxShadow: "var(--shadow-raised)" } as const;
const cardExit = { opacity: 0, transition: { duration: DUR.fast } } as const;
const cardTransition = {
  layout: SPRING.snappy,
  y: { duration: DUR.fast, ease: EASE_OUT },
  boxShadow: { duration: DUR.fast },
} as const;

export default function MatchesView({ matches: initial }: { matches: Match[] }) {
  const matches = useLiveData("matches", initial);
  const [group, setGroup] = useState("ALL");
  const [filter, setFilter] = useState<StatusFilter>("ALL");

  const groups = useMemo(
    () => ["ALL", ...Array.from(new Set(matches.map((m) => m.group))).sort()],
    [matches]
  );

  // Filter folded into the grouping memo so it recomputes only when the
  // inputs actually change (the old standalone `filtered` defeated this).
  const byDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      if (group !== "ALL" && m.group !== group) continue;
      if (filter !== "ALL" && (filter === "PLAYED") !== m.played) continue;
      const list = map.get(m.date);
      if (list) list.push(m);
      else map.set(m.date, [m]);
    }
    return Array.from(map.entries());
  }, [matches, group, filter]);

  const upsets = useMemo(
    () =>
      matches
        .filter((m) => m.played && m.modelProb != null)
        .sort((a, b) => a.modelProb! - b.modelProb!)
        .slice(0, 6),
    [matches]
  );

  return (
    <div>
      {upsets.length > 0 && (
        <section className="mb-12">
          <div className="mb-4">
            <SectionHeader
              eyebrow="Against the odds"
              title="Biggest upsets so far"
              right={
                <span className="mono hidden text-2xs text-[var(--color-text-tertiary)] sm:block">
                  % = chance the model gave the actual result
                </span>
              }
            />
          </div>
          <motion.div
            variants={staggerChildren(0.05)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {upsets.map((m) => (
                <motion.div
                  key={`u|${matchKey(m)}`}
                  layout
                  variants={fadeRise}
                  exit={cardExit}
                  transition={cardTransition}
                  whileHover={cardHover}
                  className="panel flex items-center gap-3 px-4 py-3"
                >
                  <span className="mono w-12 shrink-0 text-lg font-semibold text-[var(--color-negative)]">
                    {Math.round((m.modelProb ?? 0) * 100)}%
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Flag iso={m.homeIso} name={m.home} size={20} decorative />
                    <span className="mono text-sm font-semibold">
                      {m.homeScore}
                      <span className="px-1 text-[var(--color-text-tertiary)]">–</span>
                      {m.awayScore}
                    </span>
                    <Flag iso={m.awayIso} name={m.away} size={20} decorative />
                    <span className="ml-1 truncate text-xs text-[var(--color-text-secondary)]">
                      {m.home} v {m.away}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </section>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <SegmentedControl
          options={STATUS_OPTIONS}
          value={filter}
          onChange={setFilter}
          label="Filter matches by status"
        />
        <span aria-hidden className="mx-1 h-4 w-px bg-[var(--color-border)]" />
        {groups.map((g) => (
          <Chip key={g} active={group === g} onClick={() => setGroup(g)}>
            {g === "ALL" ? "All groups" : `Grp ${g}`}
          </Chip>
        ))}
      </div>

      <div className="flex flex-col gap-8">
        <AnimatePresence mode="popLayout" initial={false}>
          {byDate.map(([date, ms]) => (
            <motion.section
              key={date}
              layout
              variants={staggerChildren(0.04)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              exit={cardExit}
              transition={SPRING.snappy}
            >
              <motion.div variants={fadeRise} className="mb-3 flex items-center gap-3">
                <h2 className="display text-lg text-[var(--color-text-primary)]">
                  {fmtDate(date)}
                </h2>
                <span aria-hidden className="h-px flex-1 bg-[var(--color-border)]" />
                <span className="mono text-2xs text-[var(--color-text-tertiary)]">
                  {ms.length} {ms.length === 1 ? "match" : "matches"}
                </span>
              </motion.div>
              <div className="flex flex-col gap-2">
                <AnimatePresence mode="popLayout" initial={false}>
                  {ms.map((m) => (
                    <motion.div
                      key={matchKey(m)}
                      layout
                      variants={fadeRise}
                      exit={cardExit}
                      transition={cardTransition}
                      whileHover={cardHover}
                      className="panel grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 sm:gap-5"
                    >
                      {/* home */}
                      <div className="flex items-center justify-end gap-2.5 text-right">
                        <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {m.home}
                        </span>
                        <Flag iso={m.homeIso} name={m.home} size={24} decorative />
                      </div>

                      {/* center: score or odds */}
                      <div className="flex min-w-[120px] flex-col items-center">
                        {m.played ? (
                          <div className="display text-2xl text-[var(--color-text-primary)]">
                            {m.homeScore}
                            <span className="px-1.5 text-[var(--color-text-tertiary)]">–</span>
                            {m.awayScore}
                          </div>
                        ) : (
                          <>
                            <div className="mono text-sm text-[var(--color-accent)]">
                              {m.projHome?.toFixed(1)} – {m.projAway?.toFixed(1)}
                            </div>
                            <div
                              role="img"
                              aria-label={`${m.home} win ${pct(m.pHome ?? 0, 0)}, draw ${pct(
                                m.pDraw ?? 0,
                                0
                              )}, ${m.away} win ${pct(m.pAway ?? 0, 0)}`}
                              className="mt-1.5 w-28"
                            >
                              <SegmentedBar
                                height={6}
                                segments={[
                                  {
                                    value: m.pHome ?? 0,
                                    color: "var(--color-accent)",
                                    label: `${m.home} win`,
                                  },
                                  { value: m.pDraw ?? 0, color: DRAW_GREY, label: "Draw" },
                                  {
                                    value: m.pAway ?? 0,
                                    color: "var(--color-info)",
                                    label: `${m.away} win`,
                                  },
                                ]}
                              />
                              <div
                                aria-hidden
                                className="mono mt-1 flex justify-between text-2xs text-[var(--color-text-secondary)]"
                              >
                                <span>{pct(m.pHome ?? 0, 0)}</span>
                                <span>{pct(m.pDraw ?? 0, 0)}</span>
                                <span>{pct(m.pAway ?? 0, 0)}</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* away */}
                      <div className="flex items-center gap-2.5">
                        <Flag iso={m.awayIso} name={m.away} size={24} decorative />
                        <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {m.away}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.section>
          ))}
          {byDate.length === 0 && (
            <motion.div
              key="empty"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={cardExit}
              className="panel px-4 py-8 text-center"
            >
              <span className="mono text-sm text-[var(--color-text-tertiary)]">
                No matches for this filter.
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
