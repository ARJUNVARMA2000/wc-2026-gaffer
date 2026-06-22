"use client";

import { useMemo, useState } from "react";
import type { History, RatingsHistory, Team } from "@/lib/data";
import { pct } from "@/lib/ui";
import LineChart, { Series } from "./LineChart";
import Flag from "./Flag";

const ms = (date: string) => new Date(date + "T00:00:00Z").getTime();

const ODDS: { key: "c" | "f" | "s" | "q" | "r"; label: string; color: string }[] = [
  { key: "c", label: "Win", color: "var(--color-gold)" },
  { key: "f", label: "Final", color: "var(--color-lime)" },
  { key: "s", label: "Semis", color: "var(--color-cyan)" },
  { key: "q", label: "Quarters", color: "#5b8cff" },
  { key: "r", label: "Last 16", color: "var(--color-muted)" },
];

const RACE_PALETTE = [
  "#c8ff3c", "#ffc24b", "#54d2ff", "#5b8cff", "#ff8a3d",
  "#b07cff", "#2fd6a6", "#ff5d6c", "#ffce3a", "#9aa4b2",
];

export default function TrendsView({
  teams,
  history,
  ratings,
}: {
  teams: Team[];
  history: History;
  ratings: RatingsHistory;
}) {
  const byChampion = useMemo(() => [...teams].sort((a, b) => b.champion - a.champion), [teams]);
  const iso = useMemo(() => new Map(teams.map((t) => [t.name, t.iso])), [teams]);
  const [sel, setSel] = useState(byChampion[0]?.name ?? teams[0].name);
  const [race, setRace] = useState<string[]>(byChampion.slice(0, 6).map((t) => t.name));

  const snaps = history.snapshots;

  const oddsSeries: Series[] = ODDS.map((o) => ({
    key: o.key,
    label: o.label,
    color: o.color,
    points: snaps
      .filter((s) => s.teams[sel])
      .map((s) => ({ x: ms(s.date), y: s.teams[sel][o.key] })),
  })).filter((s) => s.points.length > 0);

  const eloSeries: Series[] = [
    {
      key: "elo",
      label: sel,
      color: "var(--color-lime)",
      points: (ratings[sel] ?? []).map((p) => ({ x: ms(p.d), y: p.e })),
    },
  ].filter((s) => s.points.length > 0);

  const raceSeries: Series[] = race.map((name, i) => ({
    key: name,
    label: name,
    color: RACE_PALETTE[i % RACE_PALETTE.length],
    points: snaps.filter((s) => s.teams[name]).map((s) => ({ x: ms(s.date), y: s.teams[name].c })),
  }));

  const sparse = snaps.length < 3;

  return (
    <div className="flex flex-col gap-14">
      {/* ---- team picker ---- */}
      <section>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={sel}
            onChange={(e) => setSel(e.target.value)}
            className="mono rounded-lg border hairline bg-[var(--color-ink2)] px-3 py-2 text-sm text-[var(--color-text)]"
          >
            {byChampion.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1.5">
            {byChampion.slice(0, 8).map((t) => (
              <button
                key={t.name}
                onClick={() => setSel(t.name)}
                className="chip transition-colors"
                style={{
                  color: sel === t.name ? "#07090d" : "var(--color-muted)",
                  background: sel === t.name ? "var(--color-lime)" : "transparent",
                  borderColor: sel === t.name ? "transparent" : "var(--color-line)",
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <h3 className="display text-lg">{sel} · odds over time</h3>
              <div className="flex items-center gap-3">
                {ODDS.map((o) => (
                  <span key={o.key} className="mono text-[0.58rem]" style={{ color: o.color }}>
                    ● {o.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3">
              {oddsSeries.length ? (
                <LineChart series={oddsSeries} yFormat={(v) => pct(v, 0)} yZero height={260} />
              ) : (
                <Empty />
              )}
            </div>
          </div>

          <div className="panel p-5">
            <h3 className="display text-lg">{sel} · Elo rating</h3>
            <div className="mt-3">
              {eloSeries[0]?.points.length ? (
                <LineChart series={eloSeries} yFormat={(v) => v.toFixed(0)} height={260} />
              ) : (
                <Empty />
              )}
            </div>
          </div>
        </div>
        {sparse && (
          <p className="mt-3 mono text-[0.62rem] text-[var(--color-faint)]">
            Odds history begins at launch and thickens each match-day — Elo runs back to 2019.
          </p>
        )}
      </section>

      {/* ---- title race ---- */}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="eyebrow">Championship odds over time</div>
            <h2 className="display mt-2 text-3xl">The title race</h2>
          </div>
          <div className="flex items-center gap-2">
            <select
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v && !race.includes(v)) setRace([...race, v]);
              }}
              className="mono rounded-lg border hairline bg-[var(--color-ink2)] px-3 py-2 text-xs text-[var(--color-muted)]"
            >
              <option value="">+ add team…</option>
              {byChampion.filter((t) => !race.includes(t.name)).map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {race.map((name, i) => (
            <button
              key={name}
              onClick={() => setRace(race.filter((n) => n !== name))}
              className="chip flex items-center gap-1.5"
              style={{ color: "#07090d", background: RACE_PALETTE[i % RACE_PALETTE.length], borderColor: "transparent" }}
            >
              {name} <span className="opacity-70">✕</span>
            </button>
          ))}
        </div>
        <div className="panel p-5">
          {raceSeries.some((s) => s.points.length) ? (
            <LineChart series={raceSeries} yFormat={(v) => pct(v, 0)} yZero height={320} />
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

function Empty() {
  return (
    <div className="flex h-40 items-center justify-center mono text-xs text-[var(--color-faint)]">
      not enough history yet — check back as matches are played
    </div>
  );
}

function Movers({ history, iso }: { history: History; iso: Map<string, string> }) {
  const [since, setSince] = useState<"sinceStart" | "sinceLast">("sinceStart");
  const [metric, setMetric] = useState<"champ" | "elo">("champ");
  const set = history.movers[since][metric];
  const fmt = (v: number) => (metric === "champ" ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%` : `${v >= 0 ? "+" : ""}${v.toFixed(0)}`);

  const Col = ({ rows, up }: { rows: typeof set.risers; up: boolean }) => (
    <div className="panel p-5">
      <div className="eyebrow mb-3" style={{ color: up ? "var(--color-lime)" : "var(--color-coral)" }}>
        {up ? "▲ Risers" : "▼ Fallers"}
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.length === 0 && <span className="mono text-xs text-[var(--color-faint)]">no movement yet</span>}
        {rows.map((m) => (
          <div key={m.name} className="flex items-center gap-3">
            <Flag iso={iso.get(m.name) ?? "un"} name={m.name} size={20} />
            <span className="flex-1 truncate text-sm">{m.name}</span>
            <span className="mono text-xs tabular-nums" style={{ color: up ? "var(--color-lime)" : "var(--color-coral)" }}>
              {fmt(m.delta)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">Biggest movers</div>
          <h2 className="display mt-2 text-3xl">Risers &amp; fallers</h2>
        </div>
        <div className="flex gap-2">
          {(["sinceStart", "sinceLast"] as const).map((s) => (
            <button key={s} onClick={() => setSince(s)} className="chip"
              style={{ color: since === s ? "#07090d" : "var(--color-muted)", background: since === s ? "var(--color-lime)" : "transparent", borderColor: since === s ? "transparent" : "var(--color-line)" }}>
              {s === "sinceStart" ? "Since start" : "Since last update"}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-[var(--color-line)]" />
          {(["champ", "elo"] as const).map((mt) => (
            <button key={mt} onClick={() => setMetric(mt)} className="chip"
              style={{ color: metric === mt ? "#07090d" : "var(--color-muted)", background: metric === mt ? "var(--color-cyan)" : "transparent", borderColor: metric === mt ? "transparent" : "var(--color-line)" }}>
              {mt === "champ" ? "Title odds" : "Elo"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Col rows={set.risers} up />
        <Col rows={set.fallers} up={false} />
      </div>
    </section>
  );
}
