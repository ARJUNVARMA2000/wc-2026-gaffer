"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Team } from "@/lib/data";
import { useLiveData } from "@/lib/live";
import { DUR, SPRING, fadeRise, staggerChildren } from "@/lib/motion";
import { CONFED_COLOR } from "@/lib/ui";
import Chip from "./ui/Chip";
import SortButton from "./ui/SortButton";
import { TooltipFloat } from "./ui/Tooltip";
import Flag from "./Flag";

type Key = "elo" | "rr" | "value" | "attack" | "defense" | "tilt";

const COLUMNS: [Key, string, string][] = [
  ["elo", "ELO", "Elo rating"],
  ["rr", "RR PTS", "round-robin points"],
  ["value", "SQUAD €", "squad value"],
  ["attack", "ATK", "attack rating"],
  ["defense", "DEF", "defense rating"],
  ["tilt", "TILT", "tilt"],
];

function fmtValue(m: number): string {
  if (m >= 1000) return `€${(m / 1000).toFixed(2)}bn`;
  return `€${Math.round(m)}m`;
}

interface Domain {
  axmin: number;
  axmax: number;
  dmin: number;
  dmax: number;
}

type HoverHandler = (name: string | null, el?: HTMLElement | null) => void;

/* ------------------------------------------------------------------ */
/* Scatter point — memoized so sibling hovers don't re-render it.      */
/* Accepts `ref` (React 19 prop) so AnimatePresence popLayout can      */
/* measure it on exit.                                                 */
/* ------------------------------------------------------------------ */

const ScatterPoint = memo(function ScatterPoint({
  team,
  x,
  y,
  active,
  onHover,
  ref,
}: {
  team: Team;
  x: number;
  y: number;
  active: boolean;
  onHover: HoverHandler;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <motion.div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={`${team.name} — attack ${team.attack.toFixed(2)}, defense ${team.defense.toFixed(2)}, squad ${fmtValue(team.value)}`}
      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
      style={{ left: `${x}%`, top: `${y}%`, zIndex: active ? 30 : 10 }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1, left: `${x}%`, top: `${y}%` }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: DUR.fast } }}
      transition={{ default: SPRING.gentle, left: SPRING.bar, top: SPRING.bar }}
      onMouseEnter={(e) => onHover(team.name, e.currentTarget)}
      onMouseLeave={() => onHover(null)}
      onFocus={(e) => onHover(team.name, e.currentTarget)}
      onBlur={() => onHover(null)}
    >
      <motion.div
        className="rounded-[var(--radius-xs)]"
        animate={{
          scale: active ? 1.45 : 1,
          boxShadow: active
            ? `0 0 0 2px ${CONFED_COLOR[team.confederation]}`
            : "0 0 0 0px rgba(0, 0, 0, 0)",
        }}
        transition={{ duration: DUR.fast }}
      >
        {/* the flag is the only visual identifier here — keep its alt text */}
        <Flag iso={team.iso} name={team.name} size={18} />
      </motion.div>
    </motion.div>
  );
});

/* ------------------------------------------------------------------ */
/* Scatter panel — owns hover state so the table below never           */
/* re-renders on hover.                                                */
/* ------------------------------------------------------------------ */

