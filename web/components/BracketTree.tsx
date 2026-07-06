"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Bracket, BracketChampion, BracketMatch, BracketSlot } from "@/lib/types";
import { useLiveData } from "@/lib/live";
import { DUR, EASE_OUT, fadeRise, scaleIn, staggerChildren } from "@/lib/motion";
import { heat, pct } from "@/lib/ui";
import { TooltipFloat } from "./ui/Tooltip";
import Bar from "./ui/Bar";
import Footnote from "./ui/Footnote";
import Flag from "./Flag";

const ROW_H = 92; // px per R32 cell — drives the whole tree height
const CARD_W = 190; // match-card column width
const TITLE_ODDS_LABEL = "Title odds"; // marks the champion badge's hover as a title-odds ranking

// Anchor for the controlled candidates tooltip: slot center-top, flipped
// below when the slot sits near the viewport top.
type TipAnchor = { x: number; y: number; below: boolean; slot: BracketSlot };

export default function BracketTree({ bracket: initial }: { bracket: Bracket }) {
  const bracket = useLiveData("bracket", initial);
  // `tip` keeps the last anchor+slot so content persists through the exit
  // animation; `open` alone drives visibility.
  const [tip, setTip] = useState<TipAnchor | null>(null);
  const [open, setOpen] = useState(false);

  const height = bracket.left.R32.length * ROW_H;

  const show = (e: React.SyntheticEvent, slot: BracketSlot) => {
    if (slot.candidates.length <= 1) return; // nothing extra to reveal
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const below = r.top < 200; // near the top → drop the tooltip below instead of above
    setTip({ x: r.left + r.width / 2, y: below ? r.bottom : r.top, below, slot });
    setOpen(true);
  };
  const hide = () => setOpen(false);

  // Escape dismisses the candidates tooltip without moving focus.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div>
      <div className="panel overflow-x-auto p-4 sm:p-6">
        <motion.div
          variants={staggerChildren(0.035)}
          initial="hidden"
          animate="show"
          className="flex items-stretch"
          style={{ minWidth: 1180, height, gap: "var(--br-gap)" }}
        >
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
        </motion.div>
      </div>

      <Footnote className="max-w-3xl leading-relaxed">
        Decided matches show the final score (winner highlighted, P = won on penalties) and the
        real winner advances. Open matches show the two sides&apos; head-to-head win odds (they add
        to 100%); there the favourite advances to fill the next round. Grey number = strength seed
        (Elo rank). Hover or focus a projected slot to see the other teams that could land there;
        Escape dismisses.
      </Footnote>

      <TooltipFloat
        open={open && tip !== null}
        x={tip?.x ?? 0}
        y={tip?.y ?? 0}
        placement={tip?.below ? "below" : "above"}
      >
        {tip && <Candidates slot={tip.slot} />}
      </TooltipFloat>
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
    <motion.div variants={staggerChildren(0.02)} className="br-col flex flex-col" style={{ width: CARD_W }}>
      {matches.map((m) => (
        <div key={m.match} className={`br-cell flex flex-1 items-center ${send} ${receive}`}>
          {recv && <span className="br-stub" />}
          <MatchCard match={m} side={side} onShow={onShow} onHide={onHide} />
        </div>
      ))}
    </motion.div>
  );
}

function MatchCard({
  match,
  side,
  onShow,
  onHide,
}: {
  match: BracketMatch;
  side: "l" | "r";
  onShow: ShowFn;
  onHide: () => void;
}) {
  const decided = match.decided === true;
  return (
    <motion.div
      variants={fadeRise}
      whileHover={{ scale: 1.015, borderColor: "var(--color-border-strong)" }}
      transition={{ duration: DUR.fast, ease: EASE_OUT }}
      className="panel w-full overflow-hidden"
    >
      <TeamRow
        s={match.a}
        side={side}
        score={decided ? match.aScore : undefined}
        pensWin={decided && match.pens === true && match.winner === "a"}
        onShow={onShow}
        onHide={onHide}
      />
      <div className="h-px bg-[var(--color-border)]" />
      <TeamRow
        s={match.b}
        side={side}
        score={decided ? match.bScore : undefined}
        pensWin={decided && match.pens === true && match.winner === "b"}
        onShow={onShow}
        onHide={onHide}
      />
    </motion.div>
  );
}

