"use client";

import { useMemo, useState } from "react";
import type { ModelParams, Team } from "@/lib/data";
import { heatColor, pct } from "@/lib/ui";
import { matchup } from "@/lib/model";
import Flag from "./Flag";

const GMAX = 6; // display 0..6 goals each side

export default function HeadToHead({ params, teams }: { params: ModelParams; teams: Team[] }) {
  const order = useMemo(() => [...teams].sort((a, b) => b.champion - a.champion), [teams]);
  const iso = useMemo(() => new Map(teams.map((t) => [t.name, t.iso])), [teams]);
  const [home, setHome] = useState(order[0]?.name ?? teams[0].name);
  const [away, setAway] = useState(order[1]?.name ?? teams[1].name);
  const [venue, setVenue] = useState<"neutral" | "home" | "away">("neutral");

  const host = venue === "home" ? "home" : venue === "away" ? "away" : null;
  const mu = useMemo(() => matchup(params, home, away, host), [params, home, away, host]);

  const maxCell = useMemo(() => {
    let mx = 0;
    for (let h = 0; h <= GMAX; h++) for (let a = 0; a <= GMAX; a++) mx = Math.max(mx, mu.matrix[h][a]);
    return mx;
  }, [mu]);

  const Picker = ({ value, set, label }: { value: string; set: (v: string) => void; label: string }) => (
    <div className="flex items-center gap-3">
      <Flag iso={iso.get(value) ?? "un"} name={value} size={32} />
      <select
        value={value}
        onChange={(e) => set(e.target.value)}
        aria-label={label}
        className="mono w-full rounded-lg border hairline bg-[var(--color-ink2)] px-3 py-2 text-sm text-[var(--color-text)]"
      >
        {order.map((t) => (
          <option key={t.name} value={t.name}>{t.name}</option>
        ))}
      </select>
    </div>
  );

  const wdl = [
    { label: home, p: mu.probs.home, color: "var(--color-lime)" },
    { label: "Draw", p: mu.probs.draw, color: "var(--color-faint)" },
    { label: away, p: mu.probs.away, color: "var(--color-cyan)" },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* pickers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <Picker value={home} set={setHome} label="Home team" />
        <button
          onClick={() => { const h = home; setHome(away); setAway(h); }}
          className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border hairline text-[var(--color-muted)] hover:text-[var(--color-lime)]"
          aria-label="Swap teams"
        >
          ⇄
        </button>
        <Picker value={away} set={setAway} label="Away team" />
      </div>

      {/* venue toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">Venue</span>
        {([["neutral", "Neutral"], ["home", `${home} home`], ["away", `${away} home`]] as const).map(([v, lbl]) => (
          <button key={v} onClick={() => setVenue(v)} className="chip"
            style={{ color: venue === v ? "#07090d" : "var(--color-muted)", background: venue === v ? "var(--color-lime)" : "transparent", borderColor: venue === v ? "transparent" : "var(--color-line)" }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* summary */}
      <div className="panel p-6">
        <div className="flex items-end justify-center gap-6">
          <div className="text-center">
            <Flag iso={iso.get(home) ?? "un"} name={home} size={44} />
            <div className="display mt-2 text-xl">{pct(mu.probs.home, 0)}</div>
          </div>
          <div className="pb-2 text-center">
            <div className="eyebrow">most likely</div>
            <div className="display text-4xl text-[var(--color-text)]">
              {mu.likely.h}<span className="px-2 text-[var(--color-faint)]">–</span>{mu.likely.a}
            </div>
            <div className="mono text-[0.62rem] text-[var(--color-muted)]">{pct(mu.likely.p, 0)} · draw {pct(mu.probs.draw, 0)}</div>
          </div>
          <div className="text-center">
            <Flag iso={iso.get(away) ?? "un"} name={away} size={44} />
            <div className="display mt-2 text-xl">{pct(mu.probs.away, 0)}</div>
          </div>
        </div>
        {/* W/D/L bar */}
        <div className="mt-6 flex h-3 w-full overflow-hidden rounded-full">
          {wdl.map((w) => <div key={w.label} style={{ width: `${w.p * 100}%`, background: w.color }} />)}
        </div>
        <div className="mono mt-2 flex justify-between text-[0.62rem] text-[var(--color-muted)]">
          <span>{home} {pct(mu.probs.home, 0)}</span>
          <span>Draw {pct(mu.probs.draw, 0)}</span>
          <span>{away} {pct(mu.probs.away, 0)}</span>
        </div>
        <div className="mono mt-3 text-center text-[0.62rem] text-[var(--color-faint)]">
          expected goals {mu.lh.toFixed(2)} – {mu.la.toFixed(2)}
        </div>
      </div>

      {/* scoreline heatmap */}
      <div className="panel overflow-x-auto p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="display text-lg">Scoreline probabilities</h3>
          <span className="eyebrow hidden sm:block">rows = {home} · cols = {away}</span>
        </div>
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="w-8" />
              {Array.from({ length: GMAX + 1 }, (_, a) => (
                <th key={a} className="mono px-1 pb-1 text-center text-[0.6rem] text-[var(--color-faint)]">{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: GMAX + 1 }, (_, h) => (
              <tr key={h}>
                <td className="mono pr-1 text-center text-[0.6rem] text-[var(--color-faint)]">{h}</td>
                {Array.from({ length: GMAX + 1 }, (_, a) => {
                  const p = mu.matrix[h][a];
                  const isMax = h === mu.likely.h && a === mu.likely.a;
                  return (
                    <td key={a} className="p-0.5">
                      <div
                        className="flex h-8 w-9 items-center justify-center rounded-[4px] mono text-[0.55rem] tabular-nums sm:h-9 sm:w-11"
                        style={{
                          background: `${heatColor(p / (maxCell || 1))}${isMax ? "" : "33"}`,
                          color: isMax || p / (maxCell || 1) > 0.6 ? "#07090d" : "var(--color-muted)",
                          outline: isMax ? "1.5px solid var(--color-lime)" : "none",
                        }}
                      >
                        {p >= 0.01 ? Math.round(p * 100) : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 mono text-[0.6rem] text-[var(--color-faint)]">
          Cell = % chance of that exact score (Dixon-Coles). Brightest = most likely · outlined cell highlighted.
        </p>
      </div>
    </div>
  );
}
