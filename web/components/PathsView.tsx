"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { PathOpp, TeamPath } from "@/lib/data";
import { CONFED_COLOR, heatColor, heatText, pct } from "@/lib/ui";
import Flag from "./Flag";

type SortKey = "pathRank" | "pathDifficulty" | "reachQF";

export default function PathsView({ paths }: { paths: TeamPath[] }) {
  const byReach = useMemo(() => [...paths].sort((a, b) => b.reachQF - a.reachQF), [paths]);
  const [sel, setSel] = useState(byReach[0]?.name ?? paths[0].name);
  const [confed, setConfed] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("pathRank");

  const confeds = useMemo(() => ["ALL", ...Array.from(new Set(paths.map((p) => p.confederation)))], [paths]);
  const cur = paths.find((p) => p.name === sel)!;

  const cols: { key: string; label: string; reach: number; opps: PathOpp[] }[] = [
    { key: "R32", label: "Round of 32", reach: cur.reachR32, opps: cur.rounds.R32 },
    { key: "R16", label: "Round of 16", reach: cur.reachR16, opps: cur.rounds.R16 },
    { key: "QF", label: "Quarter-final", reach: cur.reachQF, opps: cur.rounds.QF },
    { key: "SF", label: "Semi-final", reach: cur.reachSF, opps: cur.rounds.SF },
  ];

  const rows = useMemo(() => {
    const f = confed === "ALL" ? paths : paths.filter((p) => p.confederation === confed);
    const dir = sort === "reachQF" ? -1 : 1;
    return [...f].sort((a, b) => (a[sort] - b[sort]) * dir);
  }, [paths, confed, sort]);

  return (
    <div className="flex flex-col gap-14">
      {/* ---- Road to the Final ---- */}
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select value={sel} onChange={(e) => setSel(e.target.value)}
            className="mono rounded-lg border hairline bg-[var(--color-ink2)] px-3 py-2 text-sm text-[var(--color-text)]">
            {[...paths].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1.5">
            {byReach.slice(0, 8).map((p) => (
              <button key={p.name} onClick={() => setSel(p.name)} className="chip"
                style={{ color: sel === p.name ? "#07090d" : "var(--color-muted)", background: sel === p.name ? "var(--color-lime)" : "transparent", borderColor: sel === p.name ? "transparent" : "var(--color-line)" }}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {cols.map((c, ci) => (
            <motion.div key={c.key} className="panel p-4"
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: ci * 0.06, ease: [0.16, 1, 0.3, 1] }}>
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">{c.label}</span>
                <span className="mono text-[0.62rem] text-[var(--color-muted)]">{pct(c.reach, 0)}</span>
              </div>
              <div className="mt-3 flex flex-col gap-2.5">
                {c.opps.length === 0 && <span className="mono text-[0.62rem] text-[var(--color-faint)]">— unlikely to reach —</span>}
                {c.opps.slice(0, 3).map((o) => <OppRow key={o.opp} o={o} />)}
              </div>
            </motion.div>
          ))}
          {/* Title tile */}
          <motion.div className="panel flex flex-col items-center justify-center p-4 text-center"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 4 * 0.06, ease: [0.16, 1, 0.3, 1] }}
            style={{ background: "linear-gradient(180deg, rgba(255,194,75,0.08), var(--color-ink))" }}>
            <span className="eyebrow text-[var(--color-gold)]">Title</span>
            <span className="display mt-2 text-3xl text-[var(--color-gold)]">{pct(cur.champion, 1)}</span>
            <span className="mono mt-1 text-[0.58rem] text-[var(--color-faint)]">to win it all</span>
          </motion.div>
        </div>
      </section>

      {/* ---- Draw difficulty leaderboard ---- */}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="eyebrow">Kindest → cruelest draw</div>
            <h2 className="display mt-2 text-3xl">Path difficulty</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {confeds.map((c) => (
              <button key={c} onClick={() => setConfed(c)} className="chip"
                style={{ color: confed === c ? "#07090d" : "var(--color-muted)", background: confed === c ? (CONFED_COLOR[c] ?? "var(--color-lime)") : "transparent", borderColor: confed === c ? "transparent" : "var(--color-line)" }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b hairline text-left">
                <th className="px-3 py-3 eyebrow font-normal">
                  <button onClick={() => setSort("pathRank")} style={{ color: sort === "pathRank" ? "var(--color-lime)" : undefined }} className="eyebrow">#</button>
                </th>
                <th className="px-3 py-3 eyebrow font-normal">Team</th>
                <th className="px-3 py-3 eyebrow font-normal">
                  <button onClick={() => setSort("pathDifficulty")} className="eyebrow" style={{ color: sort === "pathDifficulty" ? "var(--color-lime)" : undefined }}>Difficulty{sort === "pathDifficulty" ? " ↓" : ""}</button>
                </th>
                <th className="px-3 py-3 eyebrow font-normal">Likely R32</th>
                <th className="px-3 py-3 text-right eyebrow font-normal">
                  <button onClick={() => setSort("reachQF")} className="eyebrow" style={{ color: sort === "reachQF" ? "var(--color-lime)" : undefined }}>Reach QF{sort === "reachQF" ? " ↓" : ""}</button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const r32 = p.rounds.R32[0];
                return (
                  <motion.tr key={p.name} layout className="row-glow border-b border-white/5">
                    <td className="px-3 py-2.5 mono text-sm text-[var(--color-faint)]">{p.pathRank}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setSel(p.name)} className="flex items-center gap-3 text-left">
                        <Flag iso={p.iso} name={p.name} size={24} />
                        <span className="text-sm font-medium">{p.name}</span>
                        <span className="mono text-[0.56rem] uppercase tracking-wider" style={{ color: CONFED_COLOR[p.confederation] }}>{p.group}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 bartrack">
                          <div className="h-full rounded-full" style={{ width: `${p.pathDifficulty}%`, background: heatColor(p.pathDifficulty / 100) }} />
                        </div>
                        <span className="mono text-xs tabular-nums text-[var(--color-muted)]">{p.pathDifficulty.toFixed(0)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {r32 ? (
                        <div className="flex items-center gap-2">
                          <Flag iso={r32.oppIso} name={r32.opp} size={18} />
                          <span className="truncate text-[13px]">{r32.opp}</span>
                          <span className="mono text-[0.6rem] text-[var(--color-faint)]">{pct(r32.prob, 0)}</span>
                        </div>
                      ) : <span className="mono text-[0.62rem] text-[var(--color-faint)]">—</span>}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <span className="mono inline-block min-w-[44px] rounded-md py-1 text-center text-xs tabular-nums"
                        style={{ background: `${heatColor(p.reachQF)}22`, color: heatText(p.reachQF) === "#07090d" ? heatColor(p.reachQF) : "var(--color-text)" }}>
                        {pct(p.reachQF, 0)}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 mono text-[0.62rem] text-[var(--color-faint)]">
          Difficulty 0 = kindest draw, 100 = cruelest — the expected strength of likely R32 + R16 opponents,
          relative to the field. Click a team to see its road to the final.
        </p>
      </section>
    </div>
  );
}

function OppRow({ o }: { o: PathOpp }) {
  return (
    <div className="flex items-center gap-2">
      <Flag iso={o.oppIso} name={o.opp} size={18} />
      <span className="flex-1 truncate text-[13px]">{o.opp}</span>
      <span className="mono text-[0.58rem] text-[var(--color-faint)]">{pct(o.prob, 0)}</span>
      <span className="mono w-9 rounded text-center text-[0.58rem] tabular-nums"
        style={{ background: `${heatColor(o.winProb)}22`, color: "var(--color-muted)" }} title="your win chance">
        {pct(o.winProb, 0)}
      </span>
    </div>
  );
}
