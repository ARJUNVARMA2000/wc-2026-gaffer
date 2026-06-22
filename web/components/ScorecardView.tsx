"use client";

import { motion } from "framer-motion";
import type { Leg, LedgerRow, Scorecard, ScoreMetrics } from "@/lib/data";
import { fmtDate, pct } from "@/lib/ui";
import Flag from "./Flag";

const LEGS: Leg[] = ["HOME", "DRAW", "AWAY"];
const OUTCOME_LEG: Leg[] = ["HOME", "DRAW", "AWAY"];

function usd(n: number, digits = 0): string {
  const s = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${n < 0 ? "−" : ""}$${s}`;
}

const POS = "var(--color-lime)";
const NEG = "var(--color-coral)";

// ---------------------------------------------------------------------------
// Equity sparkline
// ---------------------------------------------------------------------------
function Spark({
  data,
  baseline,
  height = 96,
}: {
  data: number[];
  baseline: number;
  height?: number;
}) {
  const W = 100; // viewBox units; scales to container width
  if (data.length === 0)
    return <div className="mono text-xs text-[var(--color-faint)]">no bets yet</div>;

  const series = [baseline, ...data];
  const lo = Math.min(...series);
  const hi = Math.max(...series);
  const pad = (hi - lo) * 0.12 || 1;
  const top = hi + pad;
  const bot = lo - pad;

  const x = (i: number) => (i / (series.length - 1 || 1)) * W;
  const y = (v: number) => height - ((v - bot) / (top - bot)) * height;

  const linePts = series.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const areaPts = `0,${height} ${linePts} ${W},${height}`;
  const baseY = y(baseline);
  const up = data[data.length - 1] >= baseline;
  const color = up ? POS : NEG;

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className="h-24 w-full"
      aria-hidden
    >
      <polyline points={areaPts} fill={color} opacity={0.1} stroke="none" />
      <line
        x1="0"
        x2={W}
        y1={baseY}
        y2={baseY}
        stroke="var(--color-line)"
        strokeWidth="0.5"
        strokeDasharray="2 2"
      />
      <motion.polyline
        points={linePts}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Accuracy verdict card
// ---------------------------------------------------------------------------
function metricRow(label: string, g: number, k: number, lowerBetter = true) {
  const gWins = lowerBetter ? g < k : g > k;
  const kWins = lowerBetter ? k < g : k > g;
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-3 py-1.5">
      <span className="eyebrow">{label}</span>
      <span
        className="mono w-16 text-right text-sm tabular-nums"
        style={{ color: gWins ? POS : "var(--color-text)" }}
      >
        {g.toFixed(3)}
      </span>
      <span
        className="mono w-16 text-right text-sm tabular-nums"
        style={{ color: kWins ? POS : "var(--color-text)" }}
      >
        {k.toFixed(3)}
      </span>
    </div>
  );
}

function AccuracyCard({
  acc,
}: {
  acc: { n: number; gaffer: ScoreMetrics; kalshi: ScoreMetrics };
}) {
  const g = acc.gaffer;
  const k = acc.kalshi;
  const gafferAhead = g.brier < k.brier;
  return (
    <div className="panel p-6">
      <div className="eyebrow flex items-center justify-between">
        <span>Forecast accuracy</span>
        <span className="text-[var(--color-faint)]">{acc.n} games</span>
      </div>
      <div
        className="display mt-3 text-2xl"
        style={{ color: gafferAhead ? POS : "var(--color-gold)" }}
      >
        {gafferAhead ? "GAFFER ahead" : "Market ahead"}
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-3 border-b hairline pb-1.5">
        <span className="eyebrow text-[var(--color-faint)]">metric</span>
        <span className="eyebrow w-16 text-right">GAFFER</span>
        <span className="eyebrow w-16 text-right">Market</span>
      </div>
      {metricRow("Brier", g.brier, k.brier)}
      {metricRow("Log-loss", g.logloss, k.logloss)}
      {metricRow("Hit rate", g.acc, k.acc, false)}
      <p className="mt-3 mono text-[0.6rem] leading-relaxed text-[var(--color-faint)]">
        Lower Brier &amp; log-loss = sharper. Market price is de-vigged to a fair probability
        first. Lime = the better of the two.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// P&L cards
// ---------------------------------------------------------------------------
function FlatCard({ pnl }: { pnl: Scorecard["pnl"]["flat"] }) {
  const up = pnl.net >= 0;
  return (
    <div className="panel p-6">
      <div className="eyebrow flex items-center justify-between">
        <span>Flat stake · with vig</span>
        <span className="text-[var(--color-faint)]">{usd(pnl.staked)} risked</span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="display text-[3.2rem] leading-none" style={{ color: up ? POS : NEG }}>
          {up ? "+" : "−"}
          {usd(Math.abs(pnl.net)).replace("$", "$")}
        </span>
      </div>
      <div className="mono mt-1 text-sm" style={{ color: up ? POS : NEG }}>
        {(pnl.roi * 100).toFixed(1)}% ROI
      </div>
      <Spark data={pnl.curve} baseline={0} />
      <div className="mt-2 grid grid-cols-2 gap-3 border-t hairline pt-3">
        <div>
          <div className="mono text-sm text-[var(--color-text)]">
            {pnl.wins}–{pnl.nBets - pnl.wins}
          </div>
          <div className="eyebrow mt-1">Record</div>
        </div>
        <div>
          <div className="mono text-sm text-[var(--color-text)]">{pct(pnl.winRate, 0)}</div>
          <div className="eyebrow mt-1">Hit rate</div>
        </div>
      </div>
    </div>
  );
}

function KellyCard({
  pnl,
  fraction,
}: {
  pnl: Scorecard["pnl"]["kelly"];
  fraction: number;
}) {
  const up = pnl.final >= pnl.start;
  return (
    <div className="panel p-6">
      <div className="eyebrow flex items-center justify-between">
        <span>Kelly bankroll · with vig</span>
        <span className="text-[var(--color-faint)]">{fraction}× Kelly</span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="display text-[3.2rem] leading-none" style={{ color: up ? POS : NEG }}>
          {usd(pnl.final)}
        </span>
      </div>
      <div className="mono mt-1 text-sm text-[var(--color-muted)]">
        from {usd(pnl.start)} ·{" "}
        <span style={{ color: up ? POS : NEG }}>
          {up ? "+" : ""}
          {(pnl.roi * 100).toFixed(1)}%
        </span>
      </div>
      <Spark data={pnl.curve} baseline={pnl.start} />
      <p className="mt-2 mono text-[0.6rem] leading-relaxed text-[var(--color-faint)]">
        Compounds a {usd(pnl.start)} bankroll, sizing each bet by {fraction}× the Kelly edge.
        Sensitive to model overconfidence &amp; thin liquidity — treat as a ceiling.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------
function ProbBar({
  probs,
  outcome,
}: {
  probs: Record<Leg, number>;
  outcome: number;
}) {
  const colors: Record<Leg, string> = {
    HOME: "var(--color-lime)",
    DRAW: "var(--color-faint)",
    AWAY: "var(--color-cyan)",
  };
  const winLeg = OUTCOME_LEG[outcome];
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full">
      {LEGS.map((L) => (
        <div
          key={L}
          style={{
            width: `${probs[L] * 100}%`,
            background: colors[L],
            opacity: L === winLeg ? 1 : 0.4,
          }}
        />
      ))}
    </div>
  );
}

function LedgerCard({ row, i }: { row: LedgerRow; i: number }) {
  const winLeg = OUTCOME_LEG[row.outcome];
  const resultLabel = winLeg === "HOME" ? row.home : winLeg === "AWAY" ? row.away : "Draw";
  const market = row.devig ?? {
    HOME: row.market.HOME.mid ?? 0,
    DRAW: row.market.DRAW.mid ?? 0,
    AWAY: row.market.AWAY.mid ?? 0,
  };
  const bet = row.bet;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.25) }}
      className="panel row-glow grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[minmax(220px,1.2fr)_1.4fr_auto] md:items-center md:gap-6"
    >
      {/* match */}
      <div className="flex items-center gap-3">
        <span className="mono w-10 shrink-0 text-[0.62rem] text-[var(--color-faint)]">
          {fmtDate(row.date)}
        </span>
        <div className="flex items-center gap-2">
          <Flag iso={row.homeIso} name={row.home} size={22} />
          <span className="mono text-sm font-semibold tabular-nums">
            {row.homeScore}
            <span className="px-1 text-[var(--color-faint)]">–</span>
            {row.awayScore}
          </span>
          <Flag iso={row.awayIso} name={row.away} size={22} />
        </div>
        <span
          className="chip ml-auto md:ml-0"
          style={{ color: "var(--color-gold)", borderColor: "var(--color-line)" }}
        >
          {resultLabel}
        </span>
      </div>

      {/* probability comparison */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="mono w-14 text-[0.58rem] uppercase tracking-wider text-[var(--color-lime)]">
            GAFFER
          </span>
          <ProbBar probs={row.gaffer} outcome={row.outcome} />
          <span className="mono w-10 text-right text-[0.62rem] text-[var(--color-muted)]">
            {pct(row.gaffer[winLeg], 0)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="mono w-14 text-[0.58rem] uppercase tracking-wider text-[var(--color-muted)]">
            Market
          </span>
          <ProbBar probs={market} outcome={row.outcome} />
          <span className="mono w-10 text-right text-[0.62rem] text-[var(--color-muted)]">
            {pct(market[winLeg], 0)}
          </span>
        </div>
      </div>

      {/* bet */}
      <div className="flex items-center justify-between gap-4 md:flex-col md:items-end md:gap-1">
        {bet ? (
          <>
            <div className="mono text-[0.62rem] text-[var(--color-muted)]">
              {bet.leg === "HOME" ? row.home : bet.leg === "AWAY" ? row.away : "Draw"} @{" "}
              {bet.ask.toFixed(2)} · edge +{(bet.edge * 100).toFixed(1)}%
            </div>
            <div
              className="mono text-sm font-semibold tabular-nums"
              style={{ color: bet.netFlat >= 0 ? POS : NEG }}
            >
              {bet.netFlat >= 0 ? "+" : "−"}
              {usd(Math.abs(bet.netFlat))}
            </div>
          </>
        ) : (
          <span className="mono text-[0.62rem] text-[var(--color-faint)]">no edge · pass</span>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export default function ScorecardView({ sc }: { sc: Scorecard }) {
  const { meta, accuracy, pnl, ledger } = sc;

  if (!accuracy || meta.nScored === 0) {
    return (
      <div className="panel p-10 text-center">
        <div className="display text-2xl text-[var(--color-text)]">Not enough games yet</div>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          The scorecard needs group matches that we logged a pre-match prediction for and that
          Kalshi also priced. Check back as the tournament plays out.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <AccuracyCard acc={accuracy} />
        <FlatCard pnl={pnl.flat} />
        <KellyCard pnl={pnl.kelly} fraction={meta.kellyFraction} />
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="eyebrow">Match by match</div>
            <h2 className="display mt-2 text-2xl sm:text-3xl">The ledger</h2>
          </div>
          <span className="mono text-[0.62rem] text-[var(--color-faint)]">
            our odds vs the market · the actual result is the bright segment
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {ledger.map((row, i) => (
            <LedgerCard key={`${row.home}-${row.away}-${row.date}`} row={row} i={i} />
          ))}
        </div>
      </section>

      <p className="mono text-[0.62rem] leading-relaxed text-[var(--color-faint)]">
        {meta.nScored} of {meta.nPlayed} played group games scored · {meta.skipped.noPrediction}{" "}
        had no logged pre-match prediction (games before we started snapshotting) ·{" "}
        {meta.skipped.noMarket} had no Kalshi market. Bets are placed at the single largest GAFFER
        edge per game when it clears {(meta.edgeMin * 100).toFixed(0)}%, entered at Kalshi&apos;s
        pre-match ask. Accuracy compares de-vigged probabilities; P&amp;L uses the raw,
        vig-inclusive ask — the honest cost of actually trading.
      </p>
    </div>
  );
}
