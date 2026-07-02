"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import type { ModelParams, Team } from "@/lib/data";
import { heat, pct } from "@/lib/ui";
import { matchup } from "@/lib/model";
import { useLiveData } from "@/lib/live";
import { DUR, fadeRise, staggerChildren } from "@/lib/motion";
import Flag from "./Flag";
import CountUp from "./CountUp";
import Select from "./ui/Select";
import SegmentedControl from "./ui/SegmentedControl";
import { SegmentedBar } from "./ui/Bar";
import Footnote from "./ui/Footnote";

const GMAX = 6; // display 0..6 goals each side

type Venue = "neutral" | "home" | "away";

/** Team picker: flag + styled select. Module scope so the select subtree
 *  survives re-renders (the old inline definition remounted it every render). */
function TeamPicker({
  value,
  onChange,
  label,
  iso,
  order,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  iso: string;
  order: Team[];
}) {
  return (
    <div className="flex items-center gap-3">
      <Flag iso={iso} name={value} size={32} decorative />
      <Select value={value} onChange={onChange} label={label} className="w-full">
        {order.map((t) => (
          <option key={t.name} value={t.name}>
            {t.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

export default function HeadToHead({
  params: initialParams,
  teams: initialTeams,
}: {
  params: ModelParams;
  teams: Team[];
}) {
  const params = useLiveData("model", initialParams);
  const teams = useLiveData("teams", initialTeams);
  const isoParam = useSearchParams().get("a");

  const order = useMemo(() => [...teams].sort((a, b) => b.champion - a.champion), [teams]);
  const iso = useMemo(() => new Map(teams.map((t) => [t.name, t.iso])), [teams]);

  const [home, setHome] = useState(() => {
    const linked = isoParam ? teams.find((t) => t.iso === isoParam)?.name : undefined;
    return linked ?? order[0]?.name ?? teams[0].name;
  });
  const [away, setAway] = useState(
    () => order.find((t) => t.name !== home)?.name ?? teams[1].name
  );
  const [venue, setVenue] = useState<Venue>("neutral");

  // Deep link (/h2h?a=ISO from the command palette): follow later param
  // changes too — client navigation to the same route does not remount.
  // "Adjust state during render" pattern (react.dev/you-might-not-need-an-effect).
  const [prevIso, setPrevIso] = useState(isoParam);
  if (prevIso !== isoParam) {
    setPrevIso(isoParam);
    const linked = isoParam ? teams.find((t) => t.iso === isoParam) : undefined;
    if (linked) {
      setHome(linked.name);
      if (away === linked.name) {
        setAway(order.find((o) => o.name !== linked.name)?.name ?? away);
      }
    }
  }

  const host = venue === "home" ? "home" : venue === "away" ? "away" : null;
  const mu = useMemo(() => matchup(params, home, away, host), [params, home, away, host]);

  const maxCell = useMemo(() => {
    let mx = 0;
    for (let h = 0; h <= GMAX; h++) for (let a = 0; a <= GMAX; a++) mx = Math.max(mx, mu.matrix[h][a]);
    return mx;
  }, [mu]);

  return (
    <motion.div
      variants={staggerChildren()}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-8"
    >
      {/* pickers */}
      <motion.div
        variants={fadeRise}
        className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center"
      >
        <TeamPicker value={home} onChange={setHome} label="Home team" iso={iso.get(home) ?? "un"} order={order} />
        <motion.button
          type="button"
          onClick={() => {
            const h = home;
            setHome(away);
            setAway(h);
          }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Swap teams"
          className="mx-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] transition-colors duration-150 hover:border-[var(--color-border-strong)] hover:text-[var(--color-accent)]"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M5 7 2 4l3-3M2 4h12M11 9l3 3-3 3M14 12H2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>
        <TeamPicker value={away} onChange={setAway} label="Away team" iso={iso.get(away) ?? "un"} order={order} />
      </motion.div>

      {/* venue toggle */}
      <motion.div variants={fadeRise} className="flex flex-wrap items-center gap-3">
        <span className="eyebrow">Venue</span>
        <SegmentedControl<Venue>
          label="Venue"
          value={venue}
          onChange={setVenue}
          options={[
            { value: "neutral", label: "Neutral" },
            { value: "home", label: `${home} home` },
            { value: "away", label: `${away} home` },
          ]}
        />
      </motion.div>

      {/* summary */}
      <motion.div variants={fadeRise} className="panel p-6">
        <div className="flex items-end justify-center gap-6">
          <div className="text-center">
            <Flag iso={iso.get(home) ?? "un"} name={home} size={44} />
            <div className="display mt-2 text-2xl" aria-label={`${home} win ${pct(mu.probs.home, 0)}`}>
              <CountUp value={mu.probs.home * 100} decimals={0} suffix="%" duration={0.8} />
            </div>
          </div>
          <div className="pb-2 text-center">
            <div className="eyebrow">most likely</div>
            <div
              className="display text-4xl text-[var(--color-text-primary)]"
              aria-label={`Most likely score ${mu.likely.h} to ${mu.likely.a}`}
            >
              <CountUp value={mu.likely.h} decimals={0} duration={0.6} />
              <span className="px-2 text-[var(--color-text-tertiary)]">–</span>
              <CountUp value={mu.likely.a} decimals={0} duration={0.6} />
            </div>
            <div className="mono mt-1 text-2xs text-[var(--color-text-secondary)]">
              {pct(mu.likely.p, 0)} · draw {pct(mu.probs.draw, 0)}
            </div>
          </div>
          <div className="text-center">
            <Flag iso={iso.get(away) ?? "un"} name={away} size={44} />
            <div className="display mt-2 text-2xl" aria-label={`${away} win ${pct(mu.probs.away, 0)}`}>
              <CountUp value={mu.probs.away * 100} decimals={0} suffix="%" duration={0.8} />
            </div>
          </div>
        </div>

        {/* W/D/L bar */}
        <SegmentedBar
          className="mt-6"
          height={10}
          segments={[
            { value: mu.probs.home, color: "var(--color-accent)", label: `${home} win` },
            { value: mu.probs.draw, color: "var(--color-text-tertiary)", label: "Draw" },
            { value: mu.probs.away, color: "var(--color-info)", label: `${away} win` },
          ]}
        />
        <div className="mono mt-2 flex justify-between gap-2 text-2xs text-[var(--color-text-secondary)]">
          <span>
            <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            {home} {pct(mu.probs.home, 0)}
          </span>
          <span>
            <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--color-text-tertiary)]" />
            Draw {pct(mu.probs.draw, 0)}
          </span>
          <span>
            <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--color-info)]" />
            {away} {pct(mu.probs.away, 0)}
          </span>
        </div>
        <div className="mono mt-3 text-center text-2xs text-[var(--color-text-tertiary)]">
          expected goals <CountUp value={mu.lh} decimals={2} duration={0.6} /> –{" "}
          <CountUp value={mu.la} decimals={2} duration={0.6} />
        </div>
      </motion.div>

      {/* scoreline heatmap */}
      <motion.div variants={fadeRise} className="panel overflow-x-auto p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="display text-lg">Scoreline probabilities</h3>
          <span className="eyebrow hidden sm:block">
            rows = {home} · cols = {away}
          </span>
        </div>
        <table className="border-collapse" aria-label={`Scoreline probability grid: ${home} vs ${away}`}>
          <thead>
            <tr>
              <th scope="col" className="w-8">
                <span className="sr-only">
                  {home} goals \ {away} goals
                </span>
              </th>
              {Array.from({ length: GMAX + 1 }, (_, a) => (
                <th key={a} scope="col" className="mono px-1 pb-1 text-center text-2xs font-normal text-[var(--color-text-tertiary)]">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: GMAX + 1 }, (_, h) => (
              <tr key={h}>
                <th scope="row" className="mono pr-1 text-center text-2xs font-normal text-[var(--color-text-tertiary)]">
                  {h}
                </th>
                {Array.from({ length: GMAX + 1 }, (_, a) => {
                  const p = mu.matrix[h][a];
                  const t = p / (maxCell || 1); // 0..1 intensity vs brightest cell
                  const isMax = h === mu.likely.h && a === mu.likely.a;
                  return (
                    <td key={a} className="p-0.5">
                      <motion.div
                        animate={{
                          backgroundColor: heat(t, 0.15 + 0.55 * t),
                          color: t >= 0.62 ? heat(t) : "var(--color-text-secondary)",
                        }}
                        transition={{ duration: DUR.base }}
                        title={`${home} ${h} – ${a} ${away}: ${pct(p, 1)}`}
                        className="mono flex h-8 w-9 items-center justify-center rounded-[var(--radius-xs)] text-2xs tabular-nums sm:h-9 sm:w-11"
                        style={{
                          boxShadow: isMax ? "0 0 0 1.5px var(--color-border-strong)" : undefined,
                        }}
                      >
                        {p >= 0.01 ? Math.round(p * 100) : ""}
                      </motion.div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <Footnote>
          Cell = % chance of that exact score (Dixon-Coles). Brightest = most likely · ringed cell
          highlighted.
        </Footnote>
      </motion.div>
    </motion.div>
  );
}
