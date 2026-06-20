"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Team } from "@/lib/data";
import { CONFED_COLOR } from "@/lib/ui";
import Flag from "./Flag";

type Key = "elo" | "rr" | "value" | "attack" | "defense" | "tilt";

function fmtValue(m: number): string {
  if (m >= 1000) return `€${(m / 1000).toFixed(2)}bn`;
  return `€${Math.round(m)}m`;
}

export default function StrengthView({ teams }: { teams: Team[] }) {
  const [confed, setConfed] = useState("ALL");
  const [hover, setHover] = useState<string | null>(null);
  const [sort, setSort] = useState<Key>("elo");

  const confeds = useMemo(
    () => ["ALL", ...Array.from(new Set(teams.map((t) => t.confederation)))],
    [teams]
  );

  const shown = confed === "ALL" ? teams : teams.filter((t) => t.confederation === confed);

  // scatter domains (defense axis inverted: better defense at top)
  const ax = teams.map((t) => t.attack);
  const dx = teams.map((t) => t.defense);
  const axmin = Math.min(...ax) - 0.12, axmax = Math.max(...ax) + 0.12;
  const dmin = Math.min(...dx) - 0.12, dmax = Math.max(...dx) + 0.12;
  const left = (t: Team) => ((t.attack - axmin) / (axmax - axmin)) * 100;
  const top = (t: Team) => ((t.defense - dmin) / (dmax - dmin)) * 100;

  const table = [...shown].sort((a, b) => (b[sort] as number) - (a[sort] as number));

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center gap-2">
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

      {/* SCATTER */}
      <div className="panel p-5 sm:p-7">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="display text-xl">Attack vs. Defense</h3>
          <span className="eyebrow hidden sm:block">goals vs. an average WC opponent</span>
        </div>
        <div className="relative mt-4 aspect-[16/10] w-full">
          {/* grid + quadrant lines */}
          <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="10%" height="12.5%" patternUnits="userSpaceOnUse">
                <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <line x1="50%" y1="0" x2="50%" y2="100%" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
          </svg>
          {/* quadrant labels */}
          <span className="eyebrow absolute left-3 top-2">★ Elite</span>
          <span className="eyebrow absolute right-3 top-2 text-[var(--color-gold)]">Free-scoring</span>
          <span className="eyebrow absolute left-3 bottom-2">Low event</span>
          <span className="eyebrow absolute right-3 bottom-2">Leaky</span>

          {/* points */}
          {shown.map((t) => {
            const active = hover === t.name;
            return (
              <motion.div
                key={t.name}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                style={{ left: `${left(t)}%`, top: `${top(t)}%` }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: active ? 1.5 : 1 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                onMouseEnter={() => setHover(t.name)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className="rounded-[3px] ring-1 transition-shadow"
                  style={{ boxShadow: active ? `0 0 0 2px ${CONFED_COLOR[t.confederation]}` : "none" }}
                >
                  <Flag iso={t.iso} name={t.name} size={active ? 26 : 18} />
                </div>
                {active && (
                  <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg border hairline bg-[var(--color-ink2)] px-3 py-2 text-center shadow-xl">
                    <div className="text-xs font-semibold">{t.name}</div>
                    <div className="mono mt-0.5 text-[0.62rem] text-[var(--color-muted)]">
                      ATK {t.attack.toFixed(2)} · DEF {t.defense.toFixed(2)}
                    </div>
                    <div className="mono mt-0.5 text-[0.62rem] text-[var(--color-gold)]">
                      squad {fmtValue(t.value)}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-between">
          <span className="eyebrow">← weaker attack · stronger attack →</span>
          <span className="eyebrow">↑ better defense · weaker defense ↓</span>
        </div>
      </div>

      {/* TABLE */}
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b hairline text-left">
              <th className="px-3 py-3 eyebrow font-normal">#</th>
              <th className="px-3 py-3 eyebrow font-normal">Team</th>
              {(
                [
                  ["elo", "ELO"],
                  ["rr", "RR PTS"],
                  ["value", "SQUAD €"],
                  ["attack", "ATK"],
                  ["defense", "DEF"],
                  ["tilt", "TILT"],
                ] as [Key, string][]
              ).map(([k, l]) => (
                <th key={k} className="px-3 py-3 text-right">
                  <button
                    onClick={() => setSort(k)}
                    className="eyebrow font-normal transition-colors hover:text-[var(--color-text)]"
                    style={{ color: sort === k ? "var(--color-lime)" : undefined }}
                  >
                    {l}{sort === k ? " ↓" : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.map((t, i) => (
              <motion.tr key={t.name} layout className="row-glow border-b border-white/5">
                <td className="px-3 py-2.5 mono text-sm text-[var(--color-faint)]">{String(i + 1).padStart(2, "0")}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Flag iso={t.iso} name={t.name} size={24} />
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className="mono text-[0.58rem] uppercase tracking-wider" style={{ color: CONFED_COLOR[t.confederation] }}>
                      {t.confederation}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right mono text-sm">{Math.round(t.elo)}</td>
                <td className="px-3 py-2.5 text-right mono text-sm text-[var(--color-lime)]">{t.rr.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right mono text-sm text-[var(--color-muted)]">{fmtValue(t.value)}</td>
                <td className="px-3 py-2.5 text-right mono text-sm">{t.attack.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right mono text-sm">{t.defense.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right mono text-sm" style={{ color: t.tilt >= 0 ? "var(--color-lime)" : "var(--color-coral)" }}>
                  {t.tilt > 0 ? "+" : ""}{t.tilt.toFixed(2)}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
