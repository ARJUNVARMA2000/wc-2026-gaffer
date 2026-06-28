"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import type { Bracket, BracketChampion, BracketMatch, BracketSlot } from "@/lib/data";
import { heatColor, heatText, pct } from "@/lib/ui";
import Flag from "./Flag";

const ROW_H = 92; // px per R32 cell — drives the whole tree height
const CARD_W = 190; // match-card column width
const TITLE_ODDS_LABEL = "Title odds"; // marks the champion badge's hover as a title-odds ranking

// ---- hover tooltip (portal-rendered so it never clips inside the scroll panel) ----
type TipState = { x: number; y: number; flip: boolean; slot: BracketSlot } | null;

// SSR/static-export-safe "are we on the client?" flag (no setState-in-effect lint error).
const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);

const TIP_HALF = 115; // half the tooltip's max width, for viewport edge-clamping

export default function BracketTree({ bracket }: { bracket: Bracket }) {
  const [tip, setTip] = useState<TipState>(null);
  const mounted = useMounted();

  const height = bracket.left.R32.length * ROW_H;

  const show = (e: React.SyntheticEvent, slot: BracketSlot) => {
    if (slot.candidates.length <= 1) return; // nothing extra to reveal
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const flip = r.top < 200; // near the top → drop the tooltip below instead of above
    const x = Math.min(Math.max(r.left + r.width / 2, TIP_HALF + 8), window.innerWidth - TIP_HALF - 8);
    setTip({ x, y: flip ? r.bottom + 8 : r.top - 8, flip, slot });
  };
  const hide = () => setTip(null);

  return (
    <div>
      <div className="panel overflow-x-auto p-4 sm:p-6">
        <div className="flex items-stretch" style={{ minWidth: 1180, height, gap: "var(--br-gap)" }}>
          {/* ---------- LEFT HALF ---------- */}
          <MatchColumn matches={bracket.left.R32} side="l" recv={false} onShow={show} onHide={hide} />
          <MatchColumn matches={bracket.left.R16} side="l" recv onShow={show} onHide={hide} />
          <MatchColumn matches={bracket.left.QF} side="l" recv onShow={show} onHide={hide} />
          <MatchColumn matches={bracket.left.SF} side="l" recv onShow={show} onHide={hide} />

          {/* ---------- CENTER: final + champion ---------- */}
          <Center bracket={bracket} onShow={show} onHide={hide} />

          {/* ---------- RIGHT HALF ---------- */}
          <MatchColumn matches={bracket.right.SF} side="r" recv onShow={show} onHide={hide} />
          <MatchColumn matches={bracket.right.QF} side="r" recv onShow={show} onHide={hide} />
          <MatchColumn matches={bracket.right.R16} side="r" recv onShow={show} onHide={hide} />
          <MatchColumn matches={bracket.right.R32} side="r" recv={false} onShow={show} onHide={hide} />
        </div>
      </div>

      <p className="mt-3 mono text-[0.62rem] leading-relaxed text-[var(--color-faint)]">
        Each match shows the two sides&apos; head-to-head win odds (they add to 100%); the favourite
        advances to fill the next round. Grey number = strength seed (Elo rank). Hover (or focus) a
        projected R16/QF/SF slot to see the other teams that could land there.
      </p>

      {mounted && tip && createPortal(<Tooltip tip={tip} />, document.body)}
    </div>
  );
}

type ShowFn = (e: React.SyntheticEvent, slot: BracketSlot) => void;

function MatchColumn({
  matches,
  side,
  recv,
  onShow,
  onHide,
}: {
  matches: BracketMatch[];
  side: "l" | "r";
  recv: boolean;
  onShow: ShowFn;
  onHide: () => void;
}) {
  const send = side === "l" ? "br-send-r" : "br-send-l";
  const receive = recv ? (side === "l" ? "br-recv-l" : "br-recv-r") : "";
  return (
    <div className="br-col flex flex-col" style={{ width: CARD_W }}>
      {matches.map((m, i) => (
        <div key={m.match} className={`br-cell flex flex-1 items-center ${send} ${receive}`}>
          {recv && <span className="br-stub" />}
          <MatchCard match={m} side={side} index={i} onShow={onShow} onHide={onHide} />
        </div>
      ))}
    </div>
  );
}

