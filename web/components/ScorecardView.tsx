"use client";

import { motion } from "framer-motion";
import type { Leg, LedgerRow, Scorecard, ScoreMetrics } from "@/lib/types";
import { useLiveData } from "@/lib/live";
import { fmtDate, pct } from "@/lib/ui";
import { fadeRise, staggerChildren } from "@/lib/motion";
import TrendChart from "@/components/ui/TrendChart";
import { SectionHeader } from "@/components/ui/PageHeader";
import Chip from "@/components/ui/Chip";
import HeatPill from "@/components/ui/HeatPill";
import { SegmentedBar } from "@/components/ui/Bar";
import StatCard from "@/components/ui/StatCard";
import Footnote from "@/components/ui/Footnote";
import CountUp from "./CountUp";
import Flag from "./Flag";

const LEGS: Leg[] = ["HOME", "DRAW", "AWAY"];

const POS = "var(--color-positive)";
const NEG = "var(--color-negative)";

const CARD_HOVER = "panel transition-shadow duration-150 hover:shadow-[var(--shadow-raised)]";

function usd(n: number, digits = 0): string {
  const s = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${n < 0 ? "−" : ""}$${s}`;
}

// ---------------------------------------------------------------------------
// Equity curve (TrendChart sparkline mode)
// ---------------------------------------------------------------------------
function Equity({ curve, baseline, label }: { curve: number[]; baseline: number; label: string }) {
  if (curve.length === 0) {
    return (
      <div className="mono flex h-24 items-center text-xs text-[var(--color-text-tertiary)]">
        no bets yet
      </div>
    );
  }
  const up = curve[curve.length - 1] >= baseline;
  const color = up ? POS : NEG;
  return (
    <TrendChart
      sparkline
      area
      height={96}
      baseline={baseline}
      series={[
        {
          key: "equity",
          label,
          color,
          points: [baseline, ...curve].map((y, x) => ({ x, y })),
        },
      ]}
      ariaLabel={`${label} equity curve over ${curve.length} bets, ${up ? "above" : "below"} break-even`}
    />
  );
}

// ---------------------------------------------------------------------------
// Accuracy verdict card
// ---------------------------------------------------------------------------
function MetricRow({
  label,
  g,
  k,
  lowerBetter = true,
}: {
  label: string;
  g: number;
  k: number;
  lowerBetter?: boolean;
}) {
  const gWins = lowerBetter ? g < k : g > k;
  const kWins = lowerBetter ? k < g : k > g;
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-3 py-1.5">
      <span className="eyebrow">{label}</span>
      <span
        className="mono w-16 text-right text-sm tabular-nums"
        style={{ color: gWins ? POS : "var(--color-text-primary)" }}
      >
        {g.toFixed(3)}
      </span>
      <span
        className="mono w-16 text-right text-sm tabular-nums"
        style={{ color: kWins ? POS : "var(--color-text-primary)" }}
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
    <motion.div variants={fadeRise} whileHover={{ y: -2 }} className={`${CARD_HOVER} p-6`}>
      <div className="eyebrow flex items-center justify-between">
        <span>Forecast accuracy</span>
        <span className="text-[var(--color-text-tertiary)]">{acc.n} games</span>
      </div>
      <div
        className="display mt-3 text-2xl"
        style={{ color: gafferAhead ? POS : "var(--color-warning)" }}
      >
        {gafferAhead ? "GAFFER ahead" : "Market ahead"}
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-3 border-b border-[var(--color-border)] pb-1.5">
        <span className="eyebrow text-[var(--color-text-tertiary)]">metric</span>
        <span className="eyebrow w-16 text-right">GAFFER</span>
        <span className="eyebrow w-16 text-right">Market</span>
      </div>
      <MetricRow label="Brier" g={g.brier} k={k.brier} />
      <MetricRow label="Log-loss" g={g.logloss} k={k.logloss} />
      <MetricRow label="Hit rate" g={g.acc} k={k.acc} lowerBetter={false} />
      <Footnote className="leading-relaxed">
        Lower Brier &amp; log-loss = sharper. Market price is de-vigged to a fair probability
        first. Green marks the better of the two.
      </Footnote>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// P&L cards
// ---------------------------------------------------------------------------
function FlatCard({ pnl }: { pnl: Scorecard["pnl"]["flat"] }) {
  const up = pnl.net >= 0;
  const col = up ? POS : NEG;
  return (
    <motion.div variants={fadeRise} whileHover={{ y: -2 }} className={`${CARD_HOVER} p-6`}>
      <div className="eyebrow flex items-center justify-between">
        <span>Flat stake · with vig</span>
        <span className="text-[var(--color-text-tertiary)]">{usd(pnl.staked)} risked</span>
      </div>
      <div className="display mt-3 text-4xl" style={{ color: col }}>
        <CountUp value={Math.abs(pnl.net)} prefix={up ? "+$" : "−$"} decimals={0} />
      </div>
      <div className="mono mt-1 text-sm" style={{ color: col }}>
        <CountUp value={pnl.roi * 100} decimals={1} suffix="% ROI" />
      </div>
      <div className="mt-3">
        <Equity curve={pnl.curve} baseline={0} label="Flat-stake P&L" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-3">
        <motion.div variants={fadeRise}>
          <div className="display text-2xl text-[var(--color-text-primary)]">
            <CountUp value={pnl.wins} decimals={0} />
            <span className="px-0.5 text-[var(--color-text-tertiary)]">–</span>
            <CountUp value={pnl.nBets - pnl.wins} decimals={0} />
          </div>
          <div className="eyebrow mt-1.5">Record</div>
        </motion.div>
        <StatCard label="Hit rate" value={pnl.winRate * 100} decimals={0} suffix="%" />
      </div>
    </motion.div>
  );
}

function KellyCard({ pnl, fraction }: { pnl: Scorecard["pnl"]["kelly"]; fraction: number }) {
  const up = pnl.final >= pnl.start;
  const col = up ? POS : NEG;
  return (
    <motion.div variants={fadeRise} whileHover={{ y: -2 }} className={`${CARD_HOVER} p-6`}>
      <div className="eyebrow flex items-center justify-between">
        <span>Kelly bankroll · with vig</span>
        <span className="text-[var(--color-text-tertiary)]">{fraction}× Kelly</span>
      </div>
      <div className="display mt-3 text-4xl" style={{ color: col }}>
        <CountUp value={pnl.final} prefix="$" decimals={0} />
      </div>
      <div className="mono mt-1 text-sm text-[var(--color-text-secondary)]">
        from {usd(pnl.start)} ·{" "}
        <span style={{ color: col }}>
          {up ? "+" : ""}
          {(pnl.roi * 100).toFixed(1)}%
        </span>
      </div>
      <div className="mt-3">
        <Equity curve={pnl.curve} baseline={pnl.start} label="Kelly bankroll" />
      </div>
      <Footnote className="leading-relaxed">
        Compounds a {usd(pnl.start)} bankroll, sizing each bet by {fraction}× the Kelly edge.
        Sensitive to model overconfidence &amp; thin liquidity — treat as a ceiling.
      </Footnote>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------
const LEG_COLOR: Record<Leg, string> = {
  HOME: "var(--color-accent)",
  DRAW: "var(--color-text-tertiary)",
  AWAY: "var(--color-info)",
};
const LEG_LABEL: Record<Leg, string> = { HOME: "Home", DRAW: "Draw", AWAY: "Away" };

function ProbRow({
  label,
  labelColor,
  probs,
  outcome,
}: {
  label: string;
  labelColor: string;
  probs: Record<Leg, number>;
  outcome: number;
}) {
  const winLeg = LEGS[outcome];
  return (
    <div className="flex items-center gap-3">
      <span
        className="mono w-14 shrink-0 text-2xs uppercase tracking-wider"
        style={{ color: labelColor }}
      >
        {label}
      </span>
      <SegmentedBar
        height={8}
        className="flex-1"
        segments={LEGS.map((L) => ({
          value: probs[L],
          color:
            L === winLeg
              ? LEG_COLOR[L]
              : `color-mix(in oklab, ${LEG_COLOR[L]} 35%, transparent)`,
          label: `${LEG_LABEL[L]} ${pct(probs[L], 0)}`,
        }))}
      />
      <HeatPill p={probs[winLeg]} digits={0} className="shrink-0" />
    </div>
  );
}

function LedgerCard({ row }: { row: LedgerRow }) {
  const winLeg = LEGS[row.outcome];
  const resultLabel = winLeg === "HOME" ? row.home : winLeg === "AWAY" ? row.away : "Draw";
  const market = row.devig ?? {
    HOME: row.market.HOME.mid ?? 0,
    DRAW: row.market.DRAW.mid ?? 0,
    AWAY: row.market.AWAY.mid ?? 0,
  };
  const bet = row.bet;

  return (
    <motion.div
      variants={fadeRise}
      className="panel row-glow grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[minmax(220px,1.2fr)_1.4fr_auto] md:items-center md:gap-6"
    >
      {/* match */}
      <div className="flex items-center gap-3">
        <span className="mono w-10 shrink-0 text-2xs text-[var(--color-text-tertiary)]">
          {fmtDate(row.date)}
        </span>
        <div className="flex items-center gap-2">
          <Flag iso={row.homeIso} name={row.home} size={22} />
          <span className="mono text-sm font-semibold tabular-nums">
            {row.homeScore}
            <span className="px-1 text-[var(--color-text-tertiary)]">–</span>
            {row.awayScore}
          </span>
          <Flag iso={row.awayIso} name={row.away} size={22} />
        </div>
        <span className="ml-auto md:ml-0">
          <Chip title="Actual result">{resultLabel}</Chip>
        </span>
      </div>

      {/* probability comparison — the actual result is the bright segment */}
      <div className="flex flex-col gap-2">
        <ProbRow
          label="GAFFER"
          labelColor="var(--color-accent)"
          probs={row.gaffer}
          outcome={row.outcome}
        />
        <ProbRow
          label="Market"
          labelColor="var(--color-text-secondary)"
          probs={market}
          outcome={row.outcome}
        />
      </div>

      {/* bet */}
      <div className="flex items-center justify-between gap-4 md:flex-col md:items-end md:gap-1">
        {bet ? (
          <>
            <div className="mono text-2xs text-[var(--color-text-secondary)]">
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
          <span className="mono text-2xs text-[var(--color-text-tertiary)]">no edge · pass</span>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export default function ScorecardView({ sc: initial }: { sc: Scorecard }) {
  const sc = useLiveData("scorecard", initial);
  const { meta, accuracy, pnl, ledger } = sc;

  if (!accuracy || meta.nScored === 0) {
    return (
      <div className="panel p-10 text-center">
        <div className="display text-2xl text-[var(--color-text-primary)]">
          Not enough games yet
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          The scorecard needs group matches that we logged a pre-match prediction for and that
          Kalshi also priced. Check back as the tournament plays out.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <motion.section
        variants={staggerChildren(0.08)}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-5 lg:grid-cols-3"
      >
        <AccuracyCard acc={accuracy} />
        <FlatCard pnl={pnl.flat} />
        <KellyCard pnl={pnl.kelly} fraction={meta.kellyFraction} />
      </motion.section>

      <section>
        <div className="mb-5">
          <SectionHeader
            eyebrow="Match by match"
            title="The ledger"
            right={
              <span className="mono text-2xs text-[var(--color-text-tertiary)]">
                our odds vs the market · the actual result is the bright segment
              </span>
            }
          />
        </div>
        <motion.div
          variants={staggerChildren(0.04)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="flex flex-col gap-2"
        >
          {ledger.map((row) => (
            <LedgerCard key={`${row.home}-${row.away}-${row.date}`} row={row} />
          ))}
        </motion.div>
      </section>

      <Footnote className="leading-relaxed">
        {meta.nScored} of {meta.nPlayed} played group games scored · {meta.skipped.noPrediction}{" "}
        had no logged pre-match prediction (games before we started snapshotting) ·{" "}
        {meta.skipped.noMarket} had no Kalshi market. Bets are placed at the single largest GAFFER
        edge per game when it clears {(meta.edgeMin * 100).toFixed(0)}%, entered at Kalshi&apos;s
        pre-match ask. Accuracy compares de-vigged probabilities; P&amp;L uses the raw,
        vig-inclusive ask — the honest cost of actually trading.
      </Footnote>
    </div>
  );
}
