"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Bracket, BracketMatch, BracketSlot } from "@/lib/data";
import { heatColor, heatText, pct } from "@/lib/ui";
import Flag from "./Flag";

const ROW_H = 88; // px per R32 cell — drives the whole tree height

export default function BracketTree({ bracket }: { bracket: Bracket }) {
  const height = bracket.left.length * ROW_H;

  const champ = useMemo(() => {
    const all = [...bracket.left, ...bracket.right].flatMap((m) => [m.a, m.b]);
    return all.reduce((best, s) => (s.champion > best.champion ? s : best), all[0]);
  }, [bracket]);

  return (
    <div>
      <div className="panel overflow-x-auto p-4 sm:p-6">
        <div
          className="flex items-stretch"
          style={{ minWidth: 1180, height, gap: "var(--br-gap)" }}
        >
          {/* ---------- LEFT HALF ---------- */}
          <MatchColumn matches={bracket.left} side="l" />
          <LinkColumn count={4} label="R16" side="l" delay={0.05} />
          <LinkColumn count={2} label="QF" side="l" delay={0.1} />
          <LinkColumn count={1} label="SF" side="l" delay={0.15} />

          {/* ---------- CENTER ---------- */}
          <div className="br-cell flex flex-col items-center justify-center" style={{ width: 188 }}>
            {/* connectors into the final from both semis */}
            <span className="br-line absolute top-1/2 h-[2px]" style={{ left: "calc(var(--br-gap) / -2)", width: "calc(var(--br-gap) / 2)" }} />
            <span className="br-line absolute top-1/2 h-[2px]" style={{ right: "calc(var(--br-gap) / -2)", width: "calc(var(--br-gap) / 2)" }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-3 text-center"
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
              <div className="display text-3xl text-[var(--color-gold)]">{pct(champ.champion, 1)}</div>
            </motion.div>
          </div>

          {/* ---------- RIGHT HALF ---------- */}
          <LinkColumn count={1} label="SF" side="r" delay={0.15} />
          <LinkColumn count={2} label="QF" side="r" delay={0.1} />
          <LinkColumn count={4} label="R16" side="r" delay={0.05} />
          <MatchColumn matches={bracket.right} side="r" />
        </div>
      </div>

      <p className="mt-3 mono text-[0.62rem] text-[var(--color-faint)]">
        The most-likely Round-of-32 bracket: each slot shows the team that filled it in the most
        simulations. Small grey number = strength seed (Elo rank); coloured % = title odds. Slots
        firm up as the group stage finishes.
      </p>
    </div>
  );
}

function MatchColumn({ matches, side }: { matches: BracketMatch[]; side: "l" | "r" }) {
  const send = side === "l" ? "br-send-r" : "br-send-l";
  return (
    <div className="br-col flex flex-col" style={{ width: 196 }}>
      {matches.map((m, i) => (
        <div key={m.match} className={`br-cell flex flex-1 items-center ${send}`}>
          <MatchCard match={m} side={side} index={i} />
        </div>
      ))}
    </div>
  );
}

function LinkColumn({ count, label, side, delay }: { count: number; label: string; side: "l" | "r"; delay: number }) {
  const recv = side === "l" ? "br-recv-l" : "br-recv-r";
  const send = "br-send-" + (side === "l" ? "r" : "l");
  return (
    <div className="br-col flex flex-col" style={{ width: 60 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`br-cell flex flex-1 items-center justify-center ${recv} ${send}`}>
          <span className="br-stub" />
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay }}
            className="chip text-[var(--color-faint)]"
          >
            {label}
          </motion.span>
        </div>
      ))}
    </div>
  );
}

function MatchCard({ match, side, index }: { match: BracketMatch; side: "l" | "r"; index: number }) {
  const favA = match.a.champion >= match.b.champion;
  return (
    <motion.div
      initial={{ opacity: 0, x: side === "l" ? -16 : 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className="panel w-full overflow-hidden"
    >
      <TeamRow s={match.a} fav={favA} side={side} />
      <div className="h-px bg-[var(--color-line)]" />
      <TeamRow s={match.b} fav={!favA} side={side} />
    </motion.div>
  );
}

function TeamRow({ s, fav, side }: { s: BracketSlot; fav: boolean; side: "l" | "r" }) {
  const odds = (
    <span
      className="mono shrink-0 rounded text-center text-[0.6rem] tabular-nums"
      style={{
        minWidth: 40,
        padding: "2px 0",
        background: `${heatColor(s.champion)}22`,
        color: heatText(s.champion) === "#07090d" ? heatColor(s.champion) : "var(--color-text)",
      }}
    >
      {pct(s.champion, s.champion >= 0.1 ? 0 : 1)}
    </span>
  );
  const seed = (
    <span className="mono w-5 shrink-0 text-center text-[0.62rem] text-[var(--color-faint)] tabular-nums">
      {s.seed}
    </span>
  );
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ flexDirection: side === "r" ? "row-reverse" : "row" }}>
      {seed}
      <Flag iso={s.iso} name={s.name} size={20} />
      <div className="min-w-0 flex-1" style={{ textAlign: side === "r" ? "right" : "left" }}>
        <div className={`truncate text-[12.5px] leading-tight ${fav ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-muted)]"}`}>
          {s.name}
        </div>
        <div className="mono truncate text-[0.54rem] uppercase tracking-wide text-[var(--color-faint)]">{s.slotLabel}</div>
      </div>
      {odds}
    </div>
  );
}
