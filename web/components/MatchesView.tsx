"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Match } from "@/lib/data";
import { fmtDate, pct } from "@/lib/ui";
import Flag from "./Flag";

export default function MatchesView({ matches }: { matches: Match[] }) {
  const [group, setGroup] = useState("ALL");
  const [filter, setFilter] = useState<"ALL" | "UPCOMING" | "PLAYED">("ALL");

  const groups = useMemo(
    () => ["ALL", ...Array.from(new Set(matches.map((m) => m.group))).sort()],
    [matches]
  );

  const filtered = matches.filter(
    (m) =>
      (group === "ALL" || m.group === group) &&
      (filter === "ALL" || (filter === "PLAYED") === m.played)
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of filtered) {
      if (!map.has(m.date)) map.set(m.date, []);
      map.get(m.date)!.push(m);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const upsets = useMemo(
    () =>
      matches
        .filter((m) => m.played && m.modelProb != null)
        .sort((a, b) => (a.modelProb! - b.modelProb!))
        .slice(0, 6),
    [matches]
  );

  return (
    <div>
      {upsets.length > 0 && (
        <section className="mb-10">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <div className="eyebrow">Against the odds</div>
              <h2 className="display mt-1 text-2xl">Biggest upsets so far</h2>
            </div>
            <span className="mono hidden text-[0.6rem] text-[var(--color-faint)] sm:block">
              % = chance the model gave the actual result
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {upsets.map((m, i) => (
              <motion.div
                key={`u-${m.home}-${m.away}`}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3) }}
                className="panel row-glow flex items-center gap-3 px-4 py-3"
              >
                <span className="display w-12 shrink-0 text-xl text-[var(--color-coral)]">
                  {Math.round((m.modelProb ?? 0) * 100)}%
                </span>
                <div className="flex flex-1 items-center gap-2">
                  <Flag iso={m.homeIso} name={m.home} size={20} />
                  <span className="mono text-sm font-semibold tabular-nums">
                    {m.homeScore}<span className="px-1 text-[var(--color-faint)]">–</span>{m.awayScore}
                  </span>
                  <Flag iso={m.awayIso} name={m.away} size={20} />
                  <span className="ml-1 truncate text-[0.7rem] text-[var(--color-muted)]">
                    {m.home} v {m.away}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(["ALL", "UPCOMING", "PLAYED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="chip transition-colors"
            style={{
              color: filter === f ? "#07090d" : "var(--color-muted)",
              background: filter === f ? "var(--color-lime)" : "transparent",
              borderColor: filter === f ? "transparent" : "var(--color-line)",
            }}
          >
            {f}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className="chip transition-colors"
            style={{
              color: group === g ? "#07090d" : "var(--color-muted)",
              background: group === g ? "var(--color-cyan)" : "transparent",
              borderColor: group === g ? "transparent" : "var(--color-line)",
            }}
          >
            {g === "ALL" ? "All groups" : `Grp ${g}`}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-8">
        {byDate.map(([date, ms]) => (
          <div key={date}>
            <div className="mb-3 flex items-center gap-3">
              <span className="display text-lg text-[var(--color-text)]">{fmtDate(date)}</span>
              <span className="h-px flex-1 bg-[var(--color-line)]" />
              <span className="mono text-[0.62rem] text-[var(--color-faint)]">{ms.length} matches</span>
            </div>
            <div className="flex flex-col gap-2">
              {ms.map((m, i) => (
                <motion.div
                  key={`${m.home}-${m.away}`}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.2) }}
                  className="panel row-glow grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 sm:gap-5"
                >
                  {/* home */}
                  <div className="flex items-center justify-end gap-2.5 text-right">
                    <span className="truncate text-sm font-medium">{m.home}</span>
                    <Flag iso={m.homeIso} name={m.home} size={24} />
                  </div>

                  {/* center: score or odds */}
                  <div className="flex min-w-[120px] flex-col items-center">
                    {m.played ? (
                      <div className="display text-2xl tracking-wider text-[var(--color-text)]">
                        {m.homeScore}<span className="px-1.5 text-[var(--color-faint)]">–</span>{m.awayScore}
                      </div>
                    ) : (
                      <>
                        <div className="mono text-sm text-[var(--color-lime)]">
                          {m.projHome?.toFixed(1)} – {m.projAway?.toFixed(1)}
                        </div>
                        <div className="mt-1.5 flex h-1.5 w-28 overflow-hidden rounded-full">
                          <div style={{ width: `${(m.pHome ?? 0) * 100}%`, background: "var(--color-lime)" }} />
                          <div style={{ width: `${(m.pDraw ?? 0) * 100}%`, background: "var(--color-faint)" }} />
                          <div style={{ width: `${(m.pAway ?? 0) * 100}%`, background: "var(--color-cyan)" }} />
                        </div>
                        <div className="mono mt-1 flex w-28 justify-between text-[0.6rem] text-[var(--color-muted)]">
                          <span>{pct(m.pHome ?? 0, 0)}</span>
                          <span>{pct(m.pDraw ?? 0, 0)}</span>
                          <span>{pct(m.pAway ?? 0, 0)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* away */}
                  <div className="flex items-center gap-2.5">
                    <Flag iso={m.awayIso} name={m.away} size={24} />
                    <span className="truncate text-sm font-medium">{m.away}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
