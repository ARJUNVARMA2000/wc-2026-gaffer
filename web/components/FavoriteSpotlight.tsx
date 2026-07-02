"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { DUR, EASE_OUT, fadeRise, staggerChildren } from "@/lib/motion";
import { useLiveData } from "@/lib/live";
import { pct } from "@/lib/ui";
import type { Team } from "@/lib/types";
import CountUp from "@/components/CountUp";
import Flag from "@/components/Flag";

const SUB_STATS = [
  ["Reach final", (t: Team) => t.final],
  ["Semis", (t: Team) => t.sf],
  ["Make KO", (t: Team) => t.ko],
] as const;

/** Hero sidecar: the current title favorite, live champion odds headline,
 *  and its round-by-round advancement sub-stats. */
export default function FavoriteSpotlight({ teams: initial }: { teams: Team[] }) {
  const teams = useLiveData("teams", initial);
  const fav = teams[0];
  // Hover shadow lives in inline style: the .panel-glass shadow is unlayered
  // CSS, so a hover: utility (layered) could never override it.
  const [hovered, setHovered] = useState(false);

  if (!fav) return null;

  return (
    <motion.div
      variants={staggerChildren(0, 0.15)}
      initial="hidden"
      animate="show"
      className="relative"
    >
      <motion.div
        variants={fadeRise}
        whileHover={{ y: -2 }}
        // Gesture speed only — fadeRise carries its own entrance transition.
        transition={{ duration: DUR.fast, ease: EASE_OUT }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        className="panel-glass gradient-border relative overflow-hidden p-7"
        style={{
          boxShadow: hovered ? "var(--shadow-raised)" : "var(--shadow-panel)",
          transition: "box-shadow 0.15s ease",
        }}
      >
        {/* accent blur orb */}
        <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-[var(--color-accent)] opacity-[0.06] blur-2xl" />

        <div className="eyebrow flex items-center justify-between">
          <span>Current favorite</span>
          <span className="text-[var(--color-warning)]">#1</span>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <Flag iso={fav.iso} name={fav.name} size={54} decorative />
          <div>
            <div className="display text-4xl leading-none">{fav.name}</div>
            <div className="mono mt-1.5 text-xs text-[var(--color-text-secondary)]">
              {fav.confederation} · Group {fav.group} · Elo {Math.round(fav.elo)}
            </div>
          </div>
        </div>

        <div
          className="mt-6 flex items-end gap-2"
          aria-label={`${fav.name}: ${pct(fav.champion)} chance to win the World Cup`}
        >
          <span className="display text-[5rem] leading-none text-[var(--color-warning)]">
            <CountUp value={fav.champion * 100} decimals={1} />
          </span>
          <span className="display mb-2 text-2xl text-[var(--color-text-secondary)]">%</span>
          <span className="mb-2 ml-1 text-sm text-[var(--color-text-secondary)]">
            to lift the trophy
          </span>
        </div>

        <div className="hairline mt-6 grid grid-cols-3 gap-3 border-t pt-5">
          {SUB_STATS.map(([label, get]) => (
            <div key={label}>
              <div className="mono text-lg text-[var(--color-text-primary)]">
                <CountUp value={get(fav) * 100} decimals={0} suffix="%" />
              </div>
              <div className="eyebrow mt-1">{label}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