function MatchCard({
  match,
  side,
  index,
  onShow,
  onHide,
}: {
  match: BracketMatch;
  side: "l" | "r";
  index: number;
  onShow: ShowFn;
  onHide: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: side === "l" ? -14 : 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.03, 0.25), ease: [0.16, 1, 0.3, 1] }}
      className="panel w-full overflow-hidden"
    >
      <TeamRow s={match.a} side={side} onShow={onShow} onHide={onHide} />
      <div className="h-px bg-[var(--color-line)]" />
      <TeamRow s={match.b} side={side} onShow={onShow} onHide={onHide} />
    </motion.div>
  );
}

function TeamRow({
  s,
  side,
  onShow,
  onHide,
}: {
  s: BracketSlot;
  side: "l" | "r";
  onShow: ShowFn;
  onHide: () => void;
}) {
  const hoverable = s.candidates.length > 1;
  const odds = (
    <span
      className="mono shrink-0 rounded text-center text-[0.62rem] tabular-nums"
      style={{
        minWidth: 42,
        padding: "2px 0",
        background: `${heatColor(s.winPct)}22`,
        color: heatText(s.winPct) === "#07090d" ? heatColor(s.winPct) : "var(--color-text)",
      }}
    >
      {pct(s.winPct, 0)}
    </span>
  );
  const seed = (
    <span className="mono w-5 shrink-0 text-center text-[0.62rem] text-[var(--color-faint)] tabular-nums">
      {s.seed}
    </span>
  );
  const title = hoverable
    ? `Could fill this slot — ${s.candidates.map((c) => `${c.name} ${pct(c.prob, 0)}`).join(" · ")}`
    : undefined;
  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-1.5 ${hoverable ? "cursor-help" : ""}`}
      style={{ flexDirection: side === "r" ? "row-reverse" : "row" }}
      tabIndex={hoverable ? 0 : undefined}
      title={title}
      onMouseEnter={hoverable ? (e) => onShow(e, s) : undefined}
      onMouseLeave={hoverable ? onHide : undefined}
      onFocus={hoverable ? (e) => onShow(e, s) : undefined}
      onBlur={hoverable ? onHide : undefined}
    >
      {seed}
      <Flag iso={s.iso} name={s.name} size={20} />
      <div className="min-w-0 flex-1" style={{ textAlign: side === "r" ? "right" : "left" }}>
        <div
          className={`truncate text-[12.5px] leading-tight ${
            s.fav ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-muted)]"
          } ${hoverable ? "underline decoration-dotted decoration-[var(--color-faint)] underline-offset-2" : ""}`}
        >
          {s.name}
        </div>
        {s.slotLabel && (
          <div className="mono truncate text-[0.54rem] uppercase tracking-wide text-[var(--color-faint)]">
            {s.slotLabel}
          </div>
        )}
      </div>
      {odds}
    </div>
  );
}

function Center({
  bracket,
  onShow,
  onHide,
}: {
  bracket: Bracket;
  onShow: ShowFn;
  onHide: () => void;
}) {
  const champ: BracketChampion = bracket.champion;
  const hoverable = champ.candidates.length > 1;
  const champSlot: BracketSlot = {
    name: champ.name,
    iso: champ.iso,
    seed: champ.seed,
    group: champ.group,
    slotLabel: TITLE_ODDS_LABEL,
    winPct: champ.winPct,
    fav: true,
    candidates: champ.candidates,
  };
  const champTitle = hoverable
    ? `Most likely to win it all — ${champ.candidates.map((c) => `${c.name} ${pct(c.prob, 0)}`).join(" · ")}`
    : undefined;
  return (
    <div className="br-cell relative flex items-center justify-center" style={{ width: 210 }}>
      {/* connectors from both semis meet the final card at the column's vertical centre */}
      <span
        className="br-line absolute top-1/2 h-[2px]"
        style={{ left: "calc(var(--br-gap) / -2)", width: "calc(var(--br-gap) / 2)" }}
      />
      <span
        className="br-line absolute top-1/2 h-[2px]"
        style={{ right: "calc(var(--br-gap) / -2)", width: "calc(var(--br-gap) / 2)" }}
      />

      {/* the final, as a head-to-head match — the only in-flow child, so it centres on 50% */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15 }}
        className="panel w-full overflow-hidden"
      >
        <div className="mono px-2.5 pt-1.5 text-center text-[0.5rem] uppercase tracking-[0.15em] text-[var(--color-faint)]">
          Final
        </div>
        <TeamRow s={bracket.final.a} side="l" onShow={onShow} onHide={onHide} />
        <div className="h-px bg-[var(--color-line)]" />
        <TeamRow s={bracket.final.b} side="l" onShow={onShow} onHide={onHide} />
      </motion.div>

      {/* champion badge, anchored just below the final card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={`absolute left-1/2 flex w-full -translate-x-1/2 flex-col items-center gap-2 text-center ${
          hoverable ? "cursor-help" : ""
        }`}
        style={{ top: "calc(50% + 62px)" }}
        tabIndex={hoverable ? 0 : undefined}
        title={champTitle}
        onMouseEnter={hoverable ? (e) => onShow(e, champSlot) : undefined}
        onMouseLeave={hoverable ? onHide : undefined}
        onFocus={hoverable ? (e) => onShow(e, champSlot) : undefined}
        onBlur={hoverable ? onHide : undefined}
      >
        <span
          className="display rounded-full px-4 py-1.5 text-sm tracking-wide"
          style={{ background: "var(--color-lime)", color: "#07090d" }}
        >
          WORLD CUP
        </span>
        <span className="eyebrow text-[var(--color-faint)]">Projected champion</span>
        <Flag iso={champ.iso} name={champ.name} size={40} />
        <div className="display text-2xl leading-none">{champ.name}</div>
        <div className="display text-3xl text-[var(--color-gold)]">{pct(champ.winPct, 0)}</div>
        <span className="mono text-[0.55rem] uppercase tracking-wide text-[var(--color-faint)]">
          to win the final
        </span>
        <span className="mono text-[0.62rem] tabular-nums text-[var(--color-muted)]">
          {pct(champ.champion, 1)} title odds
        </span>
      </motion.div>
    </div>
  );
}

function Tooltip({ tip }: { tip: NonNullable<TipState> }) {
  const { x, y, flip, slot } = tip;
  // The champion badge's list is an outright title-odds ranking (a different question than
  // "who reaches this slot"), so it gets its own heading and no single-row highlight —
  // otherwise the chalk pick would be bolded while sitting below the title-odds leader.
  const isTitleOdds = slot.slotLabel === TITLE_ODDS_LABEL;
  const heading = isTitleOdds ? "Most likely to win it all" : "Could fill this slot";
  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        left: x,
        top: y,
        transform: `translate(-50%, ${flip ? "0" : "-100%"})`,
      }}
    >
      <div className="panel min-w-[180px] max-w-[220px] p-2.5 shadow-xl">
        <div className="mono mb-1.5 text-[0.52rem] uppercase tracking-[0.12em] text-[var(--color-faint)]">
          {heading}
        </div>
        <div className="flex flex-col gap-1">
          {slot.candidates.map((c) => {
            const isProj = !isTitleOdds && c.name === slot.name;
            return (
              <div key={c.name} className="flex items-center gap-1.5">
                <Flag iso={c.iso} name={c.name} size={15} />
                <span
                  className={`min-w-0 flex-1 truncate text-[11px] leading-tight ${
                    isProj ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-muted)]"
                  }`}
                >
                  {c.name}
                </span>
                <div className="flex w-[58px] shrink-0 items-center gap-1">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(3, c.prob * 100)}%`, background: heatColor(c.prob) }}
                    />
                  </div>
                  <span className="mono w-8 shrink-0 text-right text-[0.56rem] tabular-nums text-[var(--color-muted)]">
                    {pct(c.prob, 0)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