/** Compact heat-tinted odds pill (HeatPill's fixed 52px min-width is too wide
 *  for the 190px bracket card, so this local variant keeps the 42px footprint).
 *  Background/text tween on live data changes — no entrance re-fire. */
function OddsPill({ p }: { p: number }) {
  return (
    <motion.span
      animate={{
        backgroundColor: heat(p, 0.14),
        color: p >= 0.62 ? heat(p) : "var(--color-text-secondary)",
      }}
      transition={{ duration: DUR.base }}
      className="mono min-w-[42px] shrink-0 rounded-[var(--radius-xs)] px-1 py-0.5 text-center text-2xs tabular-nums"
    >
      {pct(p, 0)}
    </motion.span>
  );
}

function TeamRow({
  s,
  side,
  score,
  pensWin,
  onShow,
  onHide,
}: {
  s: BracketSlot;
  side: "l" | "r";
  score?: number;
  pensWin?: boolean;
  onShow: ShowFn;
  onHide: () => void;
}) {
  const hoverable = s.candidates.length > 1;
  const alternatives = hoverable
    ? `Could fill this slot — ${s.candidates.map((c) => `${c.name} ${pct(c.prob, 0)}`).join(" · ")}`
    : undefined;
  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-1.5 ${hoverable ? "cursor-help" : ""}`}
      style={{
        flexDirection: side === "r" ? "row-reverse" : "row",
        background: s.fav ? "color-mix(in oklab, var(--color-accent) 8%, transparent)" : undefined,
        opacity: s.result === "lost" ? 0.55 : undefined,
      }}
      tabIndex={hoverable ? 0 : undefined}
      title={alternatives}
      aria-label={
        hoverable ? `${s.name}, ${pct(s.winPct, 0)} to win this tie. ${alternatives}` : undefined
      }
      onMouseEnter={hoverable ? (e) => onShow(e, s) : undefined}
      onMouseLeave={hoverable ? onHide : undefined}
      onFocus={hoverable ? (e) => onShow(e, s) : undefined}
      onBlur={hoverable ? onHide : undefined}
    >
      <span className="mono w-5 shrink-0 text-center text-2xs tabular-nums text-[var(--color-text-tertiary)]">
        {s.seed}
      </span>
      <Flag iso={s.iso} name={s.name} size={20} decorative />
      <div className="min-w-0 flex-1" style={{ textAlign: side === "r" ? "right" : "left" }}>
        <div
          className={`truncate text-sm leading-tight ${
            s.fav
              ? "font-semibold text-[var(--color-text-primary)]"
              : "text-[var(--color-text-secondary)]"
          } ${
            hoverable
              ? "underline decoration-dotted decoration-[var(--color-text-tertiary)] underline-offset-2"
              : ""
          }`}
        >
          {s.name}
        </div>
        {s.slotLabel && (
          <div className="mono truncate text-2xs leading-tight uppercase tracking-wide text-[var(--color-text-tertiary)]">
            {s.slotLabel}
          </div>
        )}
      </div>
      {score != null ? (
        <span className="mono min-w-[42px] shrink-0 text-center text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
          {score}
          {pensWin && (
            <sup className="ml-0.5 text-2xs font-semibold text-[var(--color-warning)]" title="won on penalties">
              P
            </sup>
          )}
        </span>
      ) : (
        <OddsPill p={s.winPct} />
      )}
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
    <motion.div
      variants={staggerChildren(0.06)}
      className="br-cell relative flex items-center justify-center"
      style={{ width: 210 }}
    >
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
        variants={fadeRise}
        whileHover={{ scale: 1.015, borderColor: "var(--color-border-strong)" }}
        transition={{ duration: DUR.fast, ease: EASE_OUT }}
        className="panel w-full overflow-hidden"
      >
        <div className="mono px-2.5 pt-1.5 text-center text-2xs uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
          Final
        </div>
        <TeamRow
          s={bracket.final.a}
          side="l"
          score={bracket.final.decided ? bracket.final.aScore : undefined}
          pensWin={bracket.final.decided && bracket.final.pens === true && bracket.final.winner === "a"}
          onShow={onShow}
          onHide={onHide}
        />
        <div className="h-px bg-[var(--color-border)]" />
        <TeamRow
          s={bracket.final.b}
          side="l"
          score={bracket.final.decided ? bracket.final.bScore : undefined}
          pensWin={bracket.final.decided && bracket.final.pens === true && bracket.final.winner === "b"}
          onShow={onShow}
          onHide={onHide}
        />
      </motion.div>

      {/* champion badge, anchored just below the final card */}
      <motion.div
        variants={scaleIn}
        className={`absolute left-1/2 flex w-full -translate-x-1/2 flex-col items-center gap-2 text-center ${
          hoverable ? "cursor-help" : ""
        }`}
        style={{ top: "calc(50% + 62px)" }}
        tabIndex={hoverable ? 0 : undefined}
        title={champTitle}
        aria-label={
          hoverable
            ? `Projected champion ${champ.name}, ${pct(champ.champion, 1)} title odds. ${champTitle}`
            : undefined
        }
        onMouseEnter={hoverable ? (e) => onShow(e, champSlot) : undefined}
        onMouseLeave={hoverable ? onHide : undefined}
        onFocus={hoverable ? (e) => onShow(e, champSlot) : undefined}
        onBlur={hoverable ? onHide : undefined}
      >
        <span
          className="display rounded-full px-4 py-1.5 text-sm tracking-wide"
          style={{ background: "var(--color-warning)", color: "var(--color-on-accent)" }}
        >
          WORLD CUP
        </span>
        <span className="eyebrow">Projected champion</span>
        <Flag iso={champ.iso} name={champ.name} size={40} decorative />
        <div className="display text-2xl leading-none text-[var(--color-text-primary)]">
          {champ.name}
        </div>
        <div className="display text-3xl text-[var(--color-warning)]">{pct(champ.winPct, 0)}</div>
        <span className="mono text-2xs uppercase tracking-wide text-[var(--color-text-tertiary)]">
          to win the final
        </span>
        <span className="mono text-2xs tabular-nums text-[var(--color-text-secondary)]">
          {pct(champ.champion, 1)} title odds
        </span>
      </motion.div>
    </motion.div>
  );
}

/** Candidates list rendered inside the controlled TooltipFloat. */
function Candidates({ slot }: { slot: BracketSlot }) {
  // The champion badge's list is an outright title-odds ranking (a different question than
  // "who reaches this slot"), so it gets its own heading and no single-row highlight —
  // otherwise the chalk pick would be bolded while sitting below the title-odds leader.
  const isTitleOdds = slot.slotLabel === TITLE_ODDS_LABEL;
  const heading = isTitleOdds ? "Most likely to win it all" : "Could fill this slot";
  return (
    <div className="min-w-[190px]">
      <div className="eyebrow mb-1.5">{heading}</div>
      <div className="flex flex-col gap-1">
        {slot.candidates.map((c) => {
          const isProj = !isTitleOdds && c.name === slot.name;
          return (
            <div key={c.name} className="flex items-center gap-1.5">
              <Flag iso={c.iso} name={c.name} size={15} decorative />
              <span
                className={`min-w-0 flex-1 truncate text-2xs leading-tight ${
                  isProj
                    ? "font-semibold text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                {c.name}
              </span>
              <div className="flex w-[64px] shrink-0 items-center gap-1.5">
                <Bar value={Math.max(0.03, c.prob)} color={heat(c.prob)} height={4} className="flex-1" />
                <span className="mono w-8 shrink-0 text-right text-2xs tabular-nums text-[var(--color-text-secondary)]">
                  {pct(c.prob, 0)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