const StrengthScatter = memo(function StrengthScatter({
  teams,
  domain,
}: {
  teams: Team[];
  domain: Domain;
}) {
  const [hover, setHover] = useState<{
    name: string;
    x: number;
    y: number;
    below: boolean;
  } | null>(null);

  const onHover = useCallback<HoverHandler>((name, el) => {
    if (!name || !el) {
      setHover(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const below = r.top < 180; // flip under the point near the viewport top
    setHover({ name, x: r.left + r.width / 2, y: below ? r.bottom : r.top, below });
  }, []);

  useEffect(() => {
    if (!hover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHover(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hover]);

  const { axmin, axmax, dmin, dmax } = domain;
  const hovered = hover ? (teams.find((t) => t.name === hover.name) ?? null) : null;

  return (
    <div className="panel p-5 sm:p-7">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="display text-lg">Attack vs. Defense</h2>
        <span className="eyebrow hidden sm:block">goals vs. an average WC opponent</span>
      </div>

      <div
        className="relative mt-4 aspect-[16/10] w-full"
        role="group"
        aria-label="Attack vs. defense scatter plot"
      >
        {/* grid + quadrant lines */}
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="strength-grid" width="10%" height="12.5%" patternUnits="userSpaceOnUse">
              <path
                d="M 1000 0 L 0 0 0 1000"
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#strength-grid)" />
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="var(--color-border)" strokeDasharray="4 4" />
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="var(--color-border)" strokeDasharray="4 4" />
        </svg>

        {/* quadrant labels */}
        <span className="eyebrow absolute left-3 top-2">★ Elite</span>
        <span className="eyebrow absolute right-3 top-2 text-[var(--color-warning)]">
          Free-scoring
        </span>
        <span className="eyebrow absolute bottom-2 left-3">Low event</span>
        <span className="eyebrow absolute bottom-2 right-3">Leaky</span>

        {/* points */}
        <AnimatePresence mode="popLayout">
          {teams.map((t) => (
            <ScatterPoint
              key={t.name}
              team={t}
              x={((t.attack - axmin) / (axmax - axmin)) * 100}
              y={((t.defense - dmin) / (dmax - dmin)) * 100}
              active={hover?.name === t.name}
              onHover={onHover}
            />
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex justify-between">
        <span className="eyebrow">← weaker attack · stronger attack →</span>
        <span className="eyebrow">↑ better defense · weaker defense ↓</span>
      </div>

      <TooltipFloat
        open={hovered !== null}
        x={hover?.x ?? 0}
        y={hover?.y ?? 0}
        placement={hover?.below ? "below" : "above"}
      >
        {hovered && (
          <div className="text-center">
            <div className="text-xs font-semibold text-[var(--color-text-primary)]">
              {hovered.name}
            </div>
            <div className="mono mt-0.5 text-2xs text-[var(--color-text-secondary)]">
              ATK {hovered.attack.toFixed(2)} · DEF {hovered.defense.toFixed(2)}
            </div>
            <div className="mono mt-0.5 text-2xs text-[var(--color-warning)]">
              squad {fmtValue(hovered.value)}
            </div>
          </div>
        )}
      </TooltipFloat>
    </div>
  );
});

/* ------------------------------------------------------------------ */

export default function StrengthView({ teams: initial }: { teams: Team[] }) {
  const teams = useLiveData("teams", initial);
  const [confed, setConfed] = useState("ALL");
  const [sort, setSort] = useState<Key>("elo");

  const confeds = useMemo(
    () => ["ALL", ...Array.from(new Set(teams.map((t) => t.confederation)))],
    [teams],
  );

  const shown = useMemo(
    () => (confed === "ALL" ? teams : teams.filter((t) => t.confederation === confed)),
    [teams, confed],
  );

  // scatter domains from ALL teams so axes stay stable across confed filters
  // (defense axis inverted: better defense at top)
  const domain = useMemo<Domain>(() => {
    const ax = teams.map((t) => t.attack);
    const dx = teams.map((t) => t.defense);
    return {
      axmin: Math.min(...ax) - 0.12,
      axmax: Math.max(...ax) + 0.12,
      dmin: Math.min(...dx) - 0.12,
      dmax: Math.max(...dx) + 0.12,
    };
  }, [teams]);

  const table = useMemo(() => [...shown].sort((a, b) => b[sort] - a[sort]), [shown, sort]);

  return (
    <div className="flex flex-col gap-10">
      <motion.div
        variants={staggerChildren(0.08)}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-10"
      >
        <motion.div variants={fadeRise} className="flex flex-wrap items-center gap-2">
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
        </motion.div>

        <motion.div variants={fadeRise}>
          <StrengthScatter teams={shown} domain={domain} />
        </motion.div>
      </motion.div>

      {/* TABLE */}
      <motion.div
        variants={fadeRise}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="panel overflow-x-auto"
      >
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="hairline border-b text-left">
              <th scope="col" className="eyebrow px-3 py-3 font-normal">
                #
              </th>
              <th scope="col" className="eyebrow px-3 py-3 font-normal">
                Team
              </th>
              {COLUMNS.map(([k, label, ariaName]) => (
                <th
                  key={k}
                  scope="col"
                  aria-sort={sort === k ? "descending" : "none"}
                  className="px-3 py-3 text-right"
                >
                  <SortButton active={sort === k} onClick={() => setSort(k)} label={`Sort by ${ariaName}`}>
                    {label}
                  </SortButton>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.map((t, i) => (
              <motion.tr
                key={t.name}
                layout
                transition={SPRING.snappy}
                className="row-glow border-b border-[var(--color-border)]"
              >
                <td className="mono px-3 py-2.5 text-sm text-[var(--color-text-tertiary)]">
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Flag iso={t.iso} name={t.name} size={24} decorative />
                    <span className="text-sm font-medium">{t.name}</span>
                    <span
                      className="mono text-2xs uppercase tracking-wider"
                      style={{ color: CONFED_COLOR[t.confederation] }}
                    >
                      {t.confederation}
                    </span>
                  </div>
                </td>
                <td className="mono px-3 py-2.5 text-right text-sm">{Math.round(t.elo)}</td>
                <td className="mono px-3 py-2.5 text-right text-sm text-[var(--color-accent)]">
                  {t.rr.toFixed(2)}
                </td>
                <td className="mono px-3 py-2.5 text-right text-sm text-[var(--color-text-secondary)]">
                  {fmtValue(t.value)}
                </td>
                <td className="mono px-3 py-2.5 text-right text-sm">{t.attack.toFixed(2)}</td>
                <td className="mono px-3 py-2.5 text-right text-sm">{t.defense.toFixed(2)}</td>
                <td
                  className="mono px-3 py-2.5 text-right text-sm"
                  style={{
                    color: t.tilt >= 0 ? "var(--color-positive)" : "var(--color-negative)",
                  }}
                >
                  {t.tilt > 0 ? "+" : ""}
                  {t.tilt.toFixed(2)}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
