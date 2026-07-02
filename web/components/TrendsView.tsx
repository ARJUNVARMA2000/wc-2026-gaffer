"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { History, Mover, RatingsHistory, Team } from "@/lib/types";
import { useLiveData } from "@/lib/live";
import { CHART_PALETTE, pct } from "@/lib/ui";
import { fadeRise, SPRING, staggerChildren } from "@/lib/motion";
import TrendChart, { type TrendSeries } from "@/components/ui/TrendChart";
import { SectionHeader } from "@/components/ui/PageHeader";
import Chip from "@/components/ui/Chip";
import Select from "@/components/ui/Select";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Footnote from "@/components/ui/Footnote";
import Flag from "./Flag";

const ms = (date: string) => new Date(date + "T00:00:00Z").getTime();

const ODDS: { key: "c" | "f" | "s" | "q" | "r"; label: string; color: string }[] = [
  { key: "c", label: "Win", color: "var(--color-warning)" },
  { key: "f", label: "Final", color: "var(--color-accent)" },
  { key: "s", label: "Semis", color: "var(--color-info)" },
  { key: "q", label: "Quarters", color: "var(--color-positive)" },
  { key: "r", label: "Last 16", color: "var(--color-text-secondary)" },
];

export default function TrendsView({
  teams: initialTeams,
  history: initialHistory,
  ratings: initialRatings,
}: {
  teams: Team[];
  history: History;
  ratings: RatingsHistory;
}) {
  const teams = useLiveData("teams", initialTeams);
  const history = useLiveData("history", initialHistory);
  const ratings = useLiveData("ratings_history", initialRatings);

  const byChampion = useMemo(() => [...teams].sort((a, b) => b.champion - a.champion), [teams]);
  const iso = useMemo(() => new Map(teams.map((t) => [t.name, t.iso])), [teams]);
  const [sel, setSel] = useState(byChampion[0]?.name ?? teams[0].name);
  const [race, setRace] = useState<string[]>(byChampion.slice(0, 6).map((t) => t.name));

  const snaps = history.snapshots;

  const oddsSeries: TrendSeries[] = ODDS.map((o) => ({
    key: o.key,
    label: o.label,
    color: o.color,
    points: snaps
      .filter((s) => s.teams[sel])
      .map((s) => ({ x: ms(s.date), y: s.teams[sel][o.key] })),
  })).filter((s) => s.points.length > 0);

  const eloSeries: TrendSeries[] = [
    {
      key: "elo",
      label: sel,
      color: "var(--color-accent)",
      points: (ratings[sel] ?? []).map((p) => ({ x: ms(p.d), y: p.e })),
    },
  ].filter((s) => s.points.length > 0);

  const raceSeries: TrendSeries[] = race.map((name, i) => ({
    key: name,
    label: name,
    color: CHART_PALETTE[i % CHART_PALETTE.length],
    points: snaps.filter((s) => s.teams[name]).map((s) => ({ x: ms(s.date), y: s.teams[name].c })),
  }));

  const sparse = snaps.length < 3;

  return (
    <div className="flex flex-col gap-14">
      {/* ---- team picker + per-team charts ---- */}
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select value={sel} onChange={setSel} label="Choose a team">
            {byChampion.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </Select>
          <div className="flex flex-wrap gap-1.5">
            {byChampion.slice(0, 8).map((t) => (
              <Chip key={t.name} active={sel === t.name} onClick={() => setSel(t.name)}>
                {t.name}
              </Chip>
            ))}
          </div>
        </div>

        <motion.div
          variants={staggerChildren()}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        >
          <motion.div variants={fadeRise} className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <h3 className="display text-lg">{sel} · odds over time</h3>
              <div className="flex flex-wrap items-center gap-3">
                {ODDS.map((o) => (
                  <Swatch key={o.key} color={o.color} label={o.label} />
                ))}
              </div>
            </div>
            <div className="mt-3">
              {oddsSeries.length ? (
                <TrendChart
                  series={oddsSeries}
                  yFormat={(v) => pct(v, 0)}
                  yZero
                  height={260}
                  ariaLabel={`${sel} — win, final, semifinal, quarterfinal and last-16 odds over time`}
                />
              ) : (
                <Empty />
              )}
            </div>
          </motion.div>

          <motion.div variants={fadeRise} className="panel p-5">
            <h3 className="display text-lg">{sel} · Elo rating</h3>
            <div className="mt-3">
              {eloSeries[0]?.points.length ? (
                <TrendChart
                  series={eloSeries}
                  area
                  yFormat={(v) => v.toFixed(0)}
                  height={260}
                  ariaLabel={`${sel} Elo rating history since 2019`}
                />
              ) : (
                <Empty />
              )}
            </div>
          </motion.div>
        </motion.div>
        {sparse && (
          <Footnote>
            Odds history begins at launch and thickens each match-day — Elo runs back to 2019.
          </Footnote>
        )}
      </section>

      {/* ---- title race ---- */}
      <section>
        <div className="mb-4">
          <SectionHeader
            eyebrow="Championship odds over time"
            title="The title race"
            right={
              <Select
                value=""
                onChange={(v) => {
                  if (v && !race.includes(v)) setRace([...race, v]);
                }}
                label="Add a team to the title race"
              >
                <option value="">+ add team…</option>
                {byChampion
                  .filter((t) => !race.includes(t.name))
                  .map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
              </Select>
            }
          />
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          <AnimatePresence mode="popLayout" initial={false}>
            {race.map((name, i) => (
              <motion.span
                key={name}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={SPRING.snappy}
              >
                <Chip
                  active
                  color={CHART_PALETTE[i % CHART_PALETTE.length]}
                  onClick={() => setRace(race.filter((n) => n !== name))}
                  title={`Remove ${name} from the race`}
                >
                  {name}{" "}
                  <span aria-hidden className="opacity-70">
                    ×
                  </span>
                </Chip>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
        <div className="panel p-5">
          {raceSeries.some((s) => s.points.length) ? (
            <TrendChart
              series={raceSeries}
              yFormat={(v) => pct(v, 0)}
              yZero
              height={320}
              ariaLabel="Title odds over time for the teams in the race"
            />
          ) : (
            <Empty />
          )}
        </div>
      </section>

      {/* ---- risers & fallers ---- */}
      <Movers history={history} iso={iso} />
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="mono flex items-center gap-1.5 text-2xs text-[var(--color-text-secondary)]">
      <span
        aria-hidden
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function Empty() {
  return (
    <div className="mono flex h-40 items-center justify-center text-xs text-[var(--color-text-tertiary)]">
      not enough history yet — check back as matches are played
    </div>
  );
}

function MoverCol({
  rows,
  up,
  iso,
  fmt,
}: {
  rows: Mover[];
  up: boolean;
  iso: Map<string, string>;
  fmt: (v: number) => string;
}) {
  const col = up ? "var(--color-positive)" : "var(--color-negative)";
  return (
    <motion.div variants={fadeRise} className="panel p-5">
      <div className="eyebrow mb-3" style={{ color: col }}>
        {up ? "▲ Risers" : "▼ Fallers"}
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.length === 0 && (
          <span className="mono text-xs text-[var(--color-text-tertiary)]">no movement yet</span>
        )}
        <AnimatePresence mode="popLayout" initial={false}>
          {rows.map((mv) => (
            <motion.div
              key={mv.name}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={SPRING.snappy}
              className="flex items-center gap-3"
            >
              <Flag iso={iso.get(mv.name) ?? "un"} name={mv.name} size={20} decorative />
              <span className="flex-1 truncate text-sm">{mv.name}</span>
              <span
                className="mono text-xs tabular-nums"
                style={{ color: col }}
                aria-label={`${mv.name} ${up ? "up" : "down"} ${fmt(mv.delta)}`}
              >
                {fmt(mv.delta)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Movers({ history, iso }: { history: History; iso: Map<string, string> }) {
  const [since, setSince] = useState<"sinceStart" | "sinceLast">("sinceStart");
  const [metric, setMetric] = useState<"champ" | "elo">("champ");
  const set = history.movers[since][metric];
  const fmt = (v: number) =>
    metric === "champ"
      ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`
      : `${v >= 0 ? "+" : ""}${v.toFixed(0)}`;

  return (
    <section>
      <div className="mb-4">
        <SectionHeader
          eyebrow="Biggest movers"
          title={<>Risers &amp; fallers</>}
          right={
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                options={[
                  { value: "sinceStart", label: "Since start" },
                  { value: "sinceLast", label: "Since last" },
                ]}
                value={since}
                onChange={setSince}
                label="Movement window"
              />
              <SegmentedControl
                options={[
                  { value: "champ", label: "Title odds" },
                  { value: "elo", label: "Elo" },
                ]}
                value={metric}
                onChange={setMetric}
                label="Movement metric"
              />
            </div>
          }
        />
      </div>
      <motion.div
        variants={staggerChildren()}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <MoverCol rows={set.risers} up iso={iso} fmt={fmt} />
        <MoverCol rows={set.fallers} up={false} iso={iso} fmt={fmt} />
      </motion.div>
    </section>
  );
}
